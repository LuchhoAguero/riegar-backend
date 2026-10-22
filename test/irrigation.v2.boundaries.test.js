"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { calculateIrrigationSimulation: calculate } = require("../src/services/irrigation/v2/irrigation-calculator.service");
const { validateIrrigationOutput: outputCheck } = require("../src/services/irrigation/v2/irrigation-validation");
const golden = require("./fixtures/irrigation-v2-golden");
const input = () => structuredClone(golden.input);
function success(data) { const r = calculate(data); assert.equal(r.ok, true, JSON.stringify(r)); return r.output; }
function fails(data, code, field) {
  const r = calculate(data); assert.equal(r.ok, false);
  assert.deepEqual(Object.keys(r), ["ok", "errors"]);
  assert.ok(r.errors.some(e => e.code === code && e.field === field), JSON.stringify(r));
  const safe = JSON.parse(JSON.stringify(r)); assert.deepEqual(safe, r);
  assert.ok(r.errors.every(e => !Object.hasOwn(e, "received") || e.received === null ||
    typeof e.received === "boolean" || Number.isFinite(e.received)));
  return r;
}

test("count accepts the full positive safe integer domain without imposing exact integer totals", () => {
  for (const n of [1, 18, Number.MAX_SAFE_INTEGER]) {
    const data = input(); data.furrow.furrowCount = n; const r = calculate(data);
    assert.equal(r.ok, true); assert.equal(r.input.furrow.furrowCount, n);
    assert.equal(r.output.totals.totalAppliedVolumeL, 6480 * n);
    assert.ok(Number.isFinite(r.output.totals.totalAppliedVolumeL));
  }
  for (const value of [0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1]) {
    const data = input(); data.furrow.furrowCount = value;
    const r = fails(data, "OUT_OF_RANGE", "input.furrow.furrowCount");
    assert.equal(r.errors[0].rule, "positive_safe_integer");
  }
});

test("positive daily underflow fails instead of manufacturing a zero-use successful result", () => {
  const data = input(); data.crop.etoMmPerDay = Number.MIN_VALUE; data.crop.cropCoefficient = 0.5;
  assert.equal(data.crop.etoMmPerDay * data.crop.cropCoefficient, 0);
  const r = fails(data, "MODEL_INCONSISTENCY", "output.waterNeed.dailyCropWaterUseMmPerDay");
  assert.ok(r.errors.some(e => e.rule === "positive_daily_use_representable"));
});

test("daily overflow and infinite positive-use quotients identify their respective output fields", () => {
  const overflow = input(); overflow.crop.etoMmPerDay = Number.MAX_VALUE; overflow.crop.cropCoefficient = 2;
  fails(overflow, "NON_FINITE_RESULT", "output.waterNeed.dailyCropWaterUseMmPerDay");
  const tiny = input(); tiny.crop.etoMmPerDay = Number.MIN_VALUE; tiny.crop.cropCoefficient = 1;
  const r = fails(tiny, "NON_FINITE_RESULT", "output.soilWater.daysUntilAvailableWaterExhaustion");
  assert.ok(r.errors.some(e => e.code === "NON_FINITE_RESULT" && e.field === "output.soilWater.daysUntilDepletionThreshold"));
});

test("small positive finite daily use is not treated as zero via an epsilon", () => {
  const data = input(); data.crop.etoMmPerDay = 1e-200; data.crop.cropCoefficient = 1;
  const r = success(data); assert.equal(r.waterNeed.dailyCropWaterUseMmPerDay, 1e-200);
  assert.ok(Number.isFinite(r.soilWater.daysUntilAvailableWaterExhaustion));
  assert.ok(r.soilWater.daysUntilAvailableWaterExhaustion > 1e200);
  assert.notEqual(r.soilWater.daysUntilDepletionThreshold, null);
});

test("mathematically positive day horizons that underflow to zero are rejected", () => {
  const data = input(); data.crop.etoMmPerDay = Number.MAX_VALUE; data.crop.cropCoefficient = 1;
  data.crop.daysWithoutIrrigation = 0; data.soil.rootDepthM = 1e-320;
  const r = fails(data, "MODEL_INCONSISTENCY", "output.soilWater.daysUntilAvailableWaterExhaustion");
  assert.ok(r.errors.some(e => e.field === "output.soilWater.daysUntilDepletionThreshold"));
});

test("finite per-furrow application may overflow only when multiplied by a large valid count", () => {
  const data = input(); data.irrigation.flowLps = 1e300; data.furrow.furrowCount = Number.MAX_SAFE_INTEGER;
  assert.ok(Number.isFinite(data.irrigation.flowLps * 120 * 60));
  const r = fails(data, "NON_FINITE_RESULT", "output.totals.totalAppliedVolumeL");
  assert.ok(!r.errors.some(e => e.field === "output.application.appliedVolumeL"));
});

test("positive total liters whose m3 conversion underflows are rejected without a replacement value", () => {
  const data = input(); data.irrigation.flowLps = Number.MIN_VALUE;
  data.irrigation.durationMin = 1; data.irrigation.advanceTimeMin = 0;
  data.furrow.furrowSpacingM = Number.MIN_VALUE; data.furrow.lengthM = 1; data.furrow.furrowCount = 1;
  assert.ok(data.irrigation.flowLps * 60 > 0); assert.equal(data.irrigation.flowLps * 60 / 1000, 0);
  const r = fails(data, "MODEL_INCONSISTENCY", "output.totals.totalAppliedVolumeM3");
  assert.ok(!r.errors.some(e => e.field === "output.totals.totalAppliedVolumeL"));
});

test("advance endpoints preserve contact-time semantics and never create advance-band diagnostics", () => {
  const zero = input(); zero.irrigation.advanceTimeMin = 0; const z = success(zero);
  assert.equal(z.application.infiltratedDepthStartMm, z.application.infiltratedDepthMiddleMm);
  assert.equal(z.application.infiltratedDepthMiddleMm, z.application.infiltratedDepthEndMm);
  const full = input(); full.irrigation.advanceTimeMin = 120; const f = success(full);
  assert.equal(f.application.infiltratedDepthEndMm, 0); assert.equal(f.diagnostics.advanceRatioPct, 100);
  for (const ratio of [0, 25, 30, 50, 60, 100]) {
    const data = input(); data.irrigation.advanceTimeMin = 120 * ratio / 100;
    const r = success(data); assert.equal(r.diagnostics.advanceRatioPct, ratio);
    assert.ok(r.diagnostics.items.every(i => /^P0[1-5]$/.test(i.id)));
  }
});

test("Qmax retains canonical percentage conversion, separate zero branch and small-slope failure", () => {
  for (const [slope, expected] of [[0, 6.3], [0.3, 2.1], [1, 0.63], [2, 0.315], [1e-10, 6.3e9]]) {
    const data = input(); data.furrow.slopePct = slope; const actual = success(data).diagnostics.maxNonErosiveFlowLps;
    assert.ok(Math.abs(actual - expected) <= Math.max(1e-8, 1e-9 * Math.abs(expected)));
  }
  const tiny = input(); tiny.furrow.slopePct = Number.MIN_VALUE;
  fails(tiny, "NON_FINITE_RESULT", "output.diagnostics.maxNonErosiveFlowLps");
});

test("impossible balances accumulate errors with no clamp or partial result", () => {
  const data = input(); data.irrigation.flowLps = 0.3;
  const r = fails(data, "MODEL_INCONSISTENCY", "output.application.residualLossVolumeL");
  for (const field of ["output.efficiency.applicationEfficiencyPct", "output.application.estimatedUsefulVolumeL"]) {
    assert.ok(r.errors.some(e => e.field === field));
  }
  assert.equal(r.errors.length, 3);
});

test("output guards independently reject each positive-domain, loss and efficiency defect", () => {
  const cases = [["totals", "totalAppliedVolumeL", 0], ["totals", "totalAppliedVolumeM3", -1],
    ["totals", "totalAppliedVolumeM3", Infinity], ["waterNeed", "dailyCropWaterUseMmPerDay", -1],
    ["soilWater", "daysUntilAvailableWaterExhaustion", 0], ["soilWater", "daysUntilDepletionThreshold", -1],
    ["application", "residualLossVolumeL", -1], ["efficiency", "applicationEfficiencyPct", 101],
    ["application", "estimatedUsefulVolumeL", 6481]];
  for (const [group, field, value] of cases) {
    const data = structuredClone(golden.output); data[group][field] = value;
    const r = outputCheck(data); assert.equal(r.ok, false);
    assert.ok(r.errors.some(e => e.field === `output.${group}.${field}`)); assert.deepEqual(Object.keys(r), ["ok", "errors"]);
  }
});

test("strict diagnostic equalities emit no warning; message/evidence order remains P01/P03/P05", () => {
  const data = input(); data.crop = { etoMmPerDay: 4.5, cropCoefficient: 1, daysWithoutIrrigation: 1 };
  data.soil = { texture: null, fieldCapacityPct: 10, wiltingPointPct: 0, bulkDensityGcm3: 1, rootDepthM: 1, depletionThresholdPct: 4.5 };
  data.furrow.furrowSpacingM = 1; data.furrow.lengthM = 1;
  data.irrigation = { flowLps: 6.3, durationMin: 1, advanceTimeMin: 0 };
  const eq = success(data); assert.equal(eq.soilWater.maxRecommendedDepthMm, 4.5);
  assert.equal(eq.application.infiltratedDepthStartMm, 4.5); assert.deepEqual(eq.diagnostics.items, []);
  const changed = structuredClone(data); changed.crop.etoMmPerDay = 0; changed.soil.depletionThresholdPct = 1;
  changed.irrigation.flowLps = 7; const r = success(changed);
  assert.deepEqual(r.diagnostics.items.map(i => [i.id, i.evidence.point]), [
    ["P01", undefined], ["P03", "start"], ["P03", "middle"], ["P03", "end"],
    ["P05", "start"], ["P05", "middle"], ["P05", "end"],
  ]);
  for (const item of r.diagnostics.items) {
    assert.equal(item.ruleVersion, "irrigation-diagnostics-v1"); assert.equal(item.evidence.scientificValidation, "not_validated");
    assert.equal(item.evidence.source, "R1_comparison"); assert.ok(item.message.length > 0);
  }
});

test("V2 dependencies remain local and independent of V1, IO and environment", () => {
  const root = path.resolve(__dirname, "../src/services/irrigation/v2");
  for (const file of ["irrigation-models.js", "irrigation-validation.js", "irrigation-calculator.service.js"]) {
    const absolute = path.join(root, file); const source = fs.readFileSync(absolute, "utf8");
    assert.ok(!/\b(?:process|Date|fetch)\b|Math\.random/.test(source));
    const dependencies = [...source.matchAll(/require\("([^"]+)"\)/g)].map(m => m[1]);
    assert.ok(dependencies.every(d => d === "./irrigation-models" || d === "./irrigation-validation"));
    require(absolute);
    assert.ok(require.cache[absolute].children.every(child => path.dirname(child.filename) === root));
  }
});
