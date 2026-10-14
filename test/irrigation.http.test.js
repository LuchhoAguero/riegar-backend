const { test, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const jwt = require("jsonwebtoken");
const { calculateIrrigationSimulation: calculate } = require("../src/services/irrigation/irrigation-calculator.service");
const { mapCalculationToSnapshot } = require("../src/services/irrigation-simulations.mapper");
const date = new Date("2026-10-13T15:30:45.123Z");
function input() {
  return { crop: { etoMmPerDay: 5, cropCoefficient: 0.7, daysWithoutIrrigation: 20 },
    soil: { texture: "Franco", fieldCapacityPct: 20, wiltingPointPct: 10, bulkDensityGcm3: 1.3, rootDepthM: 0.7, depletionThresholdPct: 60 },
    furrow: { widthM: 1.3, lengthM: 60, slopePct: 0 }, irrigation: { flowLps: 0.9, durationMin: 60, advanceTimeMin: 4.8 } };
}
function row(id, fincaId = 7) { return { id, ...mapCalculationToSnapshot({ fincaId, calculationResult: calculate(input()), createdAt: date }) }; }
const state = {};
function connection(data, scope) {
  return table => {
    const q = { table, scope, filters: {}, orders: [] }; state.queries.push(q);
    function selected() {
      const rows = table === "fincas" ? data.farms : data.rows;
      return rows.filter(r => Object.entries(q.filters).every(([key, value]) => {
        if (key === "f.user_id") return data.farms.some(f => f.id === r.finca_id && f.user_id === value);
        return String(r[key.replace(/^s\./, "")]) === String(value);
      })).filter(r => !q.cursorDate || r.created_at < q.cursorDate ||
        (r.created_at.getTime() === q.cursorDate.getTime() && r.id < q.cursorId))
        .sort((a, b) => {
          for (const [field, direction] of q.orders) {
            const key = field.replace(/^s\./, ""); const delta = a[key] - b[key];
            if (delta) return direction === "desc" ? -delta : delta;
          } return 0;
        });
    }
    const chain = {
      where(filters) { q.filters = filters; return chain; },
      forShare() { q.lock = "share"; return chain; },
      join() { return chain; }, select() { return chain; },
      orderBy(field, direction) { q.orders.push([field, direction]); return chain; },
      andWhere(callback) {
        const outer = { where(col, op, value) { q.cursorDate = value; return outer; },
          orWhere(nested) { nested.call({ where() { return this; }, andWhere(col, op, value) { q.cursorId = value; return this; } }); return outer; } };
        callback.call(outer); return chain;
      },
      async first() { if (state.failRead && table !== "fincas") throw new Error("private SQL read failure"); return selected()[0]; },
      async limit(limit) { q.limit = limit; return selected().slice(0, limit); },
      async insert(snapshot) {
        state.inserts++;
        if (state.failInsert) throw Object.assign(new Error("private SQL credentials marker"), { errno: 1452, sql: "private SQL", sqlMessage: "private details" });
        const id = Math.max(0, ...data.rows.map(r => r.id)) + 1; data.rows.push({ id, ...snapshot }); return [id];
      },
    }; return chain;
  };
}
function fakeKnex(table) { return connection(state.db, "db")(table); }
fakeKnex.transaction = async callback => {
  state.transactions++; const work = structuredClone(state.db);
  try { const r = await callback(connection(work, "trx")); if (state.failCommit) throw new Error("private commit failure"); state.db = work; state.commits++; return r; }
  catch (error) { state.rollbacks++; throw error; }
};
const knexPath = require.resolve("../src/config/knex");
require.cache[knexPath] = { id: knexPath, filename: knexPath, loaded: true, exports: fakeKnex };
// The actual R4B service, mapper, persistence, and frozen motor execute. Only
// factory dependencies clock/calculation counter and DB are controlled locally.
const servicePath = require.resolve("../src/services/irrigation-simulations.service");
const actualService = require(servicePath);
require.cache[servicePath].exports = { createIrrigationSimulationService: db => actualService.createIrrigationSimulationService(db, {
  now: () => date, calculate: data => { state.calculations++; return calculate(data); },
}) };
process.env.JWT_SECRET = "r4c-test-only-secret"; process.env.NODE_ENV = "test";
process.env.CORS_ORIGIN = "http://localhost:5173";
const nodemailer = require("nodemailer");
const originalTransport = nodemailer.createTransport;
nodemailer.createTransport = () => ({ sendMail() { throw new Error("No mail expected"); } });
const app = require("../src/app");
let server, url, token;
const base = "/api/fincas/7/irrigation-simulations";
before(async () => {
  token = jwt.sign({ userId: 42 }, process.env.JWT_SECRET, { expiresIn: "1h" });
  server = app.listen(0, "127.0.0.1");
  await new Promise((resolve, reject) => { server.once("listening", resolve); server.once("error", reject); });
  url = `http://127.0.0.1:${server.address().port}`;
});
after(async () => { nodemailer.createTransport = originalTransport; await new Promise(resolve => server.close(resolve)); });
beforeEach(() => {
  state.db = { farms: [{ id: 7, user_id: 42 }, { id: 8, user_id: 43 }, { id: 9, user_id: 42 }], rows: [] };
  state.queries = [];
  for (const key of ["calculations", "inserts", "transactions", "commits", "rollbacks"]) state[key] = 0;
  state.failInsert = state.failRead = state.failCommit = false;
});
async function request({ method = "POST", route = base, body = input(), raw, auth = `Bearer ${token}`, contentType = "application/json" } = {}) {
  const headers = {}; if (auth) headers.Authorization = auth; if (contentType) headers["Content-Type"] = contentType;
  const response = await fetch(url + route, { method, headers,
    ...(["GET", "HEAD"].includes(method) ? {} : { body: raw === undefined ? JSON.stringify(body) : raw }) });
  const text = await response.text();
  return { status: response.status, body: response.headers.get("content-type")?.includes("application/json") ? JSON.parse(text) : text };
}
function encode(value) { return Buffer.from(JSON.stringify(value)).toString("base64url"); }
async function quiet(callback) { const previous = console.error; console.error = () => {}; try { return await callback(); } finally { console.error = previous; } }

test("POST 201 G01: full snapshot, safe metadata, canonical names/UTC, one persisted server calculation", async () => {
  const r = await request(); assert.equal(r.status, 201);
  assert.deepEqual(r.body.simulation, { id: 1, name: null, fincaId: 7, createdAt: date.toISOString() });
  assert.deepEqual(r.body.input, input()); assert.deepEqual(r.body.output, calculate(input()).output);
  assert.equal(r.body.model.modelVersion, "irrigation-estimation-v1"); assert.equal(r.body.metadata.evidenceState.scientificValidation, "not_validated");
  assert.equal(state.calculations, 1); assert.equal(state.inserts, 1); assert.equal(state.commits, 1);
  assert.deepEqual(Object.keys(r.body), ["simulation", "model", "input", "output", "metadata"]);
  assert.ok(!JSON.stringify(r.body).includes("finca_id") && !JSON.stringify(r.body).includes("model_metadata"));
  assert.deepEqual(JSON.parse(state.db.rows[0].diagnostics), r.body.output.diagnostics.items);
});

test("POST name null/trim/255 allowed, empty/type/overlength rejected without insertion", async () => {
  for (const name of [null, "  Norte  ", "😀".repeat(255)]) {
    const r = await request({ body: { ...input(), name } }); assert.equal(r.status, 201);
    assert.equal(r.body.simulation.name, name === null ? null : name.trim());
  }
  const count = state.inserts;
  for (const name of [" ", "a".repeat(256), false, 7]) {
    const r = await request({ body: { ...input(), name } }); assert.equal(r.status, 400); assert.equal(r.body.field, "name");
  }
  assert.equal(state.inserts, count);
});

test("POST rejects root authority fields and group unknowns before service/motor", async () => {
  for (const field of ["modelVersion", "contractVersion", "sourceHash", "output", "outputs", "metadata", "diagnostics", "createdAt", "created_at", "finca_id", "user_id", "userId", "id"]) {
    const r = await request({ body: { ...input(), [field]: "private-client-marker" } }); assert.equal(r.status, 400);
    assert.equal(r.body.code, "INVALID_REQUEST"); assert.ok(!JSON.stringify(r.body).includes("private-client-marker"));
  }
  for (const group of ["crop", "soil", "furrow", "irrigation"]) {
    const body = input(); body[group].unknown = 1; assert.equal((await request({ body })).status, 400);
  }
  assert.equal(state.calculations, 0); assert.equal(state.transactions, 0); assert.equal(state.inserts, 0);
});

test("POST missing/null/array groups and non-number JSON values preserve engine errors, no coercion", async () => {
  for (const group of ["crop", "soil", "furrow", "irrigation"]) for (const missing of [true, false]) {
    const body = input(); if (missing) delete body[group]; else body[group] = null;
    const r = await request({ body }); assert.equal(r.status, 400); assert.ok(r.body.errors.some(e => e.code === "INVALID_SHAPE"));
  }
  for (const value of ["0.9", true, null, [], {}]) {
    const body = input(); body.irrigation.flowLps = value;
    const r = await request({ body }); assert.equal(r.status, 400);
    assert.ok(r.body.errors.some(e => e.code === "INVALID_TYPE" && e.field === "input.irrigation.flowLps"));
  }
  for (const group of ["crop", "soil", "furrow", "irrigation"]) {
    const body = input(); body[group] = [];
    assert.equal((await request({ body })).status, 400);
  }
  assert.equal((await request({ body: [] })).status, 400); assert.equal(state.inserts, 0);
});

test("POST invalid relationship 400, impossible balance/nonfinite output 422, structured safe errors", async () => {
  for (const [field, value, status, code] of [["advanceTimeMin", 61, 400, "INVALID_RELATIONSHIP"], ["flowLps", 0.1, 422, "MODEL_INCONSISTENCY"]]) {
    const body = input(); body.irrigation[field] = value;
    const r = await request({ body }); assert.equal(r.status, status); assert.ok(r.body.errors.some(e => e.code === code));
    assert.ok(r.body.errors.every(e => e.field && e.rule && e.message && !e.stack));
    assert.ok(!Object.hasOwn(r.body, "output"));
  }
  const body = input(); body.crop.etoMmPerDay = Number.MAX_VALUE;
  const r = await request({ body }); assert.equal(r.status, 422); assert.ok(r.body.errors.some(e => e.code === "NON_FINITE_RESULT"));
  assert.equal(state.inserts, 0);
});

test("POST DB/commit failures: rollback and generic 500 without SQL/errno/message exposure", async () => {
  for (const flag of ["failInsert", "failCommit"]) {
    state[flag] = true;
    const r = await quiet(() => request()); assert.equal(r.status, 500);
    assert.deepEqual(r.body, { error: "Ocurrió un error en el servidor.", code: "INTERNAL_ERROR" });
    assert.deepEqual(state.db.rows, []); state[flag] = false;
  }
  assert.equal(state.rollbacks, 2);
});

test("auth all endpoints: 401/403 before ownership queries/calculation/write", async () => {
  const expired = jwt.sign({ userId: 42 }, process.env.JWT_SECRET, { expiresIn: -1 });
  for (const [method, route] of [["POST", base], ["GET", base], ["GET", `${base}/1`]]) {
    assert.equal((await request({ method, route, auth: null })).status, 401);
    for (const auth of ["Bearer invalid", `Bearer ${expired}`]) assert.equal((await request({ method, route, auth })).status, 403);
  }
  assert.equal(state.queries.length, 0); assert.equal(state.inserts, 0); assert.equal(state.calculations, 0);
});

test("route IDs: strict syntax/INT range on all methods, no queries for invalid IDs", async () => {
  for (const id of ["0", "-1", "abc", "7foo", "07", "1.5", "1e2", "4294967296"]) {
    for (const method of ["POST", "GET"]) assert.equal((await request({ method, route: `/api/fincas/${id}/irrigation-simulations` })).status, 400);
    assert.equal((await request({ method: "GET", route: `${base}/${id}` })).status, 400);
  }
  assert.equal(state.queries.length, 0);
});

test("foreign/nonexistent farms: common 404, no motor/insert or snapshot queries", async () => {
  const expected = { error: "Recurso no encontrado o no tienes permiso.", code: "RESOURCE_NOT_FOUND" };
  for (const id of [8, 999]) for (const [method, suffix] of [["POST", ""], ["GET", ""], ["GET", "/1"]]) {
    const r = await request({ method, route: `/api/fincas/${id}/irrigation-simulations${suffix}` });
    assert.equal(r.status, 404); assert.deepEqual(r.body, expected);
  }
  assert.equal(state.calculations, 0); assert.equal(state.inserts, 0); assert.ok(state.queries.every(q => q.table === "fincas"));
});

test("HISTORY limit defaults/custom/max, strict invalid/repeated/unknown query parameters", async () => {
  for (const [suffix, limit] of [["", 20], ["?limit=2", 2], ["?limit=100", 100]]) {
    const r = await request({ method: "GET", route: base + suffix }); assert.equal(r.status, 200);
    assert.deepEqual(r.body.pagination, { limit, hasMore: false, nextCursor: null });
    assert.deepEqual(r.body.items, []); assert.equal(state.queries.at(-1).limit, limit + 1);
  }
  for (const value of ["0", "-1", "101", "1.5", "NaN", "20foo", "02", "", "1e1"]) {
    assert.equal((await request({ method: "GET", route: `${base}?limit=${value}` })).status, 400);
  }
  for (const query of ["limit=2&limit=3", "user_id=43", "unknown=1", "cursor=a&cursor=b"]) {
    assert.equal((await request({ method: "GET", route: `${base}?${query}` })).status, 400);
  }
});

test("HISTORY versioned opaque cursor, tied timestamps, correct order, no duplication and terminal null", async () => {
  state.db.rows = [row(1), row(3), row(2)];
  const r = await request({ method: "GET", route: `${base}?limit=2` }); assert.equal(r.status, 200);
  assert.deepEqual(r.body.items.map(item => item.simulation.id), [3, 2]);
  assert.ok(!r.body.items.some(item => Object.hasOwn(item, "metadata") || Object.hasOwn(item, "input")));
  const cursor = r.body.pagination.nextCursor; assert.equal(typeof cursor, "string");
  assert.deepEqual(JSON.parse(Buffer.from(cursor, "base64url").toString()), { v: 1, createdAt: date.toISOString(), id: 2 });
  const next = await request({ method: "GET", route: `${base}?limit=2&cursor=${cursor}` });
  assert.deepEqual(next.body.items.map(item => item.simulation.id), [1]); assert.equal(next.body.pagination.nextCursor, null);
  assert.equal(state.calculations, 0);
});

test("HISTORY invalid cursors: encoding, version, shape, date, ID and size all 400", async () => {
  for (const cursor of ["!", "", "a".repeat(257), Buffer.from([0xff]).toString("base64url"), encode([]), encode({ v: 2, createdAt: date.toISOString(), id: 1 }),
    encode({ v: 1, createdAt: "2026-02-30T00:00:00.000Z", id: 1 }), encode({ v: 1, createdAt: date.toISOString(), id: 0 }),
    encode({ v: 1, createdAt: date.toISOString(), id: "1" }), encode({ v: 1, createdAt: date.toISOString(), id: 1, owner: 42 }),
    encode({ v: 1, createdAt: "2026-10-13T12:30:45.123-03:00", id: 1 })]) {
    const r = await request({ method: "GET", route: `${base}?cursor=${encodeURIComponent(cursor)}` });
    assert.equal(r.status, 400); assert.equal(r.body.code, "INVALID_PAGINATION");
  }
  assert.equal(state.queries.length, 0);
});

test("DETAIL own historical JSON/messages/versions preserved, no recalculation, safe metadata sections", async () => {
  const stored = row(1); stored.model_version = "historical-v0";
  stored.model_metadata.effectiveParameters.infiltrationCoefficient = 8;
  stored.model_metadata.internalDebug = "private-marker";
  stored.diagnostics[0].message = "Mensaje histórico"; stored.diagnostics[0].ruleVersion = "old-rule";
  stored.model_metadata = JSON.stringify(stored.model_metadata); stored.diagnostics = JSON.stringify(stored.diagnostics);
  state.db.rows = [stored];
  const r = await request({ method: "GET", route: `${base}/1` }); assert.equal(r.status, 200);
  assert.equal(r.body.model.modelVersion, "historical-v0"); assert.equal(r.body.metadata.effectiveParameters.infiltrationCoefficient, 8);
  assert.equal(r.body.output.diagnostics.items[0].message, "Mensaje histórico");
  assert.equal(r.body.output.diagnostics.items[0].ruleVersion, "old-rule");
  assert.ok(!JSON.stringify(r.body).includes("private-marker")); assert.equal(state.calculations, 0);
  assert.equal(r.body.simulation.createdAt, date.toISOString());
});

test("DETAIL missing/wrong farm IDs use common 404; unexpected read failure generic 500", async () => {
  state.db.rows = [row(1, 9)];
  for (const id of [1, 999]) {
    const r = await request({ method: "GET", route: `${base}/${id}` }); assert.equal(r.status, 404);
    assert.equal(r.body.code, "RESOURCE_NOT_FOUND");
  }
  state.failRead = true;
  const r = await quiet(() => request({ method: "GET", route: `${base}/1` })); assert.equal(r.status, 500);
  assert.deepEqual(r.body, { error: "Ocurrió un error en el servidor.", code: "INTERNAL_ERROR" });
});

test("immutable methods PATCH/PUT/DELETE remain 404 and change nothing", async () => {
  state.db.rows = [row(1)]; const original = structuredClone(state.db);
  for (const method of ["PATCH", "PUT", "DELETE"]) {
    assert.equal((await request({ method, route: `${base}/1`, body: { name: "Changed" } })).status, 404);
  }
  assert.deepEqual(state.db, original); assert.equal(state.queries.length, 0);
});

test("JSON parser preserved: malformed JSON safe 400, content-type 415, default size limit safe 413", async () => {
  const malformed = await request({ raw: '{"private-marker":' }); assert.equal(malformed.status, 400);
  assert.deepEqual(malformed.body, { error: "El cuerpo de la solicitud debe contener JSON válido.", code: "invalid_input" });
  const wrong = await request({ contentType: "text/plain", raw: "private-marker" }); assert.equal(wrong.status, 415);
  const large = await request({ body: { ...input(), name: "x".repeat(110000) } }); assert.equal(large.status, 413);
  assert.deepEqual(large.body, { error: "El cuerpo de la solicitud excede el límite permitido.", code: "PAYLOAD_TOO_LARGE" });
  assert.equal(state.inserts, 0); assert.equal(state.queries.length, 0);
});
