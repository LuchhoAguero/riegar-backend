const express = require("express");
const knex = require("../config/knex");
const authMiddleware = require("../middleware/auth.middleware");
const { ManningError, calculateManning } = require("../services/manning.service");

const router = express.Router();

router.post("/api/fincas/:fincaId/calculos", authMiddleware, async (req, res) => {
  try {
    const { fincaId } = req.params;
    const user_id = req.user.userId;
    const finca = await knex("fincas").where({ id: fincaId, user_id }).first();

    if (!finca) {
      return res
        .status(404)
        .json({ error: "Finca no encontrada o no pertenece al usuario." });
    }

    const result = calculateManning(req.body);
    let nombre_calculo = "Cálculo sin nombre";
    if (req.body.nombre_calculo !== undefined) {
      if (typeof req.body.nombre_calculo !== "string") {
        throw new ManningError("invalid_input", "Nombre del cálculo inválido.", {
          nombre_calculo: "Debe ser un texto no vacío de hasta 255 caracteres.",
        });
      }
      nombre_calculo = req.body.nombre_calculo.trim();
      // table.string() in the existing migration is VARCHAR(255).
      if (!nombre_calculo || [...nombre_calculo].length > 255) {
        throw new ManningError("invalid_input", "Nombre del cálculo inválido.", {
          nombre_calculo: "Debe ser un texto no vacío de hasta 255 caracteres.",
        });
      }
    }

    const { tipo_canal, b, h, z, n, S, A, P, Q_m3s } = result;
    // Only existing columns, always derived by the server. R/V are response-only.
    const [newCalculoId] = await knex("calculos").insert({
      finca_id: fincaId,
      nombre_calculo,
      tipo_canal,
      b,
      h,
      z,
      n,
      S,
      A,
      P,
      Q_m3s,
    });

    res.status(201).json({
      message: "Cálculo guardado con éxito.",
      calculoId: newCalculoId,
      // Unrounded calculation; existing DECIMAL columns may round the stored row.
      calculo: { nombre_calculo, ...result },
    });
  } catch (error) {
    if (error instanceof ManningError) {
      return res.status(error.code === "invalid_geometry" ? 422 : 400).json({
        error: error.message,
        code: error.code,
        fields: error.fields,
      });
    }
    console.error("Error al guardar el cálculo:", error);
    res.status(500).json({ error: "Ocurrió un error en el servidor." });
  }
});

router.get("/api/fincas/:fincaId/calculos", authMiddleware, async (req, res) => {
  try {
    const { fincaId } = req.params;
    const user_id = req.user.userId;
    const finca = await knex("fincas").where({ id: fincaId, user_id }).first();

    if (!finca) {
      return res
        .status(404)
        .json({ error: "Finca no encontrada o no pertenece al usuario." });
    }

    const calculos = await knex("calculos")
      .where({ finca_id: fincaId })
      .orderBy("created_at", "desc");

    res.json(calculos);
  } catch (error) {
    console.error("Error al obtener los cálculos:", error);
    res.status(500).json({ error: "Ocurrió un error en el servidor." });
  }
});

router.put("/api/calculos/:id", authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const user_id = req.user.userId;
    const { nombre_calculo } = req.body;
    const calculo = await knex("calculos")
      .join("fincas", "calculos.finca_id", "fincas.id")
      .where({ "calculos.id": id, "fincas.user_id": user_id })
      .first();

    if (!calculo) {
      return res
        .status(404)
        .json({ error: "Cálculo no encontrado o no tienes permiso." });
    }

    await knex("calculos").where({ id }).update({
      nombre_calculo,
      updated_at: knex.fn.now(),
    });

    res.json({ message: "Cálculo actualizado correctamente." });
  } catch (error) {
    console.error("Error al actualizar cálculo:", error);
    res.status(500).json({ error: "Error en el servidor." });
  }
});

router.delete("/api/calculos/:id", authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const user_id = req.user.userId;
    const calculo = await knex("calculos")
      .join("fincas", "calculos.finca_id", "fincas.id")
      .where({ "calculos.id": id, "fincas.user_id": user_id })
      .first();

    if (!calculo) {
      return res
        .status(404)
        .json({ error: "Cálculo no encontrado o no tienes permiso." });
    }

    await knex("calculos").where({ id }).del();
    res.json({ message: "Cálculo eliminado correctamente." });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error en el servidor." });
  }
});

module.exports = router;
