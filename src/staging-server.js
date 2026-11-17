const http = require("node:http");
const { isIP } = require("node:net");
const { validateDatabaseConfig } = require("./config/database");

const STARTUP_ERROR_CATEGORIES = Object.freeze({
  STAGING_ENVIRONMENT_INVALID: "environment",
  DB_CA_INVALID: "tls_certificate",
  STAGING_SQL_IDENTITY_INVALID: "database_identity",
  STAGING_SQL_TLS_MISSING: "tls_connection",
  ER_ACCESS_DENIED_ERROR: "database_authentication",
  ER_DBACCESS_DENIED_ERROR: "database_permissions",
  ER_TABLEACCESS_DENIED_ERROR: "database_permissions",
  ER_SPECIFIC_ACCESS_DENIED_ERROR: "database_permissions",
  ER_ACCOUNT_HAS_BEEN_LOCKED: "database_authentication",
  ER_BAD_DB_ERROR: "database_missing",
  ENOTFOUND: "database_dns",
  EAI_AGAIN: "database_dns",
  ECONNREFUSED: "database_connection",
  ETIMEDOUT: "database_connection",
  ECONNRESET: "database_connection",
  PROTOCOL_CONNECTION_LOST: "database_connection",
  HANDSHAKE_SSL_ERROR: "tls_connection",
  ERR_TLS_CERT_ALTNAME_INVALID: "tls_hostname",
  CERT_HAS_EXPIRED: "tls_certificate",
  UNABLE_TO_VERIFY_LEAF_SIGNATURE: "tls_certificate",
  UNABLE_TO_GET_ISSUER_CERT_LOCALLY: "tls_certificate",
  SELF_SIGNED_CERT_IN_CHAIN: "tls_certificate",
  DEPTH_ZERO_SELF_SIGNED_CERT: "tls_certificate",
});
const ENVIRONMENT_FIELDS = new Set([
  "RENDER", "RIEGAR_RUNTIME", "DB_NAME", "DB_USER", "DB_HOST", "RIEGAR_STAGING_DB_HOST",
  "DB_PORT", "DB_PASSWORD", "DB_SSL", "DB_SSL_VERIFY_IDENTITY", "NODE_TLS_REJECT_UNAUTHORIZED",
  "DB_SSL_CA_PEM", "DB_SSL_CA_PATH", "JWT_SECRET", "CORS_ORIGIN", "PORT", "EMAIL_USER", "EMAIL_PASS",
  "RIEGAR_DEMO_ENABLE_V2",
]);

function startupFailure(error, stage) {
  const code = Object.hasOwn(STARTUP_ERROR_CATEGORIES, error?.code) ? error.code : "UNCLASSIFIED";
  const failure = { event: "staging_start_failed", stage,
    category: STARTUP_ERROR_CATEGORIES[code] || stage, code };
  if (ENVIRONMENT_FIELDS.has(error?.field)) failure.field = error.field;
  if (error?.name === "KnexTimeoutError") {
    failure.code = "KNEX_ACQUIRE_TIMEOUT";
    failure.category = "database_connection";
  }
  return failure;
}

function validOrigin(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.origin === value;
  } catch {
    return false;
  }
}

function readStagingEnvironment(env) {
  const requireValue = (condition, field) => {
    if (!condition) throw Object.assign(new Error(`Configuración de staging inválida en ${field}`),
      { code: "STAGING_ENVIRONMENT_INVALID", field });
  };
  requireValue(env.RENDER === "true", "RENDER");
  requireValue(env.RIEGAR_RUNTIME === "academic-staging", "RIEGAR_RUNTIME");
  requireValue(env.DB_NAME === "riegar_academic_staging", "DB_NAME");
  requireValue(env.DB_USER === "riegar_staging_runtime", "DB_USER");
  requireValue(/^(?=.{1,253}$)[a-z0-9-]+(?:\.[a-z0-9-]+)+$/i.test(env.DB_HOST || "") &&
    !isIP(env.DB_HOST), "DB_HOST");
  requireValue(env.DB_HOST === env.RIEGAR_STAGING_DB_HOST, "RIEGAR_STAGING_DB_HOST");
  requireValue(/^\d+$/.test(env.DB_PORT || "") && Number(env.DB_PORT) >= 1 &&
    Number(env.DB_PORT) <= 65535, "DB_PORT");
  requireValue(Boolean(env.DB_PASSWORD), "DB_PASSWORD");
  requireValue(env.DB_SSL === "true", "DB_SSL");
  requireValue(env.DB_SSL_VERIFY_IDENTITY === "true", "DB_SSL_VERIFY_IDENTITY");
  requireValue(env.NODE_TLS_REJECT_UNAUTHORIZED !== "0", "NODE_TLS_REJECT_UNAUTHORIZED");
  requireValue(Boolean(env.DB_SSL_CA_PEM) !== Boolean(env.DB_SSL_CA_PATH), "DB_SSL_CA_PEM");
  requireValue(typeof env.JWT_SECRET === "string" && Buffer.byteLength(env.JWT_SECRET) >= 32, "JWT_SECRET");
  requireValue(validOrigin(env.CORS_ORIGIN), "CORS_ORIGIN");
  requireValue(/^\d+$/.test(env.PORT || "") && Number(env.PORT) >= 1 && Number(env.PORT) <= 65535, "PORT");
  requireValue(!env.EMAIL_USER, "EMAIL_USER");
  requireValue(!env.EMAIL_PASS, "EMAIL_PASS");
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
      !identity.account?.startsWith("riegar_staging_runtime@")) {
      throw Object.assign(new Error("SQL readiness failed"), { code: "STAGING_SQL_IDENTITY_INVALID" });
    }
    if (!cipher?.Value) {
      throw Object.assign(new Error("SQL readiness failed"), { code: "STAGING_SQL_TLS_MISSING" });
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
  let stage = "environment";
  let db;
  try {
    const settings = readStagingEnvironment(process.env);
    stage = "database_configuration";
    validateDatabaseConfig();
    stage = "database_pool";
    db = require("./config/knex");
    stage = "database_preflight";
    await databaseReady(db);
    stage = "application";
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
  } catch (error) {
    console.error(JSON.stringify(startupFailure(error, stage)));
    process.exitCode = 1;
    if (db) await db.destroy().catch(() => {});
  }
}

if (require.main === module) main();

module.exports = { readStagingEnvironment, databaseReady, createStagingServer, startupFailure };
