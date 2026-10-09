const express = require("express");
const cors = require("cors");
const authRoutes = require("./routes/auth.routes");
const fincasRoutes = require("./routes/fincas.routes");
const calculosRoutes = require("./routes/calculos.routes");
const contactRoutes = require("./routes/contact.routes");

const app = express();
const allowedOrigins = (process.env.CORS_ORIGIN || "").split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      return callback(new Error("Origin not allowed by CORS"));
    },
  })
);
app.use(express.json());

app.get("/", (req, res) => {
  res.send("¡Hola Mundo desde el backend de RiegAR!");
});

app.get("/api/health", (req, res) => {
  res.status(200).json({ status: "ok" });
});

app.use(authRoutes);
app.use(fincasRoutes);
app.use(calculosRoutes);
app.use(contactRoutes);

app.use((error, req, res, next) => {
  if (error.type === "entity.parse.failed" && error.status === 400) {
    return res.status(400).json({
      error: "El cuerpo de la solicitud debe contener JSON válido.",
      code: "invalid_input",
    });
  }
  next(error);
});

module.exports = app;
