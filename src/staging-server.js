const http = require("node:http");
const { isIP } = require("node:net");
const { validateDatabaseConfig } = require("./config/database");

function validOrigin(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.origin === value;
  } catch {
    return false;
  }
}

function readStagingEnvironment(env) {
  const requireValue = (condition, name) => {
    if (!condition) throw new Error(`Configuración de staging inválida en ${name}`);
  };
  requireValue(env.RENDER === "true" && env.RIEGAR_RUNTIME === "academic-staging", "entorno");
  requireValue(env.DB_NAME === "riegar_academic_staging" && env.DB_USER === "riegar_staging_runtime", "identidad SQL");
  requireValue(/^(?=.{1,253}$)[a-z0-9-]+(?:\.[a-z0-9-]+)+$/i.test(env.DB_HOST || "") &&
    !isIP(env.DB_HOST) && env.DB_HOST === env.RIEGAR_STAGING_DB_HOST, "host SQL");
  requireValue(/^\d+$/.test(env.DB_PORT || "") && Number(env.DB_PORT) >= 1 &&
    Number(env.DB_PORT) <= 65535 && Boolean(env.DB_PASSWORD), "credenciales SQL");
  requireValue(env.DB_SSL === "true" && env.DB_SSL_VERIFY_IDENTITY === "true" &&
    env.NODE_TLS_REJECT_UNAUTHORIZED !== "0" && Boolean(env.DB_SSL_CA_PEM) !== Boolean(env.DB_SSL_CA_PATH), "TLS SQL");
  requireValue(typeof env.JWT_SECRET === "string" && Buffer.byteLength(env.JWT_SECRET) >= 32, "JWT_SECRET");
  requireValue(validOrigin(env.CORS_ORIGIN), "CORS_ORIGIN");
  requireValue(/^\d+$/.test(env.PORT || "") && Number(env.PORT) >= 1 && Number(env.PORT) <= 65535, "PORT");
  requireValue(!env.EMAIL_USER && !env.EMAIL_PASS, "correo deshabilitado");
  requireValue(env.RIEGAR_DEMO_ENABLE_V2 === undefined ||
    ["false", "true"].includes(env.RIEGAR_DEMO_ENABLE_V2), "RIEGAR_DEMO_ENABLE_V2");
  return { port: Number(env.PORT), origin: env.CORS_ORIGIN, creationEnabled: env.RIEGAR_DEMO_ENABLE_V2 === "true" };
}

async function databaseReady(db) {
  const connection = await db.client.acquireConnection();
  try {
    const [[identity]] = await db.raw("SELECT DATABASE() AS name, CURRENT_USER() AS account").connection(connection).timeout(4000);
    const [[cipher]] = await db.raw("SHOW SESSION STATUS LIKE 'Ssl_cipher'").connection(connection).timeout(4000);
    if (identity?.name !== "riegar_academic_staging" ||
      !identity.account?.startsWith("riegar_staging_runtime@") || !cipher?.Value) {
      throw new Error("SQL readiness failed");
    }
  } finally {
    await db.client.releaseConnection(connection);
  }
}

function createStagingServer({ app, destroyDatabase, log = entry => console.log(JSON.stringify(entry)) }) {
  const server = http.createServer(app);
  let closing;
  function close(signal) {
    if (closing) return closing;
    closing = (async () => {
      const deadline = setTimeout(() => server.closeAllConnections(), 10000);
      deadline.unref();
      try {
        try {
          await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
        } finally {
          await destroyDatabase();
        }
        log({ event: "staging_shutdown", signal });
      } finally {
        clearTimeout(deadline);
      }
    })();
    return closing;
  }
  return { server, close };
}

async function main() {
  const settings = readStagingEnvironment(process.env);
  validateDatabaseConfig();
  const db = require("./config/knex");
  try {
    await databaseReady(db);
  } catch (error) {
    await db.destroy();
    throw error;
  }
  const { createApp } = require("./app");
  const log = event => console.log(JSON.stringify(event));
  const app = createApp({ staging: { origin: settings.origin, creationEnabled: settings.creationEnabled, ready: () => databaseReady(db), log } });
  const { server, close } = createStagingServer({ app, destroyDatabase: () => db.destroy(), log });
  server.once("error", () => {
    console.error(JSON.stringify({ event: "staging_listener_failed" }));
    process.exitCode = 1;
    db.destroy().catch(() => {});
  });
  server.listen(settings.port, "0.0.0.0", () => log({ event: "staging_listening", port: settings.port }));
  for (const signal of ["SIGTERM", "SIGINT"]) {
    process.once(signal, () => {
      close(signal).catch(() => {
        console.error(JSON.stringify({ event: "staging_shutdown_failed" }));
        process.exitCode = 1;
      });
    });
  }
}

if (require.main === module) main().catch(() => {
  console.error(JSON.stringify({ event: "staging_start_failed" }));
  process.exitCode = 1;
});

module.exports = { readStagingEnvironment, databaseReady, createStagingServer };
