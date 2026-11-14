const assert = require("node:assert/strict");
const { once } = require("node:events");
const test = require("node:test");
const { rootCertificates } = require("node:tls");
const jwt = require("jsonwebtoken");
const { readStagingEnvironment, databaseReady, createStagingServer } = require("../src/staging-server");
const { createKnexConfig } = require("../src/config/database");
const { ACTIVE_DESCRIPTOR, ACTIVE_V1, ACTIVE_V2 } = require("../src/services/irrigation-simulations.versions");

const origin = "https://frontend-staging.invalid";
const env = {
  RENDER: "true", RIEGAR_RUNTIME: "academic-staging", PORT: "4000",
  DB_NAME: "riegar_academic_staging", DB_USER: "riegar_staging_runtime", DB_HOST: "mysql.staging.invalid",
  RIEGAR_STAGING_DB_HOST: "mysql.staging.invalid", DB_PORT: "3306", DB_PASSWORD: "fixture-local",
  DB_SSL: "true", DB_SSL_VERIFY_IDENTITY: "true", DB_SSL_CA_PEM: rootCertificates[0],
  CORS_ORIGIN: origin, JWT_SECRET: "synthetic-key-used-by-offline-tests-only"
};

test("staging rejects unsafe origin, SQL identity, TLS, secrets and mail before serving", () => {
  assert.deepEqual(readStagingEnvironment(env), { port: 4000, origin, creationEnabled: false });
  assert.equal(readStagingEnvironment({ ...env, RIEGAR_DEMO_ENABLE_V2: "true" }).creationEnabled, true);
  for (const [key, value] of Object.entries({
    RENDER: "false", RIEGAR_DEMO_ENABLE_V2: "True", DB_NAME: "defaultdb", DB_HOST: "other.invalid", DB_USER: "root",
    DB_PORT: "0", DB_SSL: "false", DB_SSL_VERIFY_IDENTITY: "false", DB_SSL_CA_PATH: "second-source",
    NODE_TLS_REJECT_UNAUTHORIZED: "0", CORS_ORIGIN: "http://frontend.invalid", JWT_SECRET: "short",
    EMAIL_USER: "fixture@example.invalid", PORT: "65536"
  })) {
    assert.throws(() => readStagingEnvironment({ ...env, [key]: value }), /Configuración de staging inválida/);
  }
});

test("mysql2 options require CA and hostname verification with a valid inline PEM", () => {
  const previous = Object.fromEntries(Object.keys(env).map(key => [key, process.env[key]]));
  try {
    Object.assign(process.env, env);
    const settings = createKnexConfig().connection;
    assert.deepEqual(settings.ssl, { ca: env.DB_SSL_CA_PEM, rejectUnauthorized: true, verifyIdentity: true });
    process.env.DB_SSL_CA_PEM = "invalid CA";
    assert.throws(() => createKnexConfig(), /validate the database CA/);
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});

test("readiness verifies database and TLS on the same SQL connection and releases it on failure", async () => {
  const connection = {};
  const statements = [];
  let released = 0, cipher = "TLS_AES_256_GCM_SHA384", name = env.DB_NAME, account = "riegar_staging_runtime@%";
  const db = {
    client: {
      async acquireConnection() { return connection; },
      async releaseConnection(value) { assert.equal(value, connection); released++; },
    },
    raw(sql) {
      statements.push(sql);
      return { connection(value) {
        assert.equal(value, connection);
        return { async timeout() { return [[sql.startsWith("SELECT") ? { name, account } : { Value: cipher }]]; } };
      } };
    },
  };
  await databaseReady(db);
  cipher = "";
  await assert.rejects(databaseReady(db), /SQL readiness failed/);
  name = "defaultdb";
  cipher = "TLS_AES_256_GCM_SHA384";
  await assert.rejects(databaseReady(db), /SQL readiness failed/);
  name = env.DB_NAME;
  account = "root@localhost";
  await assert.rejects(databaseReady(db), /SQL readiness failed/);
  assert.equal(released, 4);
  assert.deepEqual([...new Set(statements)], ["SELECT DATABASE() AS name, CURRENT_USER() AS account", "SHOW SESSION STATUS LIKE 'Ssl_cipher'"]);
});

test("staging HTTP gates, readiness and shutdown use real HTTP with zero database or mail calls", async () => {
  assert.equal(ACTIVE_DESCRIPTOR, ACTIVE_V1);
  const filename = require.resolve("../src/config/knex");
  let queries = 0, mailCalls = 0, closed = 0, ready = true;
  const logs = [];
  require.cache[filename] = { id: filename, filename, loaded: true, exports: () => { queries++; throw new Error("Unexpected SQL"); } };
  const nodemailer = require("nodemailer");
  const createTransport = nodemailer.createTransport;
  const priorSecret = process.env.JWT_SECRET;
  nodemailer.createTransport = () => { mailCalls++; throw new Error("Unexpected mail"); };
  process.env.JWT_SECRET = env.JWT_SECRET;
  const { createApp } = require("../src/app");
  const log = entry => logs.push(entry);
  const app = createApp({ staging: { origin, ready: async () => { if (!ready) throw new Error("internal cause"); }, log } });
  const { server, close } = createStagingServer({ app, destroyDatabase: async () => { closed++; }, log });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const api = "http://127.0.0.1:" + server.address().port;
  const request = (path, options) => fetch(api + path, options);
  const token = jwt.sign({ userId: 7 }, env.JWT_SECRET, { expiresIn: "5m" });
  const authorization = "Bearer " + token;
  try {
    assert.equal((await request("/api/health")).status, 200);
    const healthy = await request("/api/ready");
    assert.equal(healthy.status, 200);
    assert.equal(healthy.headers.get("cache-control"), "no-store");
    ready = false;
    const unavailable = await request("/api/ready");
    assert.equal(unavailable.status, 503);
    assert.deepEqual(await unavailable.json(), { status: "unavailable" });
    const cors = await request("/api/fincas", { method: "OPTIONS", headers: { Origin: origin, "Access-Control-Request-Method": "GET" } });
    assert.equal(cors.status, 204);
    assert.equal(cors.headers.get("access-control-allow-origin"), origin);
    assert.equal((await request("/api/register", { method: "POST", headers: { Origin: "https://other.invalid" } })).status, 403);
    const mail = await request("/api/CONTACT/", { method: "POST" });
    assert.equal(mail.status, 503);
    assert.equal((await mail.json()).code, "STAGING_CONTACT_DISABLED");
    const capability = "/api/capabilities/irrigation";
    assert.equal((await request(capability)).status, 401);
    const declared = await request(capability, { headers: { authorization } });
    assert.equal(declared.headers.get("cache-control"), "no-store");
    assert.deepEqual(await declared.json(), { contractVersion: ACTIVE_V1.contractVersion,
      modelVersion: ACTIVE_V1.modelVersion, sourceHash: ACTIVE_V1.sourceHash, creationEnabled: false });
    const blocked = await request("/api/fincas/1/irrigation-simulations?version=v2", { method: "POST", headers: { authorization } });
    assert.equal(blocked.status, 403);
    assert.equal((await blocked.json()).code, "SIMULATION_CREATION_DISABLED");
    const enabled = createApp({ staging: { origin, ready: async () => {}, log, creationEnabled: true } });
    const demo = enabled.listen(0, "127.0.0.1");
    try {
      await once(demo, "listening");
      const demoOrigin = "http://127.0.0.1:" + demo.address().port;
      const declaredV2 = await fetch(demoOrigin + capability, { headers: { authorization } });
      assert.deepEqual(await declaredV2.json(), { contractVersion: ACTIVE_V2.contractVersion,
        modelVersion: ACTIVE_V2.modelVersion, sourceHash: ACTIVE_V2.sourceHash, creationEnabled: true });
      const invalid = await fetch(demoOrigin + "/api/fincas/1/irrigation-simulations?version=v1", { method: "POST",
        headers: { authorization, "Content-Type": "application/json" }, body: "{}" });
      assert.equal(invalid.status, 400);
    } finally {
      await new Promise((resolve, reject) => demo.close(error => error ? reject(error) : resolve()));
    }
    assert.deepEqual([queries, mailCalls], [0, 0]);
  } finally {
    await Promise.all([close("SIGTERM"), close("SIGTERM")]);
    nodemailer.createTransport = createTransport;
    if (priorSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = priorSecret;
  }
  assert.equal(closed, 1);
  assert.equal(server.listening, false);
  assert.equal(logs.filter(row => row.event === "staging_shutdown").length, 1);
  assert.ok(!JSON.stringify(logs).includes(token));
  assert.ok(logs.filter(row => row.event === "staging_request").every(row => Object.keys(row).sort().join(",") === "durationMs,event,status"));
});
