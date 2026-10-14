const { test, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const jwt = require("jsonwebtoken");

// Stateful transaction double: writes affect a private working copy until commit.
// HTTP/auth/route execute normally; no DB configuration or connection is loaded.
const state = {};
function fakeKnex() { throw new Error("DELETE used a query outside its transaction"); }
fakeKnex.transaction = async (callback) => {
  state.events.push("begin");
  const working = structuredClone(state.db);
  function trx(table) {
    const query = { table, filters: {}, locked: false };
    state.queries.push(query);
    const matches = row => Object.entries(query.filters).every(([key, value]) => String(row[key]) === String(value));
    const chain = {
      where(filters) { query.filters = filters; return chain; },
      forUpdate() { query.locked = true; return chain; },
      select(...columns) { query.columns = columns; return chain; },
      async first() {
        if (table === "irrigation_simulations" && state.failPrecheck) throw new Error("private precheck failure");
        const row = working[table].find(matches);
        return row && (query.columns ? Object.fromEntries(query.columns.map(key => [key, row[key]])) : { ...row });
      },
      async del() {
        state.events.push(`delete:${table}`);
        if (table === "calculos" && state.failCalculos) throw new Error("private calculations failure");
        if (table === "fincas") {
          if (state.race) {
            // Forced late dependency simulates the final FK rejection. It does
            // not claim that a real inserter bypasses the parent's FOR UPDATE.
            const inserted = { id: 999, finca_id: 7 };
            state.db.irrigation_simulations.push({ ...inserted });
            working.irrigation_simulations.push({ ...inserted });
          }
          if (state.failFinca) throw new Error("private finca failure");
          if (working.irrigation_simulations.some(sim => working.fincas.some(farm => matches(farm) && farm.id === sim.finca_id))) {
            throw Object.assign(new Error("private FK SQL detail"), state.errnoOnly
              ? { errno: 1451 } : { code: "ER_ROW_IS_REFERENCED_2", errno: 1451 });
          }
        }
        const count = working[table].filter(matches).length;
        working[table] = working[table].filter(row => !matches(row));
        if (table === "calculos") state.stagedCalculos = structuredClone(working.calculos);
        return count;
      },
    };
    return chain;
  }
  try {
    const result = await callback(trx);
    if (state.failCommit) throw new Error("private commit failure");
    state.db = working;
    state.events.push("commit");
    return result;
  } catch (error) {
    state.events.push("rollback");
    throw error;
  }
};
const knexPath = require.resolve("../src/config/knex");
require.cache[knexPath] = { id: knexPath, filename: knexPath, loaded: true, exports: fakeKnex };
process.env.JWT_SECRET = "r4a-test-only-secret";
const app = express();
app.use(express.json());
app.use(require("../src/routes/fincas.routes"));
let server, url, token;
before(async () => {
  token = jwt.sign({ userId: 42 }, process.env.JWT_SECRET, { expiresIn: "1h" });
  server = app.listen(0, "127.0.0.1");
  await new Promise((resolve, reject) => { server.once("listening", resolve); server.once("error", reject); });
  url = `http://127.0.0.1:${server.address().port}`;
});
after(async () => { await new Promise(resolve => server.close(resolve)); });
beforeEach(() => {
  state.db = {
    fincas: [{ id: 7, user_id: 42 }, { id: 8, user_id: 43 }],
    calculos: [{ id: 100, finca_id: 7 }, { id: 200, finca_id: 8 }],
    irrigation_simulations: [],
  };
  state.events = []; state.queries = []; state.stagedCalculos = undefined;
  for (const key of ["failPrecheck", "failCalculos", "failFinca", "failCommit", "race", "errnoOnly"]) state[key] = false;
});
async function request(id = 7, authorization = `Bearer ${token}`) {
  const response = await fetch(`${url}/api/fincas/${id}`, {
    method: "DELETE", headers: authorization ? { Authorization: authorization } : {},
  });
  return { status: response.status, body: await response.json() };
}
async function withoutErrorLog(callback) {
  const original = console.error; console.error = () => {};
  try { return await callback(); } finally { console.error = original; }
}
function assertUntouched(snapshot) { assert.deepEqual(state.db, snapshot); }
function assertOwnedLock() {
  assert.deepEqual(state.queries[0], { table: "fincas", filters: { id: "7", user_id: 42 }, locked: true });
}

test("A: own empty finca deletes atomically and preserves unrelated rows", async () => {
  state.db.calculos = state.db.calculos.filter(row => row.finca_id !== 7);
  const r = await request(); assert.equal(r.status, 200);
  assert.deepEqual(r.body, { message: "Finca y sus cálculos eliminados correctamente." });
  assert.deepEqual(state.events, ["begin", "delete:calculos", "delete:fincas", "commit"]);
  assert.deepEqual(state.db.fincas, [{ id: 8, user_id: 43 }]);
  assert.deepEqual(state.db.calculos, [{ id: 200, finca_id: 8 }]); assertOwnedLock();
});

test("B: own finca with Manning deletes both within the transaction", async () => {
  assert.equal((await request()).status, 200);
  assert.deepEqual(state.db.calculos, [{ id: 200, finca_id: 8 }]);
  assert.deepEqual(state.db.fincas, [{ id: 8, user_id: 43 }]);
  assert.deepEqual(state.events, ["begin", "delete:calculos", "delete:fincas", "commit"]);
  assertOwnedLock();
  assert.deepEqual(state.queries[1], { table: "irrigation_simulations", filters: { finca_id: "7" }, locked: false, columns: ["id"] });
  assert.deepEqual(state.queries[3].filters, { id: "7", user_id: 42 });
});

for (const withManning of [false, true]) {
  test(`${withManning ? "D" : "C"}: simulations prevent all deletion, ${withManning ? "with" : "without"} Manning`, async () => {
    if (!withManning) state.db.calculos = state.db.calculos.filter(row => row.finca_id !== 7);
    state.db.irrigation_simulations = [{ id: 300, finca_id: 7 }];
    const snapshot = structuredClone(state.db), r = await request();
    assert.equal(r.status, 409);
    assert.deepEqual(r.body, { error: "La finca posee simulaciones de riego guardadas y no puede eliminarse.", code: "FARM_HAS_IRRIGATION_SIMULATIONS" });
    assertUntouched(snapshot); assert.deepEqual(state.events, ["begin", "rollback"]); assertOwnedLock();
    assert.equal(state.queries.length, 2);
  });
}

test("E/F: foreign and missing finca return the same 404 before inspecting dependents", async () => {
  state.db.irrigation_simulations = [{ id: 300, finca_id: 8 }];
  const snapshot = structuredClone(state.db);
  for (const id of [8, 999]) {
    state.events = []; state.queries = [];
    const r = await request(id); assert.equal(r.status, 404);
    assert.deepEqual(r.body, { error: "Finca no encontrada o no tienes permiso." });
    assertUntouched(snapshot); assert.deepEqual(state.events, ["begin", "commit"]);
    assert.equal(state.queries.length, 1); assert.equal(state.queries[0].filters.user_id, 42);
  }
});

test("G: failure after staged Manning deletion rolls back both tables", async () => {
  state.failFinca = true;
  const snapshot = structuredClone(state.db), r = await withoutErrorLog(() => request());
  assert.equal(r.status, 500); assert.deepEqual(r.body, { error: "Error en el servidor." });
  assert.deepEqual(state.stagedCalculos, [{ id: 200, finca_id: 8 }]);
  assertUntouched(snapshot); assert.deepEqual(state.events, ["begin", "delete:calculos", "delete:fincas", "rollback"]);
});

test("H: late FK RESTRICT rejection restores Manning and retains the external dependency", async () => {
  for (const errnoOnly of [false, true]) {
    state.errnoOnly = errnoOnly; state.race = true; state.events = []; state.queries = [];
    state.db.irrigation_simulations = [];
    const farms = structuredClone(state.db.fincas), calculations = structuredClone(state.db.calculos);
    const r = await request(); assert.equal(r.status, 409);
    assert.deepEqual(r.body, { error: "La finca tiene registros asociados y no puede eliminarse.", code: "FARM_DELETE_CONFLICT" });
    assert.deepEqual(state.db.fincas, farms); assert.deepEqual(state.db.calculos, calculations);
    assert.deepEqual(state.db.irrigation_simulations, [{ id: 999, finca_id: 7 }]);
    assert.deepEqual(state.stagedCalculos, [{ id: 200, finca_id: 8 }]);
    assert.deepEqual(state.events, ["begin", "delete:calculos", "delete:fincas", "rollback"]);
  }
});

test("precheck/calculos/commit failures never return success or leave partial writes", async () => {
  for (const flag of ["failPrecheck", "failCalculos", "failCommit"]) {
    state[flag] = true; state.events = [];
    const snapshot = structuredClone(state.db), r = await withoutErrorLog(() => request());
    assert.equal(r.status, 500); assert.deepEqual(r.body, { error: "Error en el servidor." });
    assertUntouched(snapshot); assert.equal(state.events.at(-1), "rollback");
    assert.ok(!state.events.includes("commit")); state[flag] = false;
  }
});

test("401/403 auth rejects before transaction and ownership query", async () => {
  const snapshot = structuredClone(state.db);
  assert.equal((await request(7, null)).status, 401);
  for (const value of ["Bearer invalid", `Bearer ${jwt.sign({ userId: 42 }, process.env.JWT_SECRET, { expiresIn: -1 })}`]) {
    assert.equal((await request(7, value)).status, 403);
  }
  assertUntouched(snapshot); assert.deepEqual(state.events, []); assert.deepEqual(state.queries, []);
});
