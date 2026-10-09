const { test, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const jwt = require("jsonwebtoken");

// Module-local replacement: production routes/auth are unchanged, no DB/env file read.
const state = { queries: [], inserts: [], updates: [], deletes: [], rows: [], finca: true, failInsert: false };
function fakeKnex(table) {
  const query = { table, filters: {} };
  state.queries.push(query);
  const chain = {
    where(filters) { query.filters = filters; return chain; },
    join(...args) { query.join = args; return chain; },
    async first() { return state.finca ? { id: 7, user_id: 42 } : undefined; },
    async insert(row) {
      if (state.failInsert) throw new Error("Simulated insert failure");
      state.inserts.push({ table, row }); return [123];
    },
    async orderBy(...args) { query.order = args; return state.rows; },
    async update(row) { state.updates.push({ table, filters: query.filters, row }); return 1; },
    async del() { state.deletes.push({ table, filters: query.filters }); return 1; },
  };
  return chain;
}
fakeKnex.fn = { now: () => "database-now" };
const knexPath = require.resolve("../src/config/knex");
require.cache[knexPath] = { id: knexPath, filename: knexPath, loaded: true, exports: fakeKnex };

process.env.JWT_SECRET = "m1-test-only-secret";
process.env.CORS_ORIGIN = "http://localhost:5173";
process.env.NODE_ENV = "test";
const nodemailer = require("nodemailer");
const originalTransport = nodemailer.createTransport;
let mailCalls = 0;
nodemailer.createTransport = () => ({ async sendMail() { mailCalls++; } });
const app = require("../src/app");
const { calculateManning } = require("../src/services/manning.service");
const input = { tipo_canal: "rectangular", b: 1, h: 0.5, n: 0.012, S: 0.001 };
const path = "/api/fincas/7/calculos";
let server;
let url;
let token;
before(async () => {
  token = jwt.sign({ userId: 42 }, process.env.JWT_SECRET, { expiresIn: "1h" });
  server = app.listen(0, "127.0.0.1");
  await new Promise((resolve, reject) => { server.once("listening", resolve); server.once("error", reject); });
  url = `http://127.0.0.1:${server.address().port}`;
});
after(async () => {
  nodemailer.createTransport = originalTransport;
  await new Promise((resolve) => server.close(resolve));
});
beforeEach(() => {
  for (const field of ["queries", "inserts", "updates", "deletes", "rows"]) state[field] = [];
  state.finca = true; state.failInsert = false; mailCalls = 0;
});
async function request(route = path, body = input, options = {}) {
  const headers = { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...options.headers };
  if (options.withoutToken) delete headers.Authorization;
  const response = await fetch(url + route, {
    method: options.method || "POST",
    headers,
    ...(options.method === "GET" ? {} : { body: options.raw === undefined ? JSON.stringify(body) : options.raw }),
  });
  const text = await response.text();
  return { status: response.status, headers: response.headers, body: response.headers.get("content-type")?.includes("application/json") ? JSON.parse(text) : text };
}

test("own finca: primary-only payload persists server result and returns canonical calculation", async () => {
  const response = await request();
  assert.equal(response.status, 201);
  assert.equal(response.body.calculoId, 123);
  assert.equal(response.body.message, "Cálculo guardado con éxito.");
  const result = calculateManning(input);
  assert.deepEqual(response.body.calculo, { nombre_calculo: "Cálculo sin nombre", ...result });
  const { R, V, ...stored } = result;
  assert.deepEqual(state.inserts, [{ table: "calculos", row: { finca_id: "7", nombre_calculo: "Cálculo sin nombre", ...stored } }]);
  assert.deepEqual(state.queries[0], { table: "fincas", filters: { id: "7", user_id: 42 } });
});
test("legacy forged derivatives ignored for response and insert", async () => {
  const response = await request(path, { ...input, z: -999, A: 999999, P: 1, Q_m3s: 123456, R: 100, V: 100 });
  assert.equal(response.status, 201);
  assert.equal(response.body.calculo.Q_m3s, calculateManning(input).Q_m3s);
  assert.equal(state.inserts[0].row.Q_m3s, calculateManning(input).Q_m3s);
  assert.equal(state.inserts[0].row.A, 0.5);
  assert.equal(state.inserts[0].row.P, 2);
  assert.equal(state.inserts[0].row.z, null);
});
test("triangular normalizes b and persists only current columns", async () => {
  const response = await request(path, { ...input, tipo_canal: "triangular", z: 1, b: "unused" });
  assert.equal(response.status, 201);
  assert.equal(state.inserts[0].row.b, null);
  assert.ok(!("R" in state.inserts[0].row) && !("V" in state.inserts[0].row));
});
test("trapezoidal z=0 saves", async () => {
  assert.equal((await request(path, { ...input, tipo_canal: "trapezoidal", z: 0 })).status, 201);
});
test("missing/foreign finca: 404 before validating payload, no insert", async () => {
  state.finca = false;
  const response = await request(path, {});
  assert.equal(response.status, 404);
  assert.equal(state.inserts.length, 0);
  assert.deepEqual(state.queries[0].filters, { id: "7", user_id: 42 });
});
test("invalid/incomplete payload: 400 with compatible error and no insert", async () => {
  for (const body of [{}, null, [], { ...input, n: "0.012" }, { ...input, h: null }, { ...input, b: false }, { ...input, tipo_canal: "triangular", z: 0 }]) {
    const response = await request(path, body);
    assert.equal(response.status, 400);
    assert.equal(response.body.code, "invalid_input");
    assert.equal(typeof response.body.error, "string");
  }
  assert.equal(state.inserts.length, 0);
});
test("derived overflow: 422 and no insert", async () => {
  const response = await request(path, { ...input, b: Number.MAX_VALUE, h: 2 });
  assert.equal(response.status, 422);
  assert.equal(response.body.code, "invalid_geometry");
  assert.equal(state.inserts.length, 0);
});
test("optional name: default, trim and VARCHAR(255) boundary", async () => {
  assert.equal((await request(path, { ...input, nombre_calculo: "  Norte  " })).body.calculo.nombre_calculo, "Norte");
  assert.equal((await request(path, { ...input, nombre_calculo: "a".repeat(255) })).status, 201);
  for (const nombre_calculo of [" ", "a".repeat(256), null, 7, true]) {
    const response = await request(path, { ...input, nombre_calculo });
    assert.equal(response.status, 400);
    assert.ok(response.body.fields.nombre_calculo);
  }
  assert.equal(state.inserts.length, 2);
});
test("401 without token; no ownership query or insert", async () => {
  assert.equal((await request(path, input, { withoutToken: true })).status, 401);
  assert.equal(state.queries.length, 0);
});
test("403 invalid/expired token; no ownership query or insert", async () => {
  const expired = jwt.sign({ userId: 42 }, process.env.JWT_SECRET, { expiresIn: -1 });
  for (const value of ["invalid", expired]) {
    assert.equal((await request(path, input, { headers: { Authorization: `Bearer ${value}` } })).status, 403);
  }
  assert.equal(state.queries.length, 0);
});
test("malformed JSON: generic JSON error without stack or body echo", async () => {
  const response = await request(path, undefined, { raw: '{"sensitive-marker":' });
  assert.equal(response.status, 400);
  assert.deepEqual(response.body, { error: "El cuerpo de la solicitud debe contener JSON válido.", code: "invalid_input" });
  assert.equal(state.queries.length, 0);
});
test("non-object JSON rejected safely", async () => {
  assert.equal((await request(path, undefined, { raw: '"string"' })).status, 400);
  assert.equal(state.inserts.length, 0);
});
test("failed insert does not send canonical success", async () => {
  state.failInsert = true;
  const originalError = console.error;
  console.error = () => {};
  try {
    const response = await request();
    assert.equal(response.status, 500);
    assert.deepEqual(response.body, { error: "Ocurrió un error en el servidor." });
    assert.equal(state.inserts.length, 0);
  } finally { console.error = originalError; }
});
test("history GET keeps ownership and descending creation order", async () => {
  state.rows = [{ id: 123, Q_m3s: "0.522896" }];
  const response = await request(path, undefined, { method: "GET" });
  assert.equal(response.status, 200);
  assert.deepEqual(response.body, state.rows);
  assert.deepEqual(state.queries[0].filters, { id: "7", user_id: 42 });
  assert.deepEqual(state.queries[1], { table: "calculos", filters: { finca_id: "7" }, order: ["created_at", "desc"] });
});
test("PUT name keeps ownership and only updates name/timestamp", async () => {
  assert.equal((await request("/api/calculos/123", { nombre_calculo: "Nuevo" }, { method: "PUT" })).status, 200);
  assert.deepEqual(state.queries[0].filters, { "calculos.id": "123", "fincas.user_id": 42 });
  assert.deepEqual(state.updates, [{ table: "calculos", filters: { id: "123" }, row: { nombre_calculo: "Nuevo", updated_at: "database-now" } }]);
});
test("DELETE keeps ownership and deletes requested calculation only", async () => {
  assert.equal((await request("/api/calculos/123", undefined, { method: "DELETE" })).status, 200);
  assert.deepEqual(state.queries[0].filters, { "calculos.id": "123", "fincas.user_id": 42 });
  assert.deepEqual(state.deletes, [{ table: "calculos", filters: { id: "123" } }]);
});
test("GET/PUT/DELETE refuse foreign finca/calculation", async () => {
  state.finca = false;
  for (const [route, method] of [[path, "GET"], ["/api/calculos/123", "PUT"], ["/api/calculos/123", "DELETE"]]) {
    assert.equal((await request(route, { nombre_calculo: "X" }, { method })).status, 404);
  }
  assert.equal(state.updates.length + state.deletes.length, 0);
});
test("contact validation and send path preserved (SMTP mocked, no mail sent)", async () => {
  assert.equal((await request("/api/contact", {})).status, 400);
  assert.equal((await request("/api/contact", { name: "Test", email: "test@example.invalid", message: "Test" })).status, 200);
  assert.equal(mailCalls, 1);
});
test("CORS allowed origin and preflight preserved", async () => {
  const response = await request("/api/health", undefined, { method: "GET", headers: { Origin: "http://localhost:5173" } });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("access-control-allow-origin"), "http://localhost:5173");
  const preflight = await request(path, undefined, { method: "OPTIONS", headers: { Origin: "http://localhost:5173", "Access-Control-Request-Method": "POST" } });
  assert.equal(preflight.status, 204);
});
test("JSON handler passes other errors through (disallowed CORS)", async () => {
  const originalError = console.error;
  console.error = () => {};
  try {
    const response = await request("/api/health", undefined, { method: "GET", headers: { Origin: "https://untrusted.example.invalid" } });
    assert.equal(response.status, 500);
    assert.equal(response.headers.get("access-control-allow-origin"), null);
  } finally { console.error = originalError; }
});
test("health, root and public login validation still mounted", async () => {
  assert.deepEqual((await request("/api/health", undefined, { method: "GET" })).body, { status: "ok" });
  assert.equal((await request("/", undefined, { method: "GET" })).status, 200);
  assert.equal((await request("/api/login", {})).status, 400);
  assert.equal((await request("/api/register", {})).status, 400);
});
