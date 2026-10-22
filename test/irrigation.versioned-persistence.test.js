"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const knexFactory = require("knex");
const { ACTIVE_V1, ACTIVE_V2, IrrigationSnapshotError } = require("../src/services/irrigation-simulations.versions");
const facade = require("../src/services/irrigation-simulations.versioned-mapper");
const legacy = require("../src/services/irrigation-simulations.mapper");
const mapper = require("../src/services/irrigation-simulations.v2-mapper");
const persistence = require("../src/services/irrigation-simulations.persistence");
const { V2_COLUMNS } = require("../src/services/irrigation-simulations.snapshot");
const golden = require("./fixtures/irrigation-v2-golden");
const date = new Date("2026-10-20T15:30:45.123Z");
function inputV1() {
  const data = structuredClone(golden.input); data.furrow.widthM = data.furrow.furrowSpacingM;
  delete data.furrow.furrowSpacingM; delete data.furrow.furrowCount;
  data.irrigation.durationMin = 60; data.irrigation.advanceTimeMin = 4.8; return data;
}
function calculation(d = ACTIVE_V2, zero = false) {
  const input = d === ACTIVE_V1 ? inputV1() : structuredClone(golden.input);
  if (zero) input.crop.etoMmPerDay = 0;
  const r = d.calculate(input); assert.equal(r.ok, true); return r;
}
function stored(d = ACTIVE_V2, zero = false, id = 1) {
  const row = { id, ...facade.mapCalculationToSnapshotVersioned({ fincaId: 7, name: "Norte", createdAt: date,
    calculationResult: calculation(d, zero) }, { descriptor: d }) };
  if (d === ACTIVE_V1) for (const column of V2_COLUMNS) row[column] = null;
  return row;
}
function invalid(callback, reason = "SNAPSHOT_SHAPE_INVALID") {
  assert.throws(callback, e => e instanceof IrrigationSnapshotError && e.reason === reason && !(e instanceof legacy.IrrigationApplicationError));
}

test("V1 facade writes exactly the legacy 37 columns, with no new defaults or changed values", () => {
  const args = { fincaId: 7, name: "  Norte  ", createdAt: date, calculationResult: calculation(ACTIVE_V1) };
  const before = structuredClone(args), expected = legacy.mapCalculationToSnapshot(args);
  const mapped = facade.mapCalculationToSnapshotVersioned(args, { descriptor: ACTIVE_V1 });
  assert.equal(Object.keys(mapped).length, 37); assert.deepEqual(mapped, expected); assert.deepEqual(args, before);
  assert.equal(mapped.width_m, 1.3); assert.ok(V2_COLUMNS.every(c => !Object.hasOwn(mapped, c)));
});

test("V2 write maps all 43 insert columns without recomputing, rounding or adding aliases", () => {
  const result = calculation(), before = structuredClone(result);
  const row = facade.mapCalculationToSnapshotVersioned({ fincaId: 7, name: " Norte ", createdAt: date, calculationResult: result }, { descriptor: ACTIVE_V2 });
  assert.equal(Object.keys(row).length, 43); assert.equal(row.name, "Norte"); assert.equal(row.width_m, 1.3);
  assert.equal(row.furrow_count, 18); assert.equal(row.finca_id, 7); assert.equal(row.source_hash, golden.sourceHash);
  assert.equal(row.daily_crop_water_use_mm_per_day, 3.5); assert.equal(row.days_until_available_water_exhaustion, 26);
  assert.equal(row.days_until_depletion_threshold, 15.6); assert.equal(row.total_applied_volume_l, 116640);
  assert.equal(row.total_applied_volume_m3, 116.64);
  for (const [contract, values] of [[ACTIVE_V2.INPUT_CONTRACT, result.input], [ACTIVE_V2.OUTPUT_CONTRACT, result.output]]) {
    for (const [g, fields] of Object.entries(contract)) for (const [f, def] of Object.entries(fields)) {
      if (def.type !== "diagnostics") assert.equal(row[def.sqlColumn], values[g][f]);
    }
  }
  assert.equal(row.created_at.toISOString(), date.toISOString()); assert.notEqual(row.created_at, date);
  assert.deepEqual(row.model_metadata, golden.metadata); assert.deepEqual(row.diagnostics, golden.output.diagnostics.items);
  assert.ok(!Object.hasOwn(row, "furrow_spacing_m") && !Object.hasOwn(row, "widthM"));
  row.model_metadata.assumptions.furrowSpacingMeaning = "changed"; row.diagnostics[0].evidence.changed = true;
  assert.deepEqual(result, before);
});

test("write retains name, Unicode capacity, server Date and ID validation", () => {
  for (const d of [ACTIVE_V1, ACTIVE_V2]) {
    for (const name of [undefined, null, "  Norte  ", "😀".repeat(255)]) {
      const r = facade.mapCalculationToSnapshotVersioned({ fincaId: 7, name, createdAt: date, calculationResult: calculation(d) }, { descriptor: d });
      assert.equal(r.name, name == null ? null : name.trim());
    }
    for (const name of ["", " ", "😀".repeat(256), 1]) {
      assert.throws(() => facade.mapCalculationToSnapshotVersioned({ fincaId: 7, name, createdAt: date, calculationResult: calculation(d) }, { descriptor: d }),
        legacy.IrrigationApplicationError);
    }
    for (const fincaId of [0, -1, "7", 4294967296]) {
      assert.throws(() => facade.mapCalculationToSnapshotVersioned({ fincaId, createdAt: date, calculationResult: calculation(d) }, { descriptor: d }), legacy.IrrigationApplicationError);
    }
    for (const createdAt of [null, date.toISOString(), new Date(NaN), new Date("0999-01-01T00:00:00Z")]) {
      invalid(() => facade.mapCalculationToSnapshotVersioned({ fincaId: 7, createdAt, calculationResult: calculation(d) }, { descriptor: d }));
    }
  }
});

test("write rejects failed, partial, noncanonical or unsafe V2 calculator snapshots", () => {
  for (const result of [{ ok: false, errors: [] }, { ok: true }]) {
    invalid(() => mapper.mapCalculationToSnapshot({ fincaId: 7, createdAt: date, calculationResult: result }));
  }
  for (const corrupt of [r => { r.input.furrow.furrowCount = "18"; }, r => { delete r.input.soil.texture; },
    r => { r.input.soil.texture = " Franco "; }, r => { r.output.application.appliedVolumeL = null; },
    r => { r.output.totals.totalAppliedVolumeM3 = Infinity; }, r => { r.metadata.self = r.metadata; },
    r => { r.metadata = JSON.stringify(r.metadata); }, r => { r.output.diagnostics.items = JSON.stringify(r.output.diagnostics.items); }]) {
    const result = calculation(); corrupt(result);
    invalid(() => facade.mapCalculationToSnapshotVersioned({ fincaId: 7, createdAt: date, calculationResult: result }, { descriptor: ACTIVE_V2 }));
  }
  const result = calculation(); let calls = 0;
  Object.defineProperty(result, "metadata", { get() { calls++; throw Error("must not run"); } });
  invalid(() => facade.mapCalculationToSnapshotVersioned({ fincaId: 7, createdAt: date, calculationResult: result }, { descriptor: ACTIVE_V2 }));
  assert.equal(calls, 0);
});

test("V2 detail reconstructs exact inputs/outputs and JSON object/text snapshots without mutation", () => {
  for (const text of [false, true]) {
    const row = stored(); if (text) { row.model_metadata = JSON.stringify(row.model_metadata); row.diagnostics = JSON.stringify(row.diagnostics); }
    const before = structuredClone(row), r = facade.mapStoredDetailVersioned(row);
    assert.deepEqual(r.input, golden.input); assert.deepEqual(r.output, golden.output); assert.deepEqual(r.metadata, golden.metadata);
    assert.equal(r.simulation.createdAt, date.toISOString()); assert.equal(r.simulation.fincaId, 7);
    assert.deepEqual(r.model, { modelVersion: golden.modelVersion, contractVersion: golden.contractVersion, sourceHash: golden.sourceHash });
    assert.ok(!Object.hasOwn(r.input.furrow, "widthM"));
    r.input.furrow.furrowCount = 1; r.metadata.assumptions.furrowSpacingMeaning = "changed"; r.output.diagnostics.items[0].fields.push("changed");
    assert.deepEqual(row, before);
  }
});

test("V1 detail and history preserve legacy shapes, including absent or all-null future extensions", () => {
  const old = stored(ACTIVE_V1); const withoutColumns = { ...old }; for (const c of V2_COLUMNS) delete withoutColumns[c];
  for (const row of [old, withoutColumns]) {
    assert.deepEqual(facade.mapStoredDetailVersioned(row), legacy.mapStoredDetail(row));
    assert.deepEqual(facade.mapHistorySummaryVersioned(row), legacy.mapHistorySummary(row));
    const detail = facade.mapStoredDetailVersioned(row); assert.equal(detail.input.furrow.widthM, 1.3);
    assert.ok(!Object.hasOwn(detail.input.furrow, "furrowSpacingM")); assert.ok(!Object.hasOwn(detail.output, "totals"));
    const summary = facade.mapHistorySummaryVersioned(row).summary;
    assert.ok(!Object.hasOwn(summary, "furrowCount") && !Object.hasOwn(summary, "totalAppliedVolumeL"));
  }
  for (const c of V2_COLUMNS) {
    const bad = { ...old, [c]: 1 }; invalid(() => facade.mapStoredDetailVersioned(bad)); invalid(() => facade.mapHistorySummaryVersioned(bad));
  }
});

test("count readback accepts safe Numbers and canonical decimals including MAX_SAFE_INTEGER", () => {
  for (const count of [1, 18, Number.MAX_SAFE_INTEGER]) for (const raw of [count, String(count)]) {
    const row = stored(); row.furrow_count = raw;
    assert.equal(facade.mapStoredDetailVersioned(row).input.furrow.furrowCount, count);
    assert.equal(facade.mapHistorySummaryVersioned(row).summary.furrowCount, count);
    assert.equal(mapper.readFurrowCount(raw), count);
  }
});

test("count adapter rejects ambiguous decimals, unsafe types and out-of-range values", () => {
  for (const raw of ["018", "+18", "18 ", " 18", "18\n", "18\r\n", "18\u2028", "1e3", "18.0", "0", "-1", "", "9007199254740992", "99999999999999999",
    0, -1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1, null, undefined, 18n, {}, true]) {
    invalid(() => mapper.readFurrowCount(raw));
    const row = stored(); row.furrow_count = raw;
    invalid(() => facade.mapStoredDetailVersioned(row)); invalid(() => facade.mapHistorySummaryVersioned(row));
  }
});

test("zero daily days roundtrip as explicit nulls for every legitimate zero input", () => {
  for (const [e, k] of [[0, 0.7], [5, 0], [0, 0]]) {
    const input = structuredClone(golden.input); input.crop.etoMmPerDay = e; input.crop.cropCoefficient = k;
    const row = { id: 1, ...mapper.mapCalculationToSnapshot({ fincaId: 7, createdAt: date, calculationResult: ACTIVE_V2.calculate(input) }) };
    assert.equal(row.daily_crop_water_use_mm_per_day, 0);
    assert.equal(row.days_until_available_water_exhaustion, null); assert.equal(row.days_until_depletion_threshold, null);
    const detail = facade.mapStoredDetailVersioned(row);
    assert.ok(Object.hasOwn(detail.output.soilWater, "daysUntilAvailableWaterExhaustion"));
    assert.ok(Object.hasOwn(detail.output.soilWater, "daysUntilDepletionThreshold"));
    assert.equal(detail.output.soilWater.daysUntilAvailableWaterExhaustion, null); assert.equal(detail.output.soilWater.daysUntilDepletionThreshold, null);
  }
});

test("invalid day storage is never silently converted to null, zero or Number", () => {
  for (const zero of [false, true]) for (const field of ["days_until_available_water_exhaustion", "days_until_depletion_threshold"]) {
    for (const value of zero ? [undefined, 0, 1, "1", NaN, Infinity] : [undefined, null, 0, -1, "26", NaN, Infinity]) {
      const row = stored(ACTIVE_V2, zero); row[field] = value; invalid(() => facade.mapStoredDetailVersioned(row));
    }
    const row = stored(ACTIVE_V2, zero); delete row[field]; invalid(() => facade.mapStoredDetailVersioned(row));
  }
});

test("detail does not recalculate stored numbers, metadata parameters, messages or evidence", () => {
  for (const d of [ACTIVE_V1, ACTIVE_V2]) {
    const row = stored(d); row.model_metadata.effectiveParameters.infiltrationCoefficient = 8;
    row.diagnostics[0].message = "Texto histórico conservado"; row.diagnostics[0].evidence.historical = 0.1234567890123456;
    row.estimated_useful_volume_l = 1.2345678901234567; row.residual_loss_volume_l = 123.45678901234567;
    row.application_efficiency_pct = 3.141592653589793;
    if (d === ACTIVE_V2) { row.days_until_available_water_exhaustion = 2.345678901234567; row.total_applied_volume_l = 17.123456789012345; }
    const before = structuredClone(row), r = facade.mapStoredDetailVersioned(row);
    assert.equal(r.metadata.effectiveParameters.infiltrationCoefficient, 8);
    assert.deepEqual(r.output.diagnostics.items, row.diagnostics); assert.equal(r.output.application.estimatedUsefulVolumeL, row.estimated_useful_volume_l);
    assert.equal(r.output.application.residualLossVolumeL, row.residual_loss_volume_l); assert.equal(r.output.efficiency.applicationEfficiencyPct, row.application_efficiency_pct);
    if (d === ACTIVE_V2) { assert.equal(r.output.soilWater.daysUntilAvailableWaterExhaustion, row.days_until_available_water_exhaustion);
      assert.equal(r.output.totals.totalAppliedVolumeL, row.total_applied_volume_l); }
    assert.deepEqual(row, before);
  }
});

test("public projection preserves exactly nine stored metadata sections for both versions", () => {
  for (const d of [ACTIVE_V1, ACTIVE_V2]) {
    const row = stored(d); row.model_metadata.internalDebug = "private";
    row.model_metadata.assumptions.historicalNote = "preserve nested content";
    const detail = facade.mapStoredDetailVersioned(row); detail.internalDebug = "private top level";
    const projected = facade.publicSnapshotVersioned(detail);
    assert.deepEqual(Object.keys(projected), ["simulation", "model", "input", "output", "metadata"]);
    assert.deepEqual(Object.keys(projected.metadata), d.publicMetadataKeys);
    assert.equal(projected.metadata.assumptions.historicalNote, "preserve nested content");
    assert.ok(!Object.hasOwn(projected.metadata, "internalDebug")); assert.ok(!Object.hasOwn(projected, "internalDebug"));
    for (const key of d.publicMetadataKeys) assert.deepEqual(projected.metadata[key], row.model_metadata[key]);
    projected.metadata.assumptions.historicalNote = "changed";
    assert.equal(row.model_metadata.assumptions.historicalNote, "preserve nested content");
  }
});

test("mixed histories retain supplied ordering and version-specific summaries without null placeholders", () => {
  const rows = [stored(ACTIVE_V1, false, 9), stored(ACTIVE_V2, false, 8), stored(ACTIVE_V2, true, 7)];
  const before = structuredClone(rows), items = rows.map(facade.mapHistorySummaryVersioned);
  assert.deepEqual(items.map(i => i.simulation.id), [9, 8, 7]);
  assert.deepEqual(Object.keys(items[0].summary), ["targetDepthMm", "appliedVolumeL", "applicationEfficiencyPct", "diagnostics"]);
  for (const i of items.slice(1)) {
    assert.deepEqual(Object.keys(i.summary), ["targetDepthMm", "appliedVolumeL", "applicationEfficiencyPct", "diagnostics", "furrowCount", "totalAppliedVolumeL"]);
    assert.equal(i.summary.appliedVolumeL, 6480); assert.equal(i.summary.furrowCount, 18); assert.equal(i.summary.totalAppliedVolumeL, 116640);
    assert.ok(!Object.hasOwn(i, "metadata") && !Object.hasOwn(i.summary, "totalAppliedVolumeM3"));
  }
  assert.deepEqual(rows, before);
  const unknown = structuredClone(rows); unknown[1].contract_version = "unknown";
  invalid(() => unknown.map(facade.mapHistorySummaryVersioned), "UNSUPPORTED_CONTRACT");
});

test("mixed detail keeps fourteen V1 versus nineteen V2 magnitudes and null zero-use days", () => {
  const details = [stored(ACTIVE_V1), stored(ACTIVE_V2), stored(ACTIVE_V2, true)].map(facade.mapStoredDetailVersioned);
  const magnitudeCount = d => Object.values(d.output).flatMap(Object.values).filter(x => !Array.isArray(x)).length;
  assert.equal(magnitudeCount(details[0]), 14); assert.equal(magnitudeCount(details[1]), 19); assert.equal(magnitudeCount(details[2]), 19);
  assert.equal(details[0].metadata.metadataSchemaVersion, "irrigation-metadata-v1");
  assert.equal(details[1].metadata.metadataSchemaVersion, "irrigation-metadata-v2");
  assert.equal(details[2].output.soilWater.daysUntilDepletionThreshold, null);
});

test("corrupt detail/history rows fail as internal storage errors, never application input errors", () => {
  for (const change of [r => { delete r.total_applied_volume_l; }, r => { r.total_applied_volume_l = "116640"; },
    r => { r.total_applied_volume_l = 0; }, r => { r.total_applied_volume_l = Infinity; },
    r => { r.id = "1"; }, r => { r.created_at = date.toISOString(); }, r => { r.diagnostics[0].ruleVersion = "unknown"; }]) {
    const row = stored(); change(row);
    assert.throws(() => facade.mapHistorySummaryVersioned(row), e => e instanceof IrrigationSnapshotError && !(e instanceof legacy.IrrigationApplicationError));
    assert.throws(() => facade.mapStoredDetailVersioned(row), e => e instanceof IrrigationSnapshotError && !(e instanceof legacy.IrrigationApplicationError));
  }
});

test("persistence serializes objects/arrays exactly once with no schema or identity changes", async () => {
  for (const d of [ACTIVE_V1, ACTIVE_V2]) {
    const row = stored(d), before = structuredClone(row); let captured;
    const trx = table => { assert.equal(table, "irrigation_simulations"); return { async insert(value) { captured = value; return [42]; } }; };
    assert.equal(await persistence.insertSnapshot(trx, row), 42);
    assert.equal(typeof captured.model_metadata, "string"); assert.equal(typeof captured.diagnostics, "string");
    assert.deepEqual(JSON.parse(captured.model_metadata), row.model_metadata); assert.deepEqual(JSON.parse(captured.diagnostics), row.diagnostics);
    assert.equal(captured.created_at, row.created_at); if (d === ACTIVE_V2) assert.equal(captured.furrow_count, 18);
    assert.deepEqual(row, before);
    await assert.rejects(() => persistence.insertSnapshot(trx, { ...row, diagnostics: JSON.stringify(row.diagnostics) }));
    await assert.rejects(() => persistence.insertSnapshot(trx, { ...row, model_metadata: JSON.stringify(row.model_metadata) }));
  }
});

test("expanded HISTORY SQL is opt-in and preserves ownership, grouped cursor, ordering and limit", async () => {
  const k = knexFactory({ client: "mysql2" });
  const options = { userId: 42, fincaId: 7, limit: 2, cursor: { createdAt: date, id: 9 } };
  try {
    const old = persistence.listSnapshots(k, options).toSQL(), expanded = persistence.listVersionedSnapshots(k, options).toSQL();
    assert.ok(!old.sql.includes("model_metadata") && !old.sql.includes("furrow_count"));
    assert.deepEqual(persistence.VERSIONED_HISTORY_COLUMNS, [...persistence.HISTORY_COLUMNS, "furrow_count", "total_applied_volume_l", "model_metadata"]);
    assert.ok(Object.isFrozen(persistence.VERSIONED_HISTORY_COLUMNS));
    for (const c of persistence.VERSIONED_HISTORY_COLUMNS) assert.ok(expanded.sql.includes('`s`.`' + c + '`'));
    assert.match(expanded.sql, /where `s`\.`finca_id` = \? and `f`\.`user_id` = \? and \(`s`\.`created_at` < \? or \(`s`\.`created_at` = \? and `s`\.`id` < \?\)\)/);
    assert.match(expanded.sql, /order by `s`\.`created_at` desc, `s`\.`id` desc limit \?$/);
    assert.deepEqual(expanded.bindings, [7, 42, date, date, 9, 3]); assert.deepEqual(old.bindings, expanded.bindings);
    assert.ok(!expanded.sql.includes("offset") && !expanded.sql.includes("days_until") && !expanded.sql.includes("total_applied_volume_m3"));
  } finally { await k.destroy(); }
});
