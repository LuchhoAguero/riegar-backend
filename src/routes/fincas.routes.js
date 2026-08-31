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
    const finca = await knex("fincas").where({ id, user_id }).first();

    if (!finca) {
      return res
        .status(404)
        .json({ error: "Finca no encontrada o no tienes permiso." });
    }

    await knex("calculos").where({ finca_id: id }).del();
    await knex("fincas").where({ id }).del();

    res.json({ message: "Finca y sus cálculos eliminados correctamente." });
  } catch (error) {
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
