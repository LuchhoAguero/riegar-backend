const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const path = require("node:path");
const { rootCertificates } = require("node:tls");
const test = require("node:test");
const { readStagingEnvironment, startupFailure } = require("../src/staging-server");

const env = {
  RENDER: "true", RIEGAR_RUNTIME: "academic-staging", PORT: "10000",
  DB_NAME: "riegar_academic_staging", DB_USER: "riegar_staging_runtime",
  DB_HOST: "mysql.fixture.invalid", RIEGAR_STAGING_DB_HOST: "mysql.fixture.invalid",
  DB_PORT: "3306", DB_PASSWORD: "private-password-fixture", DB_SSL: "true", DB_SSL_VERIFY_IDENTITY: "true",
  DB_SSL_CA_PEM: rootCertificates[0], JWT_SECRET: "private-jwt-fixture-with-at-least-32-bytes",
  CORS_ORIGIN: "https://xn--riegar-acadmico-lnb.netlify.app",
};

test("an accented origin requires its ASCII serialization without relaxing the HTTPS origin guard", () => {
  const unicode = "https://riegar-académico.netlify.app";
  const ascii = new URL(unicode).origin;
  assert.equal(ascii, env.CORS_ORIGIN);
  assert.equal(readStagingEnvironment({ ...env, CORS_ORIGIN: ascii }).origin, ascii);
  for (const value of [unicode, ascii + "/", ascii + "/ruta", ascii + "?x=1", ascii + "#fragment", " " + ascii,
    "https://user:password@riegar.example", "http://riegar.example", ascii + ",https://other.example", undefined]) {
    assert.throws(() => readStagingEnvironment({ ...env, CORS_ORIGIN: value }),
      error => error.code === "STAGING_ENVIRONMENT_INVALID" && error.field === "CORS_ORIGIN");
  }
});

test("missing required variables identify only the field name", () => {
  for (const key of Object.keys(env)) {
    const invalid = { ...env };
    delete invalid[key];
    assert.throws(() => readStagingEnvironment(invalid), error => {
      const result = startupFailure(error, "environment");
      assert.equal(result.code, "STAGING_ENVIRONMENT_INVALID");
      assert.ok(result.field);
      assert.ok(!JSON.stringify(result).includes(env.DB_PASSWORD));
      assert.ok(!JSON.stringify(result).includes(env.JWT_SECRET));
      assert.ok(!JSON.stringify(result).includes(env.DB_SSL_CA_PEM));
      return true;
    });
  }
});

test("startup errors classify SQL, TLS, identity and network without logging provider messages or secrets", () => {
  const categories = {
    ER_ACCESS_DENIED_ERROR: "database_authentication", ER_DBACCESS_DENIED_ERROR: "database_permissions",
    ER_BAD_DB_ERROR: "database_missing", ENOTFOUND: "database_dns", ECONNREFUSED: "database_connection",
    ETIMEDOUT: "database_connection", DB_CA_INVALID: "tls_certificate", HANDSHAKE_SSL_ERROR: "tls_connection",
    ERR_TLS_CERT_ALTNAME_INVALID: "tls_hostname", STAGING_SQL_IDENTITY_INVALID: "database_identity",
    STAGING_SQL_TLS_MISSING: "tls_connection",
  };
  for (const [code, category] of Object.entries(categories)) {
    const error = Object.assign(new Error(env.DB_PASSWORD + env.JWT_SECRET + env.DB_SSL_CA_PEM),
      { code, sql: "SELECT secret", sqlMessage: env.DB_PASSWORD, address: "sensitive-host", field: env.DB_PASSWORD });
    assert.deepEqual(startupFailure(error, "database_preflight"), {
      event: "staging_start_failed", stage: "database_preflight", category, code,
    });
  }
  const unexpected = Object.assign(new Error(env.DB_PASSWORD), { code: env.JWT_SECRET });
  assert.equal(startupFailure(unexpected, "application").code, "UNCLASSIFIED");
  assert.equal(startupFailure(Object.assign(new Error(), { name: "KnexTimeoutError" }), "database_preflight").code,
    "KNEX_ACQUIRE_TIMEOUT");
});

function runServer(changes) {
  const clean = Object.fromEntries(Object.entries(process.env).filter(([key]) =>
    !/^(DB_|MYSQL|JWT_|EMAIL_|SMTP|RIEGAR_|RENDER|PORT$|CORS_|NODE_|DOTENV)/i.test(key)));
  const result = spawnSync(process.execPath, ["src/staging-server.js"], {
    cwd: path.resolve(__dirname, ".."), env: { ...clean, ...env, ...changes },
    encoding: "utf8", timeout: 10000, windowsHide: true,
  });
  assert.equal(result.error, undefined);
  assert.equal(result.status, 1);
  assert.equal(result.stdout, "");
  assert.equal(result.stderr.trim().split("\n").length, 1);
  assert.ok(!result.stderr.includes(env.DB_PASSWORD));
  assert.ok(!result.stderr.includes(env.JWT_SECRET));
  assert.ok(!result.stderr.includes(rootCertificates[0]));
  return JSON.parse(result.stderr);
}

test("real entrypoint reports an invalid CORS setting before opening a SQL connection", () => {
  assert.deepEqual(runServer({ CORS_ORIGIN: "https://riegar-académico.netlify.app" }), {
    event: "staging_start_failed", stage: "environment", category: "environment",
    code: "STAGING_ENVIRONMENT_INVALID", field: "CORS_ORIGIN",
  });
});

test("real entrypoint reports malformed, escaped-newline and missing-file CA before connecting", () => {
  for (const settings of [
    { DB_SSL_CA_PEM: "synthetic-invalid-CA" },
    { DB_SSL_CA_PEM: rootCertificates[0].replaceAll("\n", "\\n") },
    { DB_SSL_CA_PEM: "", DB_SSL_CA_PATH: path.join(__dirname, "nonexistent-ca-file.fixture") },
  ]) {
    assert.deepEqual(runServer(settings), {
      event: "staging_start_failed", stage: "database_configuration", category: "tls_certificate", code: "DB_CA_INVALID",
    });
  }
});
