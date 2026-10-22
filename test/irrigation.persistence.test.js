const { test } = require("node:test");
const assert = require("node:assert/strict");
const knexFactory = require("knex");
const fs = require("node:fs");
const path = require("node:path");
const mapper = require("../src/services/irrigation-simulations.mapper");
const persistence = require("../src/services/irrigation-simulations.persistence");
const { createIrrigationSimulationService } = require("../src/services/irrigation-simulations.service");
const { calculateIrrigationSimulation: calculate } = require("../src/services/irrigation/irrigation-calculator.service");
const date = new Date("2026-10-13T15:30:45.123Z");
function input() {
  return { crop: { etoMmPerDay: 5, cropCoefficient: 0.7, daysWithoutIrrigation: 20 },
    soil: { texture: "Franco", fieldCapacityPct: 20, wiltingPointPct: 10, bulkDensityGcm3: 1.3, rootDepthM: 0.7, depletionThresholdPct: 60 },
    furrow: { widthM: 1.3, lengthM: 60, slopePct: 0 }, irrigation: { flowLps: 0.9, durationMin: 60, advanceTimeMin: 4.8 } };
}
function snapshot() { return mapper.mapCalculationToSnapshot({ fincaId: 7, calculationResult: calculate(input()), createdAt: date }); }

test("G01 mapper: exact 37 insertion columns plus generated id, all effective numbers and reproduction", () => {
  const result = calculate(input()), before = structuredClone(result);
  const row = mapper.mapCalculationToSnapshot({ fincaId: 7, name: "  Norte  ", calculationResult: result, createdAt: date });
  const source = fs.readFileSync(path.join(__dirname, "../db/migrations/20261012000000_create_irrigation_simulations.js"), "utf8");
  const columns = [...source.matchAll(/\.(?:increments|integer|string|double|specificType|json|datetime)\("([^"]+)"/g)].map(m => m[1]);
  assert.equal(columns.length, 38); assert.equal(Object.keys(row).length, 37);
  assert.deepEqual(Object.keys(row).sort(), columns.filter(c => c !== "id").sort());
  const expectedNumbers = { eto_mm_per_day: 5, crop_coefficient: 0.7, days_without_irrigation: 20, field_capacity_pct: 20,
    wilting_point_pct: 10, bulk_density_g_cm3: 1.3, root_depth_m: 0.7, depletion_threshold_pct: 60, width_m: 1.3,
    length_m: 60, slope_pct: 0, flow_lps: 0.9, duration_min: 60, advance_time_min: 4.8,
    target_depth_mm: 70, available_water_mm: 91, available_capacity_l: 7098, max_recommended_depth_mm: 54.6,
    max_recommended_volume_l: 4258.8, applied_volume_l: 3240, infiltrated_depth_start_mm: 34.856850115866756,
    infiltrated_depth_middle_mm: 34.15259872981849, infiltrated_depth_end_mm: 33.433516117812076,
    estimated_useful_volume_l: 2663.9027009258425, residual_loss_volume_l: 576.0972990741575,
    application_efficiency_pct: 82.21921916437785, advance_ratio_pct: 8, max_non_erosive_flow_lps: 6.3 };
  for (const [key, value] of Object.entries(expectedNumbers)) assert.ok(Math.abs(row[key] - value) <= Math.max(1e-8, 1e-9 * Math.abs(value)));
  const { INPUT_CONTRACT, OUTPUT_CONTRACT } = require("../src/services/irrigation/irrigation-models");
  for (const [contract, values] of [[INPUT_CONTRACT, result.input], [OUTPUT_CONTRACT, result.output]]) {
    for (const [group, fields] of Object.entries(contract)) for (const [field, d] of Object.entries(fields)) {
      if (d.type === "number") assert.equal(row[d.sqlColumn], values[group][field]);
    }
  }
  assert.equal(row.texture, "Franco"); assert.equal(row.name, "Norte"); assert.equal(row.finca_id, 7);
  assert.equal(row.model_version, result.modelVersion); assert.equal(row.contract_version, result.contractVersion);
  assert.equal(row.source_hash, result.sourceHash); assert.deepEqual(row.model_metadata, result.metadata);
  assert.deepEqual(row.diagnostics, result.output.diagnostics.items);
  assert.equal(row.created_at.toISOString(), date.toISOString()); assert.notEqual(row.created_at, date);
  row.model_metadata.effectiveParameters.infiltrationCoefficient = 99; row.diagnostics[0].fields.push("extra");
  assert.deepEqual(result, before);
});

test("name and timestamp validation: null/undefined, trim, Unicode 255 boundary, no truncation/default", () => {
  for (const value of [null, undefined]) assert.equal(mapper.normalizeName(value), null);
  assert.equal(mapper.normalizeName("  Mi riego  "), "Mi riego");
  assert.equal(mapper.normalizeName("😀".repeat(255)), "😀".repeat(255));
  for (const value of [" ", "a".repeat(256), "😀".repeat(256), false, 4, {}]) assert.throws(() => mapper.normalizeName(value), mapper.IrrigationApplicationError);
  for (const createdAt of [undefined, null, date.toISOString(), new Date(NaN), new Date("0999-01-01T00:00:00Z")]) {
    assert.throws(() => mapper.mapCalculationToSnapshot({ fincaId: 7, calculationResult: calculate(input()), createdAt }), TypeError);
  }
});

test("mapper rejects failed, partial or unsafe JSON calculation without manufacturing columns", () => {
  for (const result of [{ ok: false, errors: [] }, { ok: true }]) {
    assert.throws(() => mapper.mapCalculationToSnapshot({ fincaId: 7, calculationResult: result, createdAt: date }));
  }
  for (const corrupt of [r => { r.output.application.appliedVolumeL = null; }, r => { r.metadata.bad = Infinity; },
    r => { r.metadata.self = r.metadata; }, r => { r.sourceHash = "wrong"; }, r => { r.metadata = {}; }, r => { r.metadata = "{}"; }]) {
    const result = calculate(input()); corrupt(result);
    assert.throws(() => mapper.mapCalculationToSnapshot({ fincaId: 7, calculationResult: result, createdAt: date }));
  }
});

test("inverse mapping preserves historical JSON/version/message, Date UTC and all details without recalculation", () => {
  const row = { id: 17, ...snapshot() }; row.model_version = "historical-estimation";
  row.model_metadata.effectiveParameters.infiltrationCoefficient = 8;
  row.diagnostics[0].message = "Mensaje histórico original"; row.diagnostics[0].ruleVersion = "old-rule";
  const before = structuredClone(row);
  for (const textJson of [false, true]) {
    const stored = { ...row, model_metadata: textJson ? JSON.stringify(row.model_metadata) : row.model_metadata,
      diagnostics: textJson ? JSON.stringify(row.diagnostics) : row.diagnostics };
    const detail = mapper.mapStoredDetail(stored);
    assert.equal(detail.model.modelVersion, "historical-estimation"); assert.deepEqual(detail.input, input());
    assert.equal(detail.simulation.createdAt, "2026-10-13T15:30:45.123Z");
    assert.deepEqual(detail.metadata, row.model_metadata); assert.deepEqual(detail.output.diagnostics.items, row.diagnostics);
    detail.metadata.effectiveParameters.infiltrationCoefficient = -1;
  }
  assert.deepEqual(row, before);
  assert.throws(() => mapper.mapStoredDetail({ ...row, diagnostics: JSON.stringify(JSON.stringify(row.diagnostics)) }));
  assert.throws(() => mapper.mapStoredDetail({ ...row, model_metadata: "broken" }));
  const summary = mapper.mapHistorySummary(row);
  assert.deepEqual(summary.summary.diagnostics, { count: 2, severities: ["warning"] });
  assert.ok(!Object.hasOwn(summary, "metadata") && !Object.hasOwn(summary, "input"));
});

test("pagination validates limits and canonical UTC cursor without Number coercion", () => {
  assert.deepEqual(mapper.validatePagination(), { limit: 20, cursor: null });
  assert.deepEqual(mapper.validatePagination({ limit: 100, cursor: { createdAt: date.toISOString(), id: 7 } }),
    { limit: 100, cursor: { createdAt: date, id: 7 } });
  for (const limit of [0, 101, 1.5, "20", null]) assert.throws(() => mapper.validatePagination({ limit }));
  for (const cursor of [{}, { createdAt: "2026-02-30T00:00:00.000Z", id: 7 }, { createdAt: date.toISOString(), id: "7" },
    { createdAt: "2026-10-13T12:30:45.123-03:00", id: 7 }, { createdAt: date.toISOString(), id: 7, extra: true }]) {
    assert.throws(() => mapper.validatePagination({ cursor }));
  }
});

test("repository serializes JSON once, preserves Date/Number, uses supplied trx and propagates failures", async () => {
  const row = snapshot(), before = structuredClone(row); let written;
  const trx = table => { assert.equal(table, "irrigation_simulations"); return { async insert(value) { written = value; return [17]; } }; };
  assert.equal(await persistence.insertSnapshot(trx, row), 17);
  assert.deepEqual(JSON.parse(written.model_metadata), row.model_metadata);
  assert.deepEqual(JSON.parse(written.diagnostics), row.diagnostics);
  assert.equal(written.created_at, row.created_at); assert.equal(written.estimated_useful_volume_l, row.estimated_useful_volume_l);
  assert.deepEqual(row, before);
  await assert.rejects(() => persistence.insertSnapshot(trx, { ...row, diagnostics: "[]" }));
  const error = new Error("DB failure");
  await assert.rejects(() => persistence.insertSnapshot(() => ({ insert() { throw error; } }), row), e => e === error);
});

test("actual Knex offline SQL: shared lock, scoped detail, grouped cursor/order/limit+1, JSON bindings", async () => {
  const k = knexFactory({ client: "mysql2" });
  try {
    const farm = persistence.findOwnedFarm(k, 42, 7, true).toSQL();
    assert.match(farm.sql, /lock in share mode$/); assert.deepEqual(farm.bindings, [7, 42, 1]);
    const query = persistence.listSnapshots(k, { userId: 42, fincaId: 7, limit: 20, cursor: { createdAt: date, id: 17 } }).toSQL();
    assert.match(query.sql, /where `s`\.`finca_id` = \? and `f`\.`user_id` = \? and \(`s`\.`created_at` < \? or \(`s`\.`created_at` = \? and `s`\.`id` < \?\)\)/);
    assert.match(query.sql, /order by `s`\.`created_at` desc, `s`\.`id` desc limit \?$/);
    assert.deepEqual(query.bindings, [7, 42, date, date, 17, 21]);
    assert.ok(!query.sql.includes("offset") && !query.sql.includes("model_metadata"));
    const detail = persistence.findSnapshot(k, { userId: 42, fincaId: 7, simulationId: 17 }).toSQL();
    assert.deepEqual(detail.bindings, [17, 7, 42, 1]); assert.match(detail.sql, /inner join `fincas`/);
    let compiled;
    await persistence.insertSnapshot(table => ({ async insert(row) { compiled = k(table).insert(row).toSQL(); return [17]; } }), snapshot());
    assert.ok(compiled.bindings.some(value => typeof value === "string" && value.startsWith('{"metadataSchemaVersion"')));
    assert.ok(compiled.bindings.some(value => typeof value === "string" && value.startsWith('[{"id":"P02"')));
  } finally { await k.destroy(); }
});

// Stateful Knex double for application coordination; actual query shape is tested above.
function database({ owned = true, failInsert = false, missingReadback = false, rows = [] } = {}) {
  const state = { events: [], queries: [], rows: structuredClone(rows), staged: [] };
  function connection(data, scope) {
    return table => {
      const query = { table, filters: {}, scope, lock: false }; state.queries.push(query);
      const chain = {
        where(filters) { if (typeof filters === "object") query.filters = filters; return chain; },
        forShare() { query.lock = true; return chain; }, join() { return chain; }, select() { return chain; },
        andWhere(callback) {
          const outer = {
            where(column, operator, value) { query.cursorDate = value; return outer; },
            orWhere(nested) {
              nested.call({ where() { return this; }, andWhere(column, operator, value) { query.cursorId = value; return this; } });
              return outer;
            },
          }; callback.call(outer); return chain;
        }, orderBy() { return chain; },
        async first() {
          if (table === "fincas") return owned ? { id: 7, user_id: 42 } : undefined;
          if (missingReadback) return undefined;
          return data.find(row => row.id === query.filters["s.id"] && row.finca_id === query.filters["s.finca_id"]);
        },
        async insert(row) {
          state.events.push("insert"); if (failInsert) throw Object.assign(new Error("FK failure"), { errno: 1452 });
          data.push({ id: 17, ...row }); state.staged = structuredClone(data); return [17];
        },
        async limit(n) {
          query.limit = n;
          return data.filter(row => !query.cursorDate || row.created_at < query.cursorDate ||
            (row.created_at.getTime() === query.cursorDate.getTime() && row.id < query.cursorId)).slice(0, n);
        },
      }; return chain;
    };
  }
  const db = connection(state.rows, "db");
  db.transaction = async callback => {
    state.events.push("begin"); const work = structuredClone(state.rows);
    try { const r = await callback(connection(work, "trx")); state.rows.splice(0, state.rows.length, ...work); state.events.push("commit"); return r; }
    catch (e) { state.events.push("rollback"); throw e; }
  };
  return { db, state };
}

test("service creation: owned lock, motor once, insert once, readback and success only after commit", async () => {
  const { db, state } = database(); let calls = 0;
  const svc = createIrrigationSimulationService(db, { now: () => date, calculate: data => { calls++; return calculate(data); } });
  const r = await svc.create({ userId: 42, fincaId: 7, name: " Norte ", canonicalInput: input() });
  assert.equal(r.kind, "SUCCESS"); assert.equal(r.snapshot.simulation.id, 17); assert.equal(r.snapshot.simulation.name, "Norte");
  assert.deepEqual(r.snapshot.input, input()); assert.equal(r.snapshot.simulation.createdAt, date.toISOString());
  assert.equal(calls, 1); assert.equal(state.rows.length, 1); assert.deepEqual(state.events, ["begin", "insert", "commit"]);
  assert.deepEqual(state.queries[0], { table: "fincas", filters: { id: 7, user_id: 42 }, scope: "trx", lock: true });
  assert.ok(state.queries.every(q => q.scope === "trx"));
});

test("foreign/missing farm prevents calculation/write and hides malformed name/input", async () => {
  const { db, state } = database({ owned: false });
  const svc = createIrrigationSimulationService(db, { calculate: () => { throw new Error("must not run"); } });
  assert.deepEqual(await svc.create({ userId: 42, fincaId: 7, name: false, canonicalInput: {} }), { kind: "FARM_NOT_FOUND" });
  assert.equal(state.queries.length, 1); assert.deepEqual(state.rows, []);
  assert.deepEqual(await svc.history({ userId: 42, fincaId: 7 }), { kind: "FARM_NOT_FOUND" });
  assert.deepEqual(await svc.detail({ userId: 42, fincaId: 7, simulationId: 17 }), { kind: "FARM_NOT_FOUND" });
  assert.ok(state.queries.every(q => q.table === "fincas"));
});

test("model failures insert nothing; invalid application name and persistence/readback failures roll back", async () => {
  for (const change of [data => { data.irrigation.advanceTimeMin = 61; }, data => { data.irrigation.flowLps = 0.1; }]) {
    const { db, state } = database(), data = input(); change(data);
    const r = await createIrrigationSimulationService(db).create({ userId: 42, fincaId: 7, canonicalInput: data });
    assert.equal(r.kind, "MODEL_ERROR"); assert.ok(r.errors.length); assert.deepEqual(state.rows, []); assert.ok(!state.events.includes("insert"));
  }
  for (const options of [{ failInsert: true }, { missingReadback: true }]) {
    const { db, state } = database(options);
    await assert.rejects(() => createIrrigationSimulationService(db).create({ userId: 42, fincaId: 7, canonicalInput: input() }));
    assert.deepEqual(state.rows, []); assert.equal(state.events.at(-1), "rollback");
  }
  const { db, state } = database();
  await assert.rejects(() => createIrrigationSimulationService(db).create({ userId: 42, fincaId: 7, name: " ", canonicalInput: input() }), mapper.IrrigationApplicationError);
  assert.deepEqual(state.events, ["begin", "rollback"]);
});

test("history/detail read historical snapshots only; trim extra row and cursor from last returned", async () => {
  const rows = [3, 2, 1].map(id => ({ id, ...snapshot() }));
  const { db, state } = database({ rows });
  const svc = createIrrigationSimulationService(db, { calculate: () => { throw new Error("history must not calculate"); } });
  const r = await svc.history({ userId: 42, fincaId: 7, limit: 2 });
  assert.equal(r.kind, "SUCCESS"); assert.deepEqual(r.items.map(row => row.simulation.id), [3, 2]);
  assert.equal(r.items[0].model.modelVersion, "irrigation-estimation-v1");
  assert.deepEqual(r.pagination, { limit: 2, hasMore: true, nextCursor: { createdAt: date.toISOString(), id: 2 } });
  assert.equal(state.queries[0].table, "fincas"); assert.equal(state.queries[1].limit, 3);
  assert.deepEqual(state.queries[1].filters, { "s.finca_id": 7, "f.user_id": 42 });
  const next = await svc.history({ userId: 42, fincaId: 7, limit: 2, cursor: r.pagination.nextCursor });
  assert.deepEqual(next.items.map(row => row.simulation.id), [1]); assert.equal(next.pagination.nextCursor, null);
  const detail = await svc.detail({ userId: 42, fincaId: 7, simulationId: 3 });
  assert.equal(detail.snapshot.model.modelVersion, "irrigation-estimation-v1");
  assert.deepEqual(await svc.detail({ userId: 42, fincaId: 7, simulationId: 999 }), { kind: "SIMULATION_NOT_FOUND" });
  assert.deepEqual((await svc.history({ userId: 42, fincaId: 7, limit: 3 })).pagination, { limit: 3, hasMore: false, nextCursor: null });
});
