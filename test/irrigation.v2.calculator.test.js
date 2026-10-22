"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { calculateIrrigationSimulation: calculate } = require("../src/services/irrigation/v2/irrigation-calculator.service");
const { calculateIrrigationSimulation: calculateV1 } = require("../src/services/irrigation/irrigation-calculator.service");
const golden = require("./fixtures/irrigation-v2-golden");
const input = () => structuredClone(golden.input);
function near(a, b) { assert.ok(Number.isFinite(a)); assert.ok(Math.abs(a - b) <= Math.max(1e-8, 1e-9 * Math.abs(b)), `${a} != ${b}`); }
function success(data) { const r = calculate(data); assert.equal(r.ok, true, JSON.stringify(r)); return r; }

test("GV2-01: all nineteen literal expected values, complete diagnostics and exact approved metadata", () => {
  const r = success(input()); let count = 0;
  for (const [g, fields] of Object.entries(golden.output)) for (const [f, value] of Object.entries(fields)) {
    if (typeof value === "number") { near(r.output[g][f], value); count++; }
    else assert.deepEqual(r.output[g][f], value);
  }
  assert.equal(count, 19); assert.deepEqual(r.input, golden.input); assert.deepEqual(r.metadata, golden.metadata);
  assert.equal(r.modelVersion, golden.modelVersion); assert.equal(r.contractVersion, golden.contractVersion); assert.equal(r.sourceHash, golden.sourceHash);
  assert.deepEqual(Object.keys(r), ["ok", "modelVersion", "contractVersion", "sourceHash", "input", "output", "metadata"]);
  assert.equal(r.output.soilWater.daysUntilDepletionThreshold, 15.6);
});

test("repeated frozen-input calculations are deterministic and results do not share mutable snapshots", () => {
  function freeze(o) { Object.freeze(o); for (const x of Object.values(o)) if (x && typeof x === "object") freeze(x); return o; }
  const data = freeze(input()), expected = success(data);
  for (let i = 0; i < 100; i++) {
    const r = success(data); assert.deepEqual(r, expected);
    r.input.soil.texture = "changed"; r.metadata.units.input.furrow.furrowSpacingM = "changed";
    r.output.diagnostics.items[0].evidence.infiltratedDepthEndMm = -1;
    r.output.diagnostics.items[0].fields.push("changed");
  }
  assert.deepEqual(success(data), expected); assert.deepEqual(data, golden.input);
});

test("V2 matches fourteen V1 inherited results and complete P01-P05 on equivalent scenarios", () => {
  const variants = [() => {}, d => { d.furrow.slopePct = 1; }, d => { d.crop.etoMmPerDay = 0; },
    d => { d.soil.fieldCapacityPct = 10; d.soil.wiltingPointPct = 5; },
    d => { d.irrigation.advanceTimeMin = 120; }, d => { d.irrigation.advanceTimeMin = 0; },
    d => { d.irrigation.durationMin = 60; d.irrigation.advanceTimeMin = 4.8; },
    d => { d.crop.daysWithoutIrrigation = 0; }, d => { d.irrigation.flowLps = 7; }];
  for (const change of variants) {
    const data = input(); change(data); const r = success(data);
    const old = structuredClone(data); old.furrow.widthM = old.furrow.furrowSpacingM;
    delete old.furrow.furrowSpacingM; delete old.furrow.furrowCount;
    const v1 = calculateV1(old); assert.equal(v1.ok, true);
    let count = 0;
    for (const [g, fields] of Object.entries(v1.output)) for (const [f, v] of Object.entries(fields)) {
      assert.deepEqual(r.output[g][f], v); if (typeof v === "number") count++;
    }
    assert.equal(count, 14);
  }
});

test("zero daily use succeeds for each zero factor with explicit null days and unchanged P rules", () => {
  for (const [eto, kc] of [[0, 0.7], [5, 0], [0, 0]]) {
    const data = input(); data.crop.etoMmPerDay = eto; data.crop.cropCoefficient = kc;
    const r = success(data);
    assert.equal(r.output.waterNeed.dailyCropWaterUseMmPerDay, 0);
    assert.equal(r.output.soilWater.daysUntilAvailableWaterExhaustion, null);
    assert.equal(r.output.soilWater.daysUntilDepletionThreshold, null);
    assert.ok(Object.hasOwn(r.output.soilWater, "daysUntilAvailableWaterExhaustion"));
    assert.deepEqual(JSON.parse(JSON.stringify(r)).output.soilWater, r.output.soilWater);
    assert.deepEqual(r.output.diagnostics.items.map(d => d.id), ["P03", "P03", "P03"]);
  }
});

test("texture alone has no numerical or metadata effects and count alone changes only totals", () => {
  const base = success(input()); const texture = input(); texture.soil.texture = "Arcilloso";
  const textResult = success(texture); assert.deepEqual(textResult.output, base.output); assert.deepEqual(textResult.metadata, base.metadata);
  for (const count of [1, 18, Number.MAX_SAFE_INTEGER]) {
    const data = input(); data.furrow.furrowCount = count; const r = success(data);
    assert.equal(r.input.furrow.furrowCount, count);
    const { totals, ...rest } = r.output, { totals: ignored, ...original } = base.output;
    assert.deepEqual(rest, original); assert.equal(totals.totalAppliedVolumeL, 6480 * count);
    assert.equal(totals.totalAppliedVolumeM3, totals.totalAppliedVolumeL / 1000);
    assert.deepEqual(r.metadata, base.metadata);
  }
});

test("days are reference reserve durations and do not subtract the elapsed days or applied water", () => {
  for (const days of [0, 1, 20, 100]) {
    const data = input(); data.crop.daysWithoutIrrigation = days; const r = success(data);
    assert.equal(r.output.soilWater.daysUntilAvailableWaterExhaustion, 26);
    assert.equal(r.output.soilWater.daysUntilDepletionThreshold, 15.6);
    assert.equal(r.metadata.assumptions.daysMeaning, "reference_reserve_duration_not_remaining_days_from_now");
  }
  const full = input(); full.soil.depletionThresholdPct = 100; const r = success(full);
  assert.equal(r.output.soilWater.daysUntilDepletionThreshold, r.output.soilWater.daysUntilAvailableWaterExhaustion);
});

test("spacing and length scale volumes but not infiltrated depths, applied water or days", () => {
  const base = success(input());
  for (const field of ["furrowSpacingM", "lengthM"]) {
    const data = input(); data.furrow[field] /= 2; const r = success(data);
    for (const key of ["infiltratedDepthStartMm", "infiltratedDepthMiddleMm", "infiltratedDepthEndMm", "appliedVolumeL"]) {
      assert.equal(r.output.application[key], base.output.application[key]);
    }
    assert.equal(r.output.application.estimatedUsefulVolumeL, base.output.application.estimatedUsefulVolumeL / 2);
    assert.equal(r.output.soilWater.availableCapacityL, base.output.soilWater.availableCapacityL / 2);
    assert.equal(r.output.soilWater.maxRecommendedVolumeL, base.output.soilWater.maxRecommendedVolumeL / 2);
    assert.equal(r.output.soilWater.daysUntilDepletionThreshold, 15.6);
  }
});
