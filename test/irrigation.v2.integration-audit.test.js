const { test } = require("node:test");
const assert = require("node:assert/strict");
const knex = require("knex");
const original = require("../db/migrations/20261012000000_create_irrigation_simulations");
const extension = require("../db/migrations/20261014000000_extend_irrigation_simulations_v2");
const golden = require("./fixtures/irrigation-v2-golden");
const { ACTIVE_V2 } = require("../src/services/irrigation-simulations.versions");
const facade = require("../src/services/irrigation-simulations.versioned-mapper");
const { VERSIONED_HISTORY_COLUMNS } = require("../src/services/irrigation-simulations.persistence");

test("D5: actual compiled schema columns equal V2 INSERT names; independent golden values roundtrip without swapped fields", async () => {
  const compiler = knex({ client: "mysql2" }); // Compile only; no connection.
  try {
    let baseSQL;
    original.up({ schema: { createTable(name, callback) {
      baseSQL = compiler.schema.createTable(name, callback).toSQL().map((s) => s.sql).join("\n");
    } } });
    const baseColumns = [...baseSQL.matchAll(/`(\w+)` (?:int|varchar|double|char|json|datetime)/g)].map((m) => m[1]);
    const baseChecks = [...baseSQL.matchAll(/constraint (\w+) check/g)].map((m) => m[1]);
    const newSQL = [];
    await extension.up({
      async raw(query, bindings) {
        assert.match(query, /INFORMATION_SCHEMA/);
        assert.deepEqual(bindings, ["irrigation_simulations", "irrigation_simulations"]);
        return [[...baseColumns.map((name) => ({ kind: "column", name })),
          ...baseChecks.map((name) => ({ kind: "check", name }))], []];
      },
      schema: { alterTable(name, callback) {
        newSQL.push(...compiler.schema.alterTable(name, callback).toSQL().map((s) => s.sql));
        return Promise.resolve();
      } },
    });
    const newColumns = [...newSQL.join("\n").matchAll(/add `(\w+)`/g)].map((m) => m[1]);
    assert.deepEqual(newColumns, ["furrow_count", "daily_crop_water_use_mm_per_day",
      "days_until_available_water_exhaustion", "days_until_depletion_threshold",
      "total_applied_volume_l", "total_applied_volume_m3"]);
    const allColumns = [...baseColumns, ...newColumns];
    assert.equal(allColumns.length, 44); assert.equal(new Set(allColumns).size, 44);
    assert.equal(baseChecks.length + newSQL.filter((s) => /\bcheck\s*\(/i.test(s)).length, 14);
    // The expected result comes from the approved literal fixture, not a calculator.
    const result = { ok: true, modelVersion: golden.modelVersion, contractVersion: golden.contractVersion,
      sourceHash: golden.sourceHash, input: golden.input, output: golden.output, metadata: golden.metadata };
    const written = facade.mapCalculationToSnapshotVersioned({ fincaId: 7, name: "Norte", calculationResult: result,
      createdAt: new Date("2026-10-21T12:00:00.000Z") }, { descriptor: ACTIVE_V2 });
    assert.deepEqual(Object.keys(written).sort(), allColumns.filter((c) => c !== "id").sort());
    assert.equal(written.width_m, 1.3); assert.equal(written.furrow_count, 18);
    assert.equal(written.daily_crop_water_use_mm_per_day, 3.5);
    assert.equal(written.days_until_available_water_exhaustion, 26);
    assert.equal(written.days_until_depletion_threshold, 15.6);
    assert.equal(written.total_applied_volume_l, 116640); assert.equal(written.total_applied_volume_m3, 116.64);
    const read = facade.mapStoredDetailVersioned({ id: 1, ...written });
    assert.deepEqual(read.input, golden.input); assert.deepEqual(read.output, golden.output);
    assert.deepEqual(read.metadata, golden.metadata);
    assert.ok(VERSIONED_HISTORY_COLUMNS.every((c) => allColumns.includes(c)));
  } finally { await compiler.destroy(); }
});

test("D5: exact HISTORY projection supports dispatch and summary with no hidden full-row dependency", () => {
  assert.deepEqual([...VERSIONED_HISTORY_COLUMNS].sort(), ["id", "finca_id", "name", "created_at", "model_version",
    "contract_version", "source_hash", "target_depth_mm", "applied_volume_l", "application_efficiency_pct",
    "diagnostics", "furrow_count", "total_applied_volume_l", "model_metadata"].sort());
  const row = { id: 1, finca_id: 7, name: null, created_at: new Date("2026-10-21T12:00:00.000Z"),
    model_version: golden.modelVersion, contract_version: golden.contractVersion, source_hash: golden.sourceHash,
    target_depth_mm: 70, applied_volume_l: 6480, application_efficiency_pct: 56.8104792758832,
    diagnostics: golden.output.diagnostics.items, furrow_count: "18", total_applied_volume_l: 116640,
    model_metadata: golden.metadata };
  const summary = facade.mapHistorySummaryVersioned(row);
  assert.deepEqual(Object.keys(summary).sort(), ["simulation", "model", "summary"].sort());
  assert.deepEqual(Object.keys(summary.summary).sort(), ["targetDepthMm", "appliedVolumeL", "applicationEfficiencyPct",
    "diagnostics", "furrowCount", "totalAppliedVolumeL"].sort());
  assert.equal(summary.summary.furrowCount, 18); assert.equal(summary.summary.totalAppliedVolumeL, 116640);
  assert.equal(summary.summary.appliedVolumeL, 6480);
});
