const express = require("express");
const knex = require("../config/knex");
const authMiddleware = require("../middleware/auth.middleware");

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

    const { nombre_calculo, tipo_canal, b, h, z, n, S, A, P, Q_m3s } = req.body;

    if (!tipo_canal || !h || !n || !S || !A || !P || !Q_m3s) {
      return res
        .status(400)
        .json({ error: "Faltan datos obligatorios del cálculo." });
    }

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
    });
  } catch (error) {
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
