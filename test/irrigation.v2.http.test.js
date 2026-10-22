const { test, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const jwt = require("jsonwebtoken");
const golden = require("./fixtures/irrigation-v2-golden");
const { ACTIVE_V1, ACTIVE_V2, ACTIVE_DESCRIPTOR } = require("../src/services/irrigation-simulations.versions");
const { createIrrigationSimulationRouter } = require("../src/routes/irrigation-simulations.router");
const { createIrrigationSimulationService } = require("../src/services/irrigation-simulations.service");
const { mapCalculationToSnapshotVersioned } = require("../src/services/irrigation-simulations.versioned-mapper");
const { V2_COLUMNS } = require("../src/services/irrigation-simulations.snapshot");
const date = new Date("2026-10-20T12:34:56.789Z");
const base = "/api/fincas/7/irrigation-simulations";
const input = () => structuredClone(golden.input);
function v1Input() {
  const data = input(); data.furrow = { widthM: 1.3, lengthM: 60, slopePct: 0 }; return data;
}
function stored(id, descriptor = ACTIVE_V2, fincaId = 7, canonicalInput = input()) {
  const result = descriptor.calculate(descriptor === ACTIVE_V1 ? v1Input() : canonicalInput);
  assert.equal(result.ok, true);
  return { id, ...Object.fromEntries(V2_COLUMNS.map((c) => [c, null])),
    ...mapCalculationToSnapshotVersioned({ fincaId, calculationResult: result, createdAt: date }, { descriptor }) };
}
const state = {};
function connection(data, scope) {
  return (table) => {
    const query = { table, scope, filters: {}, orders: [] }; state.queries.push(query);
    function selected() {
      const rows = table === "fincas" ? data.farms : data.rows;
      return rows.filter((r) => Object.entries(query.filters).every(([key, value]) => {
        if (key === "f.user_id") return data.farms.some((f) => f.id === r.finca_id && f.user_id === value);
        return r[key.replace(/^s\./, "")] === value;
      })).filter((r) => !query.cursorDate || r.created_at < query.cursorDate ||
        (r.created_at.getTime() === query.cursorDate.getTime() && r.id < query.cursorId))
        .sort((a, b) => {
          for (const [column, direction] of query.orders) {
            const delta = a[column.replace(/^s\./, "")] - b[column.replace(/^s\./, "")];
            if (delta) return direction === "desc" ? -delta : delta;
          } return 0;
        }).map((r) => {
          const row = structuredClone(r);
          if (state.stringCount && row.furrow_count !== null) row.furrow_count = String(row.furrow_count);
          if (!query.columns || query.columns.includes("s.*")) return row;
          return Object.fromEntries(query.columns.map((c) => [c.replace(/^s\./, ""), row[c.replace(/^s\./, "")]]));
        });
    }
    const chain = {
      where(filters) { query.filters = filters; return chain; },
      forShare() { query.lock = "share"; return chain; },
      join() { return chain; }, select(columns) { query.columns = Array.isArray(columns) ? columns : [columns]; return chain; },
      orderBy(column, direction) { query.orders.push([column, direction]); return chain; },
      andWhere(callback) {
        const outer = { where(c, op, value) { query.cursorDate = value; return outer; },
          orWhere(nested) { nested.call({ where() { return this; }, andWhere(c, op, value) { query.cursorId = value; return this; } }); return outer; } };
        callback.call(outer); return chain;
      },
      async first() {
        state.events.push(table === "fincas" ? "farm" : "readback");
        if (table !== "fincas" && state.failRead) throw new Error("private read SQL");
        if (table !== "fincas" && state.missingRead) return undefined;
        const row = selected()[0];
        if (row && table !== "fincas" && state.corruptRead) row.source_hash = "private corruption";
        return row;
      },
      async limit(n) { query.limit = n; if (state.failRead) throw new Error("private SQL"); return selected().slice(0, n); },
      async insert(snapshot) {
        state.inserts++; state.events.push("insert");
        if (state.failInsert) throw Object.assign(new Error("private SQL credentials"), { errno: 1452 });
        const id = Math.max(0, ...data.rows.map((r) => r.id)) + 1;
        data.rows.push({ id, ...Object.fromEntries(V2_COLUMNS.map((c) => [c, null])), ...snapshot });
        state.writes.push(snapshot); return [id];
      },
    };
    return chain;
  };
}
function db(table) { return connection(state.data, "db")(table); }
db.transaction = async (callback) => {
  state.transactions++; state.events.push("begin"); const work = structuredClone(state.data);
  try {
    const result = await callback(connection(work, "trx")); state.events.push("commit-attempt");
    if (state.failCommit) throw new Error("private uncertain commit");
    if (state.uncertainCommit) {
      // Simulate a lost acknowledgement after durable write; no claim about real locks/commit.
      state.data = work; throw new Error("private acknowledgement lost");
    }
    state.data = work; state.events.push("commit"); return result;
  } catch (error) { state.rollbacks++; state.events.push("rollback"); throw error; }
};
const servers = [], urls = {};
let token;
before(async () => {
  process.env.JWT_SECRET = "d4-test-only-secret";
  token = jwt.sign({ userId: 42 }, process.env.JWT_SECRET, { expiresIn: "1h" });
  for (const [label, descriptor] of [["bridge", ACTIVE_V1], ["final", ACTIVE_V2]]) {
    const app = express(); app.use(express.json());
    const options = { now: () => date, calculate: (data) => { state.calculations++; return descriptor.calculate(data); } };
    // Bridge deliberately exercises the default composition.
    if (label === "final") options.descriptor = descriptor;
    app.use(createIrrigationSimulationRouter(db, options));
    const server = app.listen(0, "127.0.0.1"); servers.push(server);
    await new Promise((resolve, reject) => { server.once("listening", resolve); server.once("error", reject); });
    urls[label] = `http://127.0.0.1:${server.address().port}`;
  }
});
after(async () => { await Promise.all(servers.map((s) => new Promise((resolve) => s.close(resolve)))); });
beforeEach(() => {
  state.data = { farms: [{ id: 7, user_id: 42 }, { id: 8, user_id: 43 }, { id: 9, user_id: 42 }], rows: [] };
  state.queries = []; state.events = []; state.writes = [];
  for (const key of ["calculations", "inserts", "transactions", "rollbacks"]) state[key] = 0;
  for (const key of ["failInsert", "failRead", "missingRead", "failCommit", "uncertainCommit", "corruptRead", "stringCount"]) state[key] = false;
});
async function request({ composition = "final", method = "POST", route = base, body = input(), auth = `Bearer ${token}`, contentType = "application/json" } = {}) {
  const headers = {}; if (auth) headers.Authorization = auth; if (contentType) headers["Content-Type"] = contentType;
  const response = await fetch(urls[composition] + route, { method, headers,
    ...(method === "GET" ? {} : { body: JSON.stringify(body) }) });
  const text = await response.text();
  return { status: response.status, body: response.headers.get("content-type")?.includes("application/json") ? JSON.parse(text) : text };
}
async function quiet(callback) { const previous = console.error; console.error = () => {}; try { return await callback(); } finally { console.error = previous; } }
const internal = { error: "Ocurrió un error en el servidor.", code: "INTERNAL_ERROR" };

test("D4 composition rejects unregistered descriptors before DB access and defaults to V1", () => {
  assert.equal(ACTIVE_DESCRIPTOR, ACTIVE_V1);
  for (const descriptor of [null, {}, { ...ACTIVE_V2 }, "irrigation-contract-v2"]) {
    assert.throws(() => createIrrigationSimulationRouter(db, { descriptor }));
    assert.throws(() => createIrrigationSimulationService(db, { descriptor }));
  }
  assert.deepEqual(state.queries, []);
});

test("POST V2 GV2-01 exact literal golden, 43 persisted fields, one calculation/insert and commit before 201", async () => {
  const response = await request({ body: { ...input(), name: "  Norte  " } });
  assert.equal(response.status, 201);
  assert.deepEqual(response.body, { simulation: { id: 1, fincaId: 7, name: "Norte", createdAt: date.toISOString() },
    model: { modelVersion: golden.modelVersion, contractVersion: golden.contractVersion, sourceHash: golden.sourceHash },
    input: golden.input, output: golden.output, metadata: golden.metadata });
  assert.equal(state.calculations, 1); assert.equal(state.inserts, 1);
  assert.equal(Object.keys(state.writes[0]).length, 43);
  assert.equal(state.writes[0].width_m, 1.3); assert.ok(!Object.hasOwn(state.writes[0], "furrow_spacing_m"));
  assert.deepEqual(JSON.parse(state.writes[0].model_metadata), golden.metadata);
  assert.deepEqual(JSON.parse(state.writes[0].diagnostics), golden.output.diagnostics.items);
  assert.deepEqual(state.events, ["begin", "farm", "insert", "readback", "commit-attempt", "commit"]);
  assert.ok(state.queries.every((q) => q.scope === "trx")); assert.equal(state.queries[0].lock, "share");
});

test("bridge POST remains V1, final POST rejects widthM, bridge rejects spacing/count, no inferred version", async () => {
  const r = await request({ composition: "bridge", body: v1Input() });
  assert.equal(r.status, 201); assert.equal(r.body.model.contractVersion, ACTIVE_V1.contractVersion);
  assert.equal(Object.keys(state.writes[0]).length, 37); assert.ok(!Object.hasOwn(r.body.input.furrow, "furrowCount"));
  const count = state.inserts;
  for (const options of [{ body: v1Input() }, { composition: "bridge", body: input() }]) {
    const result = await request(options); assert.equal(result.status, 400); assert.equal(result.body.code, "INVALID_REQUEST");
  }
  assert.equal(state.inserts, count);
});

test("POST V2 missing spacing/count and unsafe/noninteger/coerced counts return 400 without insertion", async () => {
  for (const field of ["furrowSpacingM", "furrowCount"]) {
    const body = input(); delete body.furrow[field]; const r = await request({ body });
    assert.equal(r.status, 400); assert.equal(r.body.code, "INVALID_IRRIGATION_INPUT");
    assert.ok(r.body.errors.some((e) => e.field === `input.furrow.${field}`));
  }
  for (const value of [null, "18", true, 0, -1, 1.5, 9007199254740992]) {
    const body = input(); body.furrow.furrowCount = value;
    const r = await request({ body }); assert.equal(r.status, 400);
    assert.ok(r.body.errors.some((e) => e.field === "input.furrow.furrowCount"));
  }
  assert.equal(state.inserts, 0);
});

test("POST V2 rejects client authority, selectors, aliases, derived and excluded fields before transaction", async () => {
  for (const key of ["modelVersion", "contractVersion", "sourceHash", "version", "descriptor", "output", "metadata", "diagnostics", "id", "userId", "finca_id"]) {
    const r = await request({ body: { ...input(), [key]: "private-client-marker" } });
    assert.equal(r.status, 400); assert.equal(r.body.field, `body.${key}`);
    assert.ok(!JSON.stringify(r.body).includes("private-client-marker"));
  }
  for (const [group, key] of [["furrow", "widthM"], ["furrow", "surfaceAreaM2"], ["irrigation", "totalAppliedVolumeL"], ["crop", "dailyCropWaterUseMmPerDay"]]) {
    const body = input(); body[group][key] = 1; const r = await request({ body });
    assert.equal(r.status, 400); assert.equal(r.body.field, `${group}.${key}`);
  }
  assert.equal((await request({ route: `${base}?contractVersion=irrigation-contract-v1` })).status, 400);
  assert.equal(state.transactions, 0); assert.equal(state.calculations, 0); assert.equal(state.inserts, 0);
});

test("POST V2 zero daily from either factor returns 201 with both explicit null days, unchanged rule family", async () => {
  for (const field of ["etoMmPerDay", "cropCoefficient"]) {
    const body = input(); body.crop[field] = 0; const r = await request({ body }); assert.equal(r.status, 201);
    assert.equal(r.body.output.waterNeed.dailyCropWaterUseMmPerDay, 0);
    assert.equal(r.body.output.soilWater.daysUntilAvailableWaterExhaustion, null);
    assert.equal(r.body.output.soilWater.daysUntilDepletionThreshold, null);
    assert.ok(r.body.output.diagnostics.items.every((item) => /^P0[1-5]$/.test(item.id)));
    assert.equal(state.data.rows.at(-1).days_until_available_water_exhaustion, null);
  }
});

test("POST V2 MAX_SAFE count roundtrip through canonical driver string remains exact Number", async () => {
  state.stringCount = true; const body = input(); body.furrow.furrowCount = 9007199254740991;
  const r = await request({ body }); assert.equal(r.status, 201);
  assert.equal(r.body.input.furrow.furrowCount, 9007199254740991);
  assert.equal(typeof r.body.input.furrow.furrowCount, "number");
  assert.equal(r.body.output.totals.totalAppliedVolumeL, 6480 * 9007199254740991);
  const detail = await request({ method: "GET", route: `${base}/1` }); assert.deepEqual(detail.body, r.body);
});

test("POST V2 invalid relation 400 and physical/nonfinite/underflow failures 422 with safe fields and no output", async () => {
  const samples = [
    [400, (b) => { b.irrigation.advanceTimeMin = 121; }],
    [422, (b) => { b.irrigation.flowLps = 0.1; }],
    [422, (b) => { b.crop.etoMmPerDay = Number.MAX_VALUE; }],
    [422, (b) => { b.crop.etoMmPerDay = Number.MIN_VALUE; b.crop.cropCoefficient = 0.1; }],
  ];
  for (const [status, change] of samples) {
    const body = input(); change(body); const r = await request({ body }); assert.equal(r.status, status);
    assert.equal(r.body.code, status === 400 ? "INVALID_IRRIGATION_INPUT" : "IRRIGATION_MODEL_INCONSISTENCY");
    assert.ok(r.body.errors.length); assert.ok(r.body.errors.every((e) => !Object.hasOwn(e, "received") && !Object.hasOwn(e, "stack")));
    assert.ok(!Object.hasOwn(r.body, "output"));
  }
  assert.equal(state.inserts, 0);
});

test("POST V2 names preserve null/trim/Unicode and reject invalid names", async () => {
  for (const name of [null, "  Norte  ", "😀".repeat(255)]) {
    const r = await request({ body: { ...input(), name } }); assert.equal(r.status, 201);
    assert.equal(r.body.simulation.name, name === null ? null : name.trim());
  }
  const count = state.inserts;
  for (const name of [false, 18, " ", "😀".repeat(256)]) {
    const r = await request({ body: { ...input(), name } }); assert.equal(r.status, 400); assert.equal(r.body.field, "name");
  }
  assert.equal(state.inserts, count);
});

test("auth precedes queries for V2 POST and mixed GET; ownership hides foreign/missing farms", async () => {
  for (const [method, route] of [["POST", base], ["GET", base], ["GET", `${base}/1`]]) {
    assert.equal((await request({ method, route, auth: null })).status, 401);
    assert.equal((await request({ method, route, auth: "Bearer invalid" })).status, 403);
  }
  assert.deepEqual(state.queries, []);
  for (const id of [8, 999]) for (const [method, suffix] of [["POST", ""], ["GET", ""], ["GET", "/1"]]) {
    const r = await request({ method, route: `/api/fincas/${id}/irrigation-simulations${suffix}` });
    assert.equal(r.status, 404); assert.equal(r.body.code, "RESOURCE_NOT_FOUND");
  }
  assert.ok(state.queries.every((q) => q.table === "fincas")); assert.equal(state.inserts, 0); assert.equal(state.calculations, 0);
});

test("V2 strict IDs/query/content-type and immutable methods perform no query", async () => {
  for (const id of ["0", "07", "1e2", "4294967296"]) for (const method of ["POST", "GET"]) {
    assert.equal((await request({ method, route: `/api/fincas/${id}/irrigation-simulations` })).status, 400);
  }
  assert.equal((await request({ contentType: "text/plain" })).status, 415);
  for (const method of ["PATCH", "PUT", "DELETE"]) assert.equal((await request({ method, route: `${base}/1` })).status, 404);
  assert.equal(state.queries.length, 0);
});

test("POST V2 read/insert/missing-readback/corrupt-readback/commit errors rollback once and return generic 500", async () => {
  for (const flag of ["failInsert", "failRead", "missingRead", "corruptRead", "failCommit"]) {
    state[flag] = true; const attempts = state.inserts;
    const r = await quiet(() => request()); assert.equal(r.status, 500); assert.deepEqual(r.body, internal);
    assert.deepEqual(state.data.rows, []); assert.equal(state.inserts - attempts, 1); state[flag] = false;
  }
  assert.equal(state.rollbacks, 5); assert.equal(state.transactions, 5); assert.equal(state.calculations, 5);
});

test("mismatched injected calculator result cannot select writer or insert a different contract", async () => {
  const service = createIrrigationSimulationService(db, { descriptor: ACTIVE_V2,
    calculate: () => ACTIVE_V1.calculate(v1Input()), now: () => date });
  await assert.rejects(service.create({ userId: 42, fincaId: 7, canonicalInput: input() }), /Snapshot/);
  assert.equal(state.inserts, 0); assert.equal(state.rollbacks, 1);
});

test("uncertain POST acknowledgement returns safe 500 without retry; mixed GET can reconcile persisted snapshot", async () => {
  state.uncertainCommit = true;
  const r = await quiet(() => request()); assert.equal(r.status, 500); assert.deepEqual(r.body, internal);
  assert.equal(state.inserts, 1); assert.equal(state.transactions, 1); assert.equal(state.data.rows.length, 1);
  const history = await request({ method: "GET" }); assert.equal(history.status, 200);
  assert.equal(history.body.items[0].simulation.id, 1);
  const detail = await request({ method: "GET", route: `${base}/1` }); assert.equal(detail.status, 200);
  assert.deepEqual(detail.body.output, golden.output);
  assert.equal(state.inserts, 1); assert.equal(state.transactions, 1);
});

test("mixed HISTORY tied dates, cursor v1, narrow projection, per-version summaries and ownership in both compositions", async () => {
  const zero = input(); zero.crop.etoMmPerDay = 0;
  state.data.rows = [stored(1, ACTIVE_V1), stored(2), stored(3, ACTIVE_V2, 7, zero), stored(9, ACTIVE_V2, 9), stored(10, ACTIVE_V2, 8)];
  for (const composition of ["bridge", "final"]) {
    const r = await request({ composition, method: "GET", route: `${base}?limit=2` }); assert.equal(r.status, 200);
    assert.deepEqual(r.body.items.map((i) => i.simulation.id), [3, 2]);
    r.body.items.forEach((i) => {
      assert.equal(i.summary.furrowCount, 18); assert.equal(i.summary.totalAppliedVolumeL, 116640);
      assert.equal(i.summary.appliedVolumeL, 6480); assert.ok(!Object.hasOwn(i, "metadata"));
      assert.ok(!Object.hasOwn(i.summary, "totalAppliedVolumeM3"));
    });
    const cursor = r.body.pagination.nextCursor;
    assert.deepEqual(JSON.parse(Buffer.from(cursor, "base64url").toString()), { v: 1, createdAt: date.toISOString(), id: 2 });
    const next = await request({ composition, method: "GET", route: `${base}?limit=2&cursor=${cursor}` });
    assert.deepEqual(next.body.items.map((i) => i.simulation.id), [1]);
    assert.equal(next.body.pagination.hasMore, false); assert.equal(next.body.pagination.nextCursor, null);
    assert.ok(!Object.hasOwn(next.body.items[0].summary, "furrowCount"));
    assert.ok(!Object.hasOwn(next.body.items[0].summary, "totalAppliedVolumeL"));
    const query = state.queries.at(-1); assert.ok(query.columns.includes("s.model_metadata"));
    assert.ok(query.columns.includes("s.furrow_count")); assert.ok(!query.columns.includes("s.*")); assert.equal(query.limit, 3);
  }
  assert.equal(state.calculations, 0); assert.equal(state.inserts, 0);
});

test("mixed DETAIL preserves historical numbers/messages/parameters/zero nulls with no calculation and safe metadata", async () => {
  const zero = input(); zero.crop.cropCoefficient = 0;
  state.data.rows = [stored(1, ACTIVE_V1), stored(2), stored(3, ACTIVE_V2, 7, zero)];
  for (const row of state.data.rows) {
    row.model_metadata.effectiveParameters.infiltrationCoefficient = 8;
    row.model_metadata.internalDebug = "private-marker";
    row.diagnostics[0].message = "Mensaje histórico";
    row.applied_volume_l = 7777;
    row.model_metadata = JSON.stringify(row.model_metadata); row.diagnostics = JSON.stringify(row.diagnostics);
  }
  const beforeRows = structuredClone(state.data.rows);
  for (const composition of ["bridge", "final"]) for (const id of [1, 2, 3]) {
    const r = await request({ composition, method: "GET", route: `${base}/${id}` }); assert.equal(r.status, 200);
    assert.equal(r.body.output.application.appliedVolumeL, 7777);
    assert.equal(r.body.metadata.effectiveParameters.infiltrationCoefficient, 8);
    assert.equal(r.body.output.diagnostics.items[0].message, "Mensaje histórico");
    assert.ok(!JSON.stringify(r.body).includes("private-marker")); assert.equal(Object.keys(r.body.metadata).length, 9);
    if (id === 1) {
      assert.equal(r.body.input.furrow.widthM, 1.3); assert.ok(!Object.hasOwn(r.body.output, "totals"));
    } else {
      assert.equal(r.body.input.furrow.furrowSpacingM, 1.3); assert.equal(r.body.output.totals.totalAppliedVolumeL, 116640);
      assert.equal(r.body.output.soilWater.daysUntilAvailableWaterExhaustion, id === 3 ? null : 26);
    }
  }
  assert.deepEqual(state.data.rows, beforeRows); assert.equal(state.calculations, 0);
});

test("unknown/crossed/hash/schema/rule/unsafe storage failures on mixed GET return generic 500 without fallback", async () => {
  const mutations = [
    (r) => { r.contract_version = "private-unknown"; }, (r) => { r.model_version = ACTIVE_V1.modelVersion; },
    (r) => { r.source_hash = "private-hash"; }, (r) => { r.model_metadata.metadataSchemaVersion = "private-schema"; },
    (r) => { r.diagnostics[0].ruleVersion = "private-rule"; }, (r) => { r.model_metadata = "broken private JSON"; },
    (r) => { r.furrow_count = "018"; }, (r) => { r.total_applied_volume_l = null; },
  ];
  for (const composition of ["bridge", "final"]) for (const mutate of mutations) {
    const row = stored(1); mutate(row); state.data.rows = [row];
    for (const route of [base, `${base}/1`]) {
      const r = await quiet(() => request({ composition, method: "GET", route }));
      assert.equal(r.status, 500); assert.deepEqual(r.body, internal);
    }
  }
  assert.equal(state.calculations, 0); assert.equal(state.inserts, 0);
});

test("DETAIL V2 invalid positive-day null remains storage 500 and V1 extensions cannot leak as valid", async () => {
  for (const row of [{ ...stored(1), days_until_available_water_exhaustion: null }, { ...stored(1, ACTIVE_V1), furrow_count: 18 }]) {
    state.data.rows = [row];
    const r = await quiet(() => request({ method: "GET", route: `${base}/1` })); assert.equal(r.status, 500); assert.deepEqual(r.body, internal);
  }
});

test("DETAIL different/missing snapshot IDs return common 404 and mixed reads never expose another farm", async () => {
  state.data.rows = [stored(1, ACTIVE_V2, 9), stored(2, ACTIVE_V1, 8)];
  for (const id of [1, 2, 999]) {
    const r = await request({ method: "GET", route: `${base}/${id}` }); assert.equal(r.status, 404); assert.equal(r.body.code, "RESOURCE_NOT_FOUND");
  }
  assert.deepEqual((await request({ method: "GET" })).body.items, []);
  assert.equal(state.calculations, 0);
});
