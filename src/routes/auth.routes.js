const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const knex = require("../config/knex");

const router = express.Router();

router.post("/api/register", async (req, res) => {
  try {
    const { nombre, email, password } = req.body;

    if (!nombre || !email || !password) {
      return res.status(400).json({ error: "Todos los campos son obligatorios." });
    }

    const password_hash = await bcrypt.hash(password, 10);
    const [newUserId] = await knex("users").insert({
      nombre,
      email,
      password_hash,
    });

    res.status(201).json({
      message: "Usuario registrado con éxito en la base de datos.",
      userId: newUserId,
    });
  } catch (error) {
    console.error("Error al registrar usuario:", error);
    if (error.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ error: "El email ya está registrado." });
    }
    res.status(500).json({ error: "Ocurrió un error en el servidor." });
  }
});

router.post("/api/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res
        .status(400)
        .json({ error: "Email y contraseña son obligatorios." });
    }

    const user = await knex("users").where({ email }).first();
    if (!user) {
      return res.status(401).json({ error: "Credenciales inválidas." });
    }

    const passwordMatch = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatch) {
      return res.status(401).json({ error: "Credenciales inválidas." });
    }

    const token = jwt.sign(
      { userId: user.id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: "1h" }
    );

    res.json({ message: "Login exitoso.", token });
  } catch (error) {
    console.error("Error en el login:", error);
    res.status(500).json({ error: "Ocurrió un error en el servidor." });
  }
});

module.exports = router;
