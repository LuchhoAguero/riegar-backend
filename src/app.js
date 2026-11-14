const express = require("express");
const cors = require("cors");
const authRoutes = require("./routes/auth.routes");
const fincasRoutes = require("./routes/fincas.routes");
const calculosRoutes = require("./routes/calculos.routes");
const contactRoutes = require("./routes/contact.routes");
const irrigationSimulationRoutes = require("./routes/irrigation-simulations.routes");
const auth = require("./middleware/auth.middleware");
const { createIrrigationSimulationRouter } = require("./routes/irrigation-simulations.router");
const { ACTIVE_DESCRIPTOR, ACTIVE_V2 } = require("./services/irrigation-simulations.versions");

function installStagingRoutes(app, { origin, ready, log, creationEnabled }, descriptor) {
  app.disable("x-powered-by");
  app.use((req, res, next) => {
    const started = Date.now();
    res.set("Cache-Control", "no-store");
    res.on("finish", () => log({ event: "staging_request", status: res.statusCode, durationMs: Date.now() - started }));
    const incoming = req.get("Origin");
    if (incoming && incoming !== origin) {
      return res.status(403).json({ error: "Origen no permitido.", code: "ORIGIN_NOT_ALLOWED" });
    }
    next();
  });
  app.use(cors({ origin, methods: ["GET", "HEAD", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"] }));

  app.get("/api/ready", async (req, res) => {
    try {
      await ready();
      res.json({ status: "ready" });
    } catch {
      res.status(503).json({ status: "unavailable" });
    }
  });
  app.post("/api/contact", (req, res) => {
    res.status(503).json({ error: "El correo está deshabilitado en staging.", code: "STAGING_CONTACT_DISABLED" });
  });
  app.get("/api/capabilities/irrigation", auth, (req, res) => {
    res.json({
      contractVersion: descriptor.contractVersion,
      modelVersion: descriptor.modelVersion,
      sourceHash: descriptor.sourceHash,
      creationEnabled: creationEnabled === true,
    });
  });
  if (creationEnabled !== true) {
    app.post("/api/fincas/:fincaId/irrigation-simulations", auth, (req, res) => {
      res.status(403).json({ error: "La creación de simulaciones está deshabilitada en staging.", code: "SIMULATION_CREATION_DISABLED" });
    });
  }
}

function installDefaultCors(app) {
  const allowedOrigins = (process.env.CORS_ORIGIN || "").split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
  app.use(cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      return callback(new Error("Origin not allowed by CORS"));
    },
  }));
}

function createApp({ staging } = {}) {
  const app = express();
  const descriptor = staging?.creationEnabled === true ? ACTIVE_V2 : ACTIVE_DESCRIPTOR;
  if (staging) installStagingRoutes(app, staging, descriptor);
  else installDefaultCors(app);
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
  if (!staging) app.use(contactRoutes);
  app.use(descriptor === ACTIVE_V2
    ? createIrrigationSimulationRouter(require("./config/knex"), { descriptor })
    : irrigationSimulationRoutes);

  app.use((error, req, res, next) => {
    if (error.type === "entity.too.large" && /^\/api\/fincas\/[^/]+\/irrigation-simulations(?:\/|$)/.test(req.path)) {
      return res.status(413).json({ error: "El cuerpo de la solicitud excede el límite permitido.", code: "PAYLOAD_TOO_LARGE" });
    }
    if (error.type === "entity.parse.failed" && error.status === 400) {
      return res.status(400).json({ error: "El cuerpo de la solicitud debe contener JSON válido.", code: "invalid_input" });
    }
    if (staging) {
      if (res.headersSent) return res.destroy();
      return res.status(500).json({ error: "Ocurrió un error en el servidor.", code: "INTERNAL_ERROR" });
    }
    next(error);
  });
  return app;
}

module.exports = createApp();
module.exports.createApp = createApp;
