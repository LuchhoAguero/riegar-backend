const express = require("express");
const knex = require("../config/knex");
const authMiddleware = require("../middleware/auth.middleware");

const router = express.Router();

router.post("/api/fincas", authMiddleware, async (req, res) => {
  try {
    const { nombre_finca, ubicacion } = req.body;
    const user_id = req.user.userId;

    if (!nombre_finca) {
      return res.status(400).json({ error: "El nombre de la finca es obligatorio." });
    }

    const [newFincaId] = await knex("fincas").insert({
      nombre_finca,
      ubicacion,
      user_id,
    });

    res.status(201).json({ message: "Finca creada con éxito.", fincaId: newFincaId });
  } catch (error) {
    console.error("Error al crear finca:", error);
    res.status(500).json({ error: "Ocurrió un error en el servidor." });
  }
});

router.get("/api/fincas", authMiddleware, async (req, res) => {
  try {
    const user_id = req.user.userId;
    const fincas = await knex("fincas").where({ user_id });

    res.json(fincas);
  } catch (error) {
    console.error("Error al obtener fincas:", error);
    res.status(500).json({ error: "Ocurrió un error en el servidor." });
  }
});

router.delete("/api/fincas/:id", authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const user_id = req.user.userId;
    const deleted = await knex.transaction(async (trx) => {
      // Lock the owned parent while checking dependencies and deleting children.
      const finca = await trx("fincas").where({ id, user_id }).forUpdate().first();
      if (!finca) return false;

      const simulation = await trx("irrigation_simulations")
        .where({ finca_id: id }).select("id").first();
      if (simulation) {
        const conflict = new Error("La finca posee simulaciones de riego guardadas y no puede eliminarse.");
        conflict.code = "FARM_HAS_IRRIGATION_SIMULATIONS";
        throw conflict;
      }

      await trx("calculos").where({ finca_id: id }).del();
      await trx("fincas").where({ id, user_id }).del();
      return true;
    });

    if (!deleted) {
      return res
        .status(404)
        .json({ error: "Finca no encontrada o no tienes permiso." });
    }

    res.json({ message: "Finca y sus cálculos eliminados correctamente." });
  } catch (error) {
    if (error.code === "FARM_HAS_IRRIGATION_SIMULATIONS") {
      return res.status(409).json({ error: error.message, code: error.code });
    }
    // Knex rejects only after rollback. Keep FK failures controlled and generic:
    // another dependent row must not cause partial loss of Manning history.
    if (error.code === "ER_ROW_IS_REFERENCED_2" || error.errno === 1451) {
      return res.status(409).json({
        error: "La finca tiene registros asociados y no puede eliminarse.",
        code: "FARM_DELETE_CONFLICT",
      });
    }
    console.error("Error al eliminar finca:", error);
    res.status(500).json({ error: "Error en el servidor." });
  }
});

router.put("/api/fincas/:id", authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const user_id = req.user.userId;
    const { nombre_finca, ubicacion } = req.body;
    const finca = await knex("fincas").where({ id, user_id }).first();

    if (!finca) {
      return res
        .status(404)
        .json({ error: "Finca no encontrada o no tienes permiso." });
    }

    await knex("fincas").where({ id }).update({
      nombre_finca,
      ubicacion,
      updated_at: knex.fn.now(),
    });

    res.json({ message: "Finca actualizada correctamente." });
  } catch (error) {
    console.error("Error al actualizar finca:", error);
    res.status(500).json({ error: "Error en el servidor." });
  }
});

module.exports = router;
