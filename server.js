require("dotenv").config();
const express = require("express");
const knexConfig = require("./knexfile").development; // Importa la configuración de la DB
const knex = require("knex")(knexConfig); // Inicializa Knex
const bcrypt = require("bcrypt"); // Importa bcrypt para hashear
const authMiddleware = require("./authMiddleware");
const app = express();
const cors = require("cors");
// Middleware para que Express entienda JSON
app.use(cors());
app.use(express.json());

const PORT = 4000;

// Ruta de prueba
app.get("/", (req, res) => {
  res.send("¡Hola Mundo desde el backend de RiegAR!");
});

// Ruta para registrar un nuevo usuario
app.post("/api/register", async (req, res) => {
  try {
    const { nombre, email, password } = req.body;

    // 1. Validar que los datos llegaron
    if (!nombre || !email || !password) {
      return res
        .status(400)
        .json({ error: "Todos los campos son obligatorios." });
    }

    // 2. Hashear la contraseña
    const saltRounds = 10;
    const password_hash = await bcrypt.hash(password, saltRounds);

    // 3. Insertar el nuevo usuario en la base de datos
    const [newUserId] = await knex("users").insert({
      nombre,
      email,
      password_hash,
    });

    // 4. Enviar una respuesta de éxito
    res.status(201).json({
      message: "Usuario registrado con éxito en la base de datos.",
      userId: newUserId,
    });
  } catch (error) {
    // Manejo de errores (ej. email duplicado)
    console.error("Error al registrar usuario:", error);
    if (error.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ error: "El email ya está registrado." });
    }
    res.status(500).json({ error: "Ocurrió un error en el servidor." });
  }
});
const jwt = require("jsonwebtoken"); // No olvides importar jsonwebtoken al principio del archivo

app.post("/api/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    // 1. Validar que los datos llegaron
    if (!email || !password) {
      return res
        .status(400)
        .json({ error: "Email y contraseña son obligatorios." });
    }

    // 2. Buscar al usuario en la base de datos por su email
    const user = await knex("users").where({ email }).first();
    if (!user) {
      return res.status(401).json({ error: "Credenciales inválidas." }); // Mensaje genérico por seguridad
    }

    // 3. Comparar la contraseña enviada con el hash guardado
    const passwordMatch = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatch) {
      return res.status(401).json({ error: "Credenciales inválidas." }); // Mismo mensaje genérico
    }

    // 4. Si las credenciales son correctas, crear el token JWT
    const token = jwt.sign(
      { userId: user.id, email: user.email }, // El "payload" del token
      process.env.JWT_SECRET, // La firma secreta desde .env
      { expiresIn: "1h" } // El token expirará en 1 hora
    );

    // 5. Enviar el token al cliente
    res.json({ message: "Login exitoso.", token });
  } catch (error) {
    console.error("Error en el login:", error);
    res.status(500).json({ error: "Ocurrió un error en el servidor." });
  }
});

// Ruta para crear una nueva finca
app.post("/api/fincas", authMiddleware, async (req, res) => {
  try {
    const { nombre_finca, ubicacion } = req.body;

    // Obtenemos el ID del usuario desde el token (gracias al middleware)
    const user_id = req.user.userId;

    if (!nombre_finca) {
      return res
        .status(400)
        .json({ error: "El nombre de la finca es obligatorio." });
    }

    const [newFincaId] = await knex("fincas").insert({
      nombre_finca,
      ubicacion,
      user_id,
    });

    res
      .status(201)
      .json({ message: "Finca creada con éxito.", fincaId: newFincaId });
  } catch (error) {
    console.error("Error al crear finca:", error);
    res.status(500).json({ error: "Ocurrió un error en el servidor." });
  }
});

// Ruta para obtener todas las fincas de un usuario
app.get("/api/fincas", authMiddleware, async (req, res) => {
  try {
    const user_id = req.user.userId;

    const fincas = await knex("fincas").where({ user_id });

    res.json(fincas);
  } catch (error) {
    console.error("Error al obtener fincas:", error);
    res.status(500).json({ error: "Ocurrió un error en el servidor." });
  }
});

app.post("/api/fincas/:fincaId/calculos", authMiddleware, async (req, res) => {
  try {
    const { fincaId } = req.params;
    const user_id = req.user.userId;

    // 1. Verificar que la finca pertenece al usuario (seguridad)
    const finca = await knex("fincas").where({ id: fincaId, user_id }).first();
    if (!finca) {
      return res
        .status(404)
        .json({ error: "Finca no encontrada o no pertenece al usuario." });
    }

    // 2. Obtener los datos del cálculo del body
    const { nombre_calculo, tipo_canal, b, h, z, n, S, A, P, Q_m3s } = req.body;

    // 3. Validar datos (una validación simple, se puede mejorar)
    if (!tipo_canal || !h || !n || !S || !A || !P || !Q_m3s) {
      return res
        .status(400)
        .json({ error: "Faltan datos obligatorios del cálculo." });
    }

    // 4. Insertar el cálculo en la base de datos
    const [newCalculoId] = await knex("calculos").insert({
      finca_id: fincaId,
      nombre_calculo,
      tipo_canal,
      b,
      h,
      z,
      n,
      S, // Parámetros de entrada
      A,
      P,
      Q_m3s, // Resultados
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

/**
 * Ruta para obtener todos los cálculos de una finca específica.
 */
app.get("/api/fincas/:fincaId/calculos", authMiddleware, async (req, res) => {
  try {
    const { fincaId } = req.params;
    const user_id = req.user.userId;

    // 1. Verificar que la finca pertenece al usuario
    const finca = await knex("fincas").where({ id: fincaId, user_id }).first();
    if (!finca) {
      return res
        .status(404)
        .json({ error: "Finca no encontrada o no pertenece al usuario." });
    }

    // 2. Obtener todos los cálculos para esa finca
    const calculos = await knex("calculos")
      .where({ finca_id: fincaId })
      .orderBy("created_at", "desc"); // Ordenar por más reciente

    res.json(calculos);
  } catch (error) {
    console.error("Error al obtener los cálculos:", error);
    res.status(500).json({ error: "Ocurrió un error en el servidor." });
  }
});
app.put("/api/calculos/:id", authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const user_id = req.user.userId;
    const { nombre_calculo } = req.body; // Solo permitimos editar el nombre

    // 1. Verificar que el cálculo pertenezca a una finca del usuario
    const calculo = await knex("calculos")
      .join("fincas", "calculos.finca_id", "fincas.id")
      .where({ "calculos.id": id, "fincas.user_id": user_id })
      .first();

    if (!calculo) {
      return res
        .status(404)
        .json({ error: "Cálculo no encontrado o no tienes permiso." });
    }

    // 2. Actualizar
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
/**
 * Borrar una finca (y todos sus cálculos asociados)
 */
app.delete("/api/fincas/:id", authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const user_id = req.user.userId;

    // 1. Verificar que la finca sea del usuario
    const finca = await knex("fincas").where({ id, user_id }).first();

    if (!finca) {
      return res
        .status(404)
        .json({ error: "Finca no encontrada o no tienes permiso." });
    }

    // 2. BORRADO EN CASCADA MANUAL
    // Primero borramos todos los cálculos que pertenecen a esta finca
    await knex("calculos").where({ finca_id: id }).del();

    // 3. Ahora sí, borramos la finca
    await knex("fincas").where({ id }).del();

    res.json({ message: "Finca y sus cálculos eliminados correctamente." });
  } catch (error) {
    console.error("Error al eliminar finca:", error);
    res.status(500).json({ error: "Error en el servidor." });
  }
});
app.put("/api/fincas/:id", authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const user_id = req.user.userId;
    const { nombre_finca, ubicacion } = req.body;

    // 1. Verificar que la finca exista y pertenezca al usuario
    const finca = await knex("fincas").where({ id, user_id }).first();

    if (!finca) {
      return res
        .status(404)
        .json({ error: "Finca no encontrada o no tienes permiso." });
    }

    // 2. Actualizar los datos
    // Usamos update() de Knex
    await knex("fincas").where({ id }).update({
      nombre_finca,
      ubicacion,
      updated_at: knex.fn.now(), // Actualizamos la fecha de modificación
    });

    res.json({ message: "Finca actualizada correctamente." });
  } catch (error) {
    console.error("Error al actualizar finca:", error);
    res.status(500).json({ error: "Error en el servidor." });
  }
});
// Poner el servidor a escuchar
app.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
});
