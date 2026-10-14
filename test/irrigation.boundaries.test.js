"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const models = require("../src/services/irrigation/irrigation-models");
const { calculateIrrigationSimulation: calculate } = require("../src/services/irrigation/irrigation-calculator.service");
const { validateIrrigationOutput } = require("../src/services/irrigation/irrigation-validation");

function input() {
  return {
    crop: { etoMmPerDay: 5, cropCoefficient: 0.7, daysWithoutIrrigation: 20 },
    soil: { texture: "Franco", fieldCapacityPct: 20, wiltingPointPct: 10, bulkDensityGcm3: 1.3, rootDepthM: 0.7, depletionThresholdPct: 60 },
    furrow: { widthM: 1.3, lengthM: 60, slopePct: 0 },
    irrigation: { flowLps: 0.9, durationMin: 60, advanceTimeMin: 4.8 },
  };
}
function controlled() {
  const data = input();
  data.crop = { etoMmPerDay: 31.5, cropCoefficient: 1, daysWithoutIrrigation: 1 };
  data.soil = { texture: null, fieldCapacityPct: 100, wiltingPointPct: 0, bulkDensityGcm3: 1,
    rootDepthM: 0.0315, depletionThresholdPct: 100 };
  data.furrow = { widthM: 1, lengthM: 1, slopePct: 1 };
  // Opportunities 49/25/1 have exact roots 7/5/1; depths 31.5/22.5/4.5.
  data.irrigation = { flowLps: 2, durationMin: 49, advanceTimeMin: 48 };
  return data;
}
function success(data) { const r = calculate(data); assert.equal(r.ok, true); return r; }
function present(result, id, point) {
  return result.output.diagnostics.items.some(item => item.id === id && item.evidence.point === point);
}
function near(actual, expected) {
  assert.ok(Math.abs(actual - expected) <= Math.max(1e-8, 1e-9 * Math.abs(expected)));
}
function numbers(output) {
  return Object.fromEntries(Object.entries(output).map(([group, fields]) => [group,
    Object.fromEntries(Object.entries(fields).filter(([, value]) => typeof value === "number"))]));
}
const points = { start: "infiltratedDepthStartMm", middle: "infiltratedDepthMiddleMm", end: "infiltratedDepthEndMm" };

test("P01/P02/P04 exact equality and both sides retain strict comparisons", () => {
  for (const delta of [-0.5, 0, 0.5]) {
    let data = controlled(); data.irrigation.flowLps = 0.63 + delta;
    let r = success(data);
    if (delta === 0) assert.equal(r.input.irrigation.flowLps, r.output.diagnostics.maxNonErosiveFlowLps);
    assert.equal(present(r, "P01"), delta > 0);
    data = controlled(); data.crop.etoMmPerDay = 4.5 + delta; r = success(data);
    if (delta === 0) assert.equal(r.output.application.infiltratedDepthEndMm, r.output.waterNeed.targetDepthMm);
    assert.equal(present(r, "P02"), delta > 0);
    data = controlled(); data.crop.etoMmPerDay = 31.5 + delta; r = success(data);
    if (delta === 0) assert.equal(r.output.waterNeed.targetDepthMm, r.output.soilWater.maxRecommendedDepthMm);
    assert.equal(present(r, "P04"), delta > 0);
  }
});

test("P03/P05 exact equality and both sides independently for start/middle/end", () => {
  const depths = { start: 31.5, middle: 22.5, end: 4.5 };
  for (const [point, field] of Object.entries(points)) {
    for (const delta of [-0.5, 0, 0.5]) {
      let data = controlled(); data.crop.etoMmPerDay = depths[point] + delta;
      let r = success(data);
      if (delta === 0) assert.equal(r.output.application[field], r.output.waterNeed.targetDepthMm);
      assert.equal(present(r, "P03", point), delta < 0);
      data = controlled(); data.soil.rootDepthM = (depths[point] + delta) / 1000;
      r = success(data);
      if (delta === 0) assert.equal(r.output.application[field], r.output.soilWater.maxRecommendedDepthMm);
      assert.equal(present(r, "P05", point), delta < 0);
    }
  }
});

test("25/30/50/60 percent and advance endpoints never introduce D01-D08 categories", () => {
  for (const ratio of [0, 25, 30, 50, 60, 100]) {
    const data = input(); data.irrigation.advanceTimeMin = ratio * 0.6;
    const r = success(data), a = r.output.application;
    near(r.output.diagnostics.advanceRatioPct, ratio);
    assert.ok(r.output.diagnostics.items.every(item => /^P0[1-5]$/.test(item.id)));
    assert.doesNotMatch(JSON.stringify(r.output.diagnostics.items), /Óptimo|Regular|Crítico|D0[1-8]/i);
    if (ratio === 0) {
      assert.equal(a.infiltratedDepthStartMm, a.infiltratedDepthMiddleMm);
      assert.equal(a.infiltratedDepthMiddleMm, a.infiltratedDepthEndMm);
    }
    if (ratio === 100) {
      assert.equal(a.infiltratedDepthEndMm, 0);
      near(a.infiltratedDepthMiddleMm, 24.647515087732476);
    }
  }
});

test("P01-P05 evidence keys, precision, fields, severity, order and uniqueness are frozen contracts", () => {
  const specs = {
    P01: { severity: "warning", keys: ["flowLps", "slopePct", "maxNonErosiveFlowLps", "operator", "units", "source", "scientificValidation"],
      fields: ["irrigation.flowLps", "furrow.slopePct", "diagnostics.maxNonErosiveFlowLps"], operator: ">" },
    P02: { severity: "warning", keys: ["infiltratedDepthEndMm", "targetDepthMm", "operator", "unit", "source", "scientificValidation"],
      fields: ["application.infiltratedDepthEndMm", "waterNeed.targetDepthMm"], operator: "<" },
    P03: { severity: "info", keys: ["point", "infiltratedDepthMm", "targetDepthMm", "operator", "unit", "source", "scientificValidation"], operator: ">" },
    P04: { severity: "warning", keys: ["targetDepthMm", "maxRecommendedDepthMm", "operator", "unit", "source", "scientificValidation"],
      fields: ["waterNeed.targetDepthMm", "soilWater.maxRecommendedDepthMm"], operator: ">" },
    P05: { severity: "warning", keys: ["point", "infiltratedDepthMm", "maxRecommendedDepthMm", "operator", "unit", "source", "scientificValidation"], operator: ">" },
  };
  const order = ["P01", "P02", "P03-start", "P03-middle", "P03-end", "P04", "P05-start", "P05-middle", "P05-end"];
  const seen = new Set();
  for (const target of [0, 10, 40]) {
    const data = controlled(); data.crop.etoMmPerDay = target; data.soil.rootDepthM = 0.002;
    const r = success(data); const items = r.output.diagnostics.items;
    const identities = items.map(item => item.id + (item.evidence.point ? "-" + item.evidence.point : ""));
    assert.equal(new Set(identities).size, identities.length);
    assert.deepEqual(identities, order.filter(key => identities.includes(key)));
    for (const item of items) {
      const spec = specs[item.id], e = item.evidence; seen.add(item.id);
      assert.equal(item.ruleVersion, "irrigation-diagnostics-v1");
      assert.equal(item.severity, spec.severity); assert.equal(e.operator, spec.operator);
      assert.deepEqual(Object.keys(e), spec.keys);
      assert.equal(e.source, "R1_comparison"); assert.equal(e.scientificValidation, "not_validated");
      assert.match(item.message, /estimad|simplificada/i);
      if (spec.fields) assert.deepEqual(item.fields, spec.fields);
      else {
        assert.ok(Object.hasOwn(points, e.point));
        assert.deepEqual(item.fields, [`application.${points[e.point]}`, item.id === "P03" ? "waterNeed.targetDepthMm" : "soilWater.maxRecommendedDepthMm"]);
        assert.equal(e.infiltratedDepthMm, r.output.application[points[e.point]]);
      }
      if (item.id === "P01") {
        assert.deepEqual(e.units, { flowLps: "L/s", slopePct: "%", maxNonErosiveFlowLps: "L/s" });
        assert.equal(e.flowLps, data.irrigation.flowLps); assert.equal(e.slopePct, data.furrow.slopePct);
        assert.equal(e.maxNonErosiveFlowLps, r.output.diagnostics.maxNonErosiveFlowLps);
      } else assert.equal(e.unit, "mm");
      if (Object.hasOwn(e, "targetDepthMm")) assert.equal(e.targetDepthMm, r.output.waterNeed.targetDepthMm);
      if (Object.hasOwn(e, "maxRecommendedDepthMm")) assert.equal(e.maxRecommendedDepthMm, r.output.soilWater.maxRecommendedDepthMm);
      if (Object.hasOwn(e, "infiltratedDepthEndMm")) assert.equal(e.infiltratedDepthEndMm, r.output.application.infiltratedDepthEndMm);
    }
  }
  assert.deepEqual([...seen].sort(), Object.keys(specs));
});

test("each fatal consistency condition independently; all detectable G12 errors accumulate", () => {
  const cases = [
    ["application", "estimatedUsefulVolumeL", 3241, "MODEL_INCONSISTENCY"],
    ["application", "residualLossVolumeL", -1, "MODEL_INCONSISTENCY"],
    ["efficiency", "applicationEfficiencyPct", 101, "MODEL_INCONSISTENCY"],
    ["efficiency", "applicationEfficiencyPct", -1, "MODEL_INCONSISTENCY"],
    ["waterNeed", "targetDepthMm", Infinity, "NON_FINITE_RESULT"],
  ];
  for (const [group, field, value, code] of cases) {
    const output = success(input()).output; output[group][field] = value;
    const r = validateIrrigationOutput(output);
    assert.equal(r.ok, false); assert.equal(r.errors.length, 1);
    assert.equal(r.errors[0].field, `output.${group}.${field}`); assert.equal(r.errors[0].code, code);
    assert.equal(output[group][field], value);
  }
  const data = input(); data.irrigation.flowLps = 0.1;
  const r = calculate(data); assert.deepEqual(Object.keys(r), ["ok", "errors"]);
  assert.deepEqual(r.errors.map(e => e.field), ["output.application.residualLossVolumeL", "output.efficiency.applicationEfficiencyPct", "output.application.estimatedUsefulVolumeL"]);
  assert.ok(r.errors.every(e => e.code === "MODEL_INCONSISTENCY"));
});

test("NON_FINITE_RESULT identifies demand, AU, application and Qmax stages without null received", () => {
  const cases = [
    ["crop", "etoMmPerDay", Number.MAX_VALUE, "output.waterNeed.targetDepthMm"],
    ["soil", "rootDepthM", Number.MAX_VALUE, "output.soilWater.availableWaterMm"],
    ["irrigation", "flowLps", Number.MAX_VALUE, "output.application.appliedVolumeL"],
    ["furrow", "slopePct", Number.MIN_VALUE, "output.diagnostics.maxNonErosiveFlowLps"],
  ];
  for (const [group, field, value, affected] of cases) {
    const data = input(); data[group][field] = value;
    const r = calculate(data); assert.equal(r.ok, false);
    const error = r.errors.find(e => e.field === affected && e.code === "NON_FINITE_RESULT");
    assert.ok(error); assert.equal(error.rule, "finite_number"); assert.equal(error.category, "consistency");
    assert.ok(!Object.hasOwn(error, "received"));
    assert.deepEqual(JSON.parse(JSON.stringify(error)), error);
  }
  const data = controlled(); data.irrigation.durationMin = Number.MAX_VALUE; data.irrigation.advanceTimeMin = 0;
  const r = calculate(data); assert.equal(r.ok, false);
  assert.ok(!r.errors.some(e => e.field.includes("infiltratedDepth")));
  // sqrt(MAX_VALUE)*4.5 remains finite: cannot honestly fabricate infiltration overflow.
});

test("valid matrix obeys volume/ratio relations, opportunity ordering and input contracts", () => {
  for (const duration of [4, 60, 240]) for (const fraction of [0, 0.25, 0.5, 1]) for (const flow of [1, 3]) {
    const data = input(); data.furrow.widthM = 0.5; data.furrow.lengthM = 2;
    data.irrigation = { flowLps: flow, durationMin: duration, advanceTimeMin: duration * fraction };
    const r = success(data), a = r.output.application, s = r.output.soilWater;
    near(a.appliedVolumeL, flow * duration * 60);
    near(a.residualLossVolumeL, a.appliedVolumeL - a.estimatedUsefulVolumeL);
    near(r.output.efficiency.applicationEfficiencyPct, 100 * a.estimatedUsefulVolumeL / a.appliedVolumeL);
    near(s.availableCapacityL, s.availableWaterMm * data.furrow.widthM * data.furrow.lengthM);
    near(s.maxRecommendedVolumeL, s.maxRecommendedDepthMm * data.furrow.widthM * data.furrow.lengthM);
    assert.ok(a.infiltratedDepthStartMm >= a.infiltratedDepthMiddleMm && a.infiltratedDepthMiddleMm >= a.infiltratedDepthEndMm);
    assert.ok(r.output.diagnostics.advanceRatioPct >= 0 && r.output.diagnostics.advanceRatioPct <= 100);
  }
});

test("metamorphic dependencies: flow/width doubling, texture, slope and ETo", () => {
  const data = controlled(), baseline = success(data), a = baseline.output.application;
  let modified = controlled(); modified.irrigation.flowLps *= 2;
  let r = success(modified);
  near(r.output.application.appliedVolumeL, a.appliedVolumeL * 2);
  near(r.output.efficiency.applicationEfficiencyPct, baseline.output.efficiency.applicationEfficiencyPct / 2);
  assert.equal(r.output.application.estimatedUsefulVolumeL, a.estimatedUsefulVolumeL);
  for (const field of Object.values(points)) assert.equal(r.output.application[field], a[field]);
  modified = controlled(); modified.furrow.widthM *= 2; r = success(modified);
  assert.equal(r.output.soilWater.availableWaterMm, baseline.output.soilWater.availableWaterMm);
  near(r.output.application.estimatedUsefulVolumeL, a.estimatedUsefulVolumeL * 2);
  near(r.output.soilWater.availableCapacityL, baseline.output.soilWater.availableCapacityL * 2);
  near(r.output.soilWater.maxRecommendedVolumeL, baseline.output.soilWater.maxRecommendedVolumeL * 2);
  for (const field of Object.values(points)) assert.equal(r.output.application[field], a[field]);
  modified = controlled(); modified.soil.texture = "Arenoso"; r = success(modified);
  assert.deepEqual(r.output, baseline.output);
  modified = controlled(); modified.furrow.slopePct = 0; r = success(modified);
  const expected = numbers(baseline.output); expected.diagnostics.maxNonErosiveFlowLps = 6.3;
  assert.deepEqual(numbers(r.output), expected);
  assert.deepEqual(r.output.diagnostics.items, baseline.output.diagnostics.items.filter(item => item.id !== "P01"));
  modified = controlled(); modified.crop.etoMmPerDay *= 2; r = success(modified);
  const demandExpected = numbers(baseline.output); demandExpected.waterNeed.targetDepthMm *= 2;
  assert.deepEqual(numbers(r.output), demandExpected);
});

test("zero demand on each input and zero final opportunity retain literal P03 consequences", () => {
  for (const field of ["etoMmPerDay", "cropCoefficient", "daysWithoutIrrigation"]) {
    const data = input(); data.crop[field] = 0; data.irrigation.advanceTimeMin = data.irrigation.durationMin;
    const r = success(data);
    assert.equal(r.output.waterNeed.targetDepthMm, 0); assert.ok(!present(r, "P02"));
    assert.deepEqual(r.output.diagnostics.items.map(item => [item.id, item.evidence.point]), [["P03", "start"], ["P03", "middle"]]);
    assert.ok(!present(r, "P03", "end"));
  }
});

test("15 input fields, two-way snapshot isolation, metadata provenance and key order independence", () => {
  const data = input(); data.soil.texture = "  Arenoso  "; const r = success(data);
  assert.equal(Object.values(r.input).reduce((sum, group) => sum + Object.keys(group).length, 0), 15);
  assert.equal(r.input.soil.texture, "Arenoso");
  data.crop.etoMmPerDay = 999; assert.equal(r.input.crop.etoMmPerDay, 5);
  r.input.soil.fieldCapacityPct = 99; assert.equal(data.soil.fieldCapacityPct, 20);
  const first = success(input()), second = success(input());
  assert.deepEqual(first.metadata.effectiveParameters, { infiltrationCoefficient: 4.5, infiltrationExponent: 0.5,
    middleArrivalFactor: 0.5, qmaxCoefficient: 0.0063, qmaxZeroSlopeValue: 6.3, advanceRules: null });
  assert.equal(first.metadata.evidenceState.scientificValidation, "not_validated");
  assert.equal(first.metadata.evidenceState.source, "spreadsheet-derived");
  assert.equal(first.metadata.evidenceState.fieldCalibration, "none");
  assert.deepEqual(first.metadata.implementationReference, { modelVersion: "irrigation-estimation-v1", stage: "R3B_estimation", arithmetic: "IEEE-754_Number" });
  first.metadata.parameterProvenance.qmax = "modified"; first.metadata.units.effectiveParameters.qmaxCoefficient = "changed";
  first.output.diagnostics.items[0].fields.length = 0;
  assert.deepEqual(success(input()), second);
  const reversed = Object.fromEntries(Object.entries(input()).reverse().map(([group, fields]) => [group, Object.fromEntries(Object.entries(fields).reverse())]));
  assert.deepEqual(success(reversed), second);
  assert.match(second.sourceHash, /^[0-9a-f]{64}$/);
  assert.equal(second.sourceHash, "42592487e6e07deb1b25a073d74086a09c1bb19cb38411aafc31d28ea64d2127");
});

test("stable expected errors remain structured, deterministic and free of stack/partial outputs", () => {
  for (const [group, field, value, code] of [
    ["crop", "etoMmPerDay", "5", "INVALID_TYPE"], ["irrigation", "advanceTimeMin", 61, "INVALID_RELATIONSHIP"],
    ["irrigation", "flowLps", 0.1, "MODEL_INCONSISTENCY"], ["soil", "rootDepthM", Number.MAX_VALUE, "NON_FINITE_RESULT"],
  ]) {
    const data = input(); data[group][field] = value; const r = calculate(data);
    assert.equal(r.ok, false); assert.ok(r.errors.some(error => error.code === code));
    assert.deepEqual(Object.keys(r), ["ok", "errors"]); assert.deepEqual(calculate(data), r);
    for (const error of r.errors) {
      for (const key of ["code", "category", "field", "rule", "message"]) assert.equal(typeof error[key], "string");
      assert.ok(!Object.hasOwn(error, "stack"));
    }
  }
});

test("offline 15-input/14-output mapping and actual R2 CHECK expressions hold for valid samples", () => {
  const source = fs.readFileSync(path.join(__dirname, "../db/migrations/20261012000000_create_irrigation_simulations.js"), "utf8");
  const checks = [...source.matchAll(/table\.check\(\s*"([^"]+)"\s*,\s*\[\]\s*,\s*"([^"]+)"/g)];
  assert.equal(checks.length, 10);
  const expectedInputs = ["eto_mm_per_day", "crop_coefficient", "days_without_irrigation", "texture", "field_capacity_pct", "wilting_point_pct", "bulk_density_g_cm3", "root_depth_m", "depletion_threshold_pct", "width_m", "length_m", "slope_pct", "flow_lps", "duration_min", "advance_time_min"];
  const expectedOutputs = ["target_depth_mm", "available_water_mm", "available_capacity_l", "max_recommended_depth_mm", "max_recommended_volume_l", "applied_volume_l", "infiltrated_depth_start_mm", "infiltrated_depth_middle_mm", "infiltrated_depth_end_mm", "estimated_useful_volume_l", "residual_loss_volume_l", "application_efficiency_pct", "advance_ratio_pct", "max_non_erosive_flow_lps"];
  const definitions = c => Object.values(c).flatMap(fields => Object.values(fields));
  assert.deepEqual(definitions(models.INPUT_CONTRACT).map(d => d.sqlColumn), expectedInputs);
  assert.deepEqual(definitions(models.OUTPUT_CONTRACT).filter(d => d.type === "number").map(d => d.sqlColumn), expectedOutputs);
  // Restricted comparison parser, not SQL execution, eval, migration import or Knex.
  const compare = { ">": (a, b) => a > b, ">=": (a, b) => a >= b, "<": (a, b) => a < b,
    "<=": (a, b) => a <= b, "=": (a, b) => a === b };
  for (const target of [0, 10, 70]) for (const advance of [0, 15, 60]) for (const slope of [0, 0.3, 1]) {
    const data = input(); data.crop.etoMmPerDay = target; data.crop.cropCoefficient = 1; data.crop.daysWithoutIrrigation = 1;
    data.irrigation.advanceTimeMin = advance; data.furrow.slopePct = slope;
    const r = success(data), row = { source_hash: r.sourceHash, model_metadata: r.metadata };
    for (const [contract, values] of [[models.INPUT_CONTRACT, r.input], [models.OUTPUT_CONTRACT, r.output]]) {
      for (const [group, fields] of Object.entries(contract)) for (const [field, definition] of Object.entries(fields)) row[definition.sqlColumn] = values[group][field];
    }
    for (const [, expression, name] of checks) {
      const normalized = expression.replace(/JSON_TYPE\((\w+)\)/g, (_, key) => {
        assert.ok(Object.hasOwn(row, key));
        assert.ok(row[key] !== null && typeof row[key] === "object");
        return Array.isArray(row[key]) ? "'ARRAY'" : "'OBJECT'";
      }).replace(/CHAR_LENGTH\((\w+)\)/g, (_, key) => {
        assert.equal(typeof row[key], "string"); return String(row[key].length);
      });
      function operand(token) {
        if (/^'[A-Z]+'$/.test(token)) return token.slice(1, -1);
        if (/^\d+$/.test(token)) return Number(token);
        assert.ok(Object.hasOwn(row, token)); return row[token];
      }
      for (const condition of normalized.split(" AND ")) {
        const parsed = condition.match(/^([\w']+) (>=|<=|>|<|=) ([\w']+)$/);
        assert.ok(parsed, `Unsupported CHECK: ${condition}`);
        assert.ok(compare[parsed[2]](operand(parsed[1]), operand(parsed[3])), name);
      }
    }
    assert.ok(expectedOutputs.every(column => Number.isFinite(row[column])));
  }
});
