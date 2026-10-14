"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const models = require("../src/services/irrigation/irrigation-models");
const { calculateIrrigationSimulation: calculate } = require("../src/services/irrigation/irrigation-calculator.service");

function input() {
  return {
    crop: { etoMmPerDay: 5, cropCoefficient: 0.7, daysWithoutIrrigation: 20 },
    soil: { texture: "Franco", fieldCapacityPct: 20, wiltingPointPct: 10, bulkDensityGcm3: 1.3, rootDepthM: 0.7, depletionThresholdPct: 60 },
    furrow: { widthM: 1.3, lengthM: 60, slopePct: 0 },
    irrigation: { flowLps: 0.9, durationMin: 60, advanceTimeMin: 4.8 },
  };
}
const golden = {
  waterNeed: { targetDepthMm: 70 },
  soilWater: { availableWaterMm: 91, availableCapacityL: 7098, maxRecommendedDepthMm: 54.6, maxRecommendedVolumeL: 4258.8 },
  application: { appliedVolumeL: 3240, infiltratedDepthStartMm: 34.856850115866756,
    infiltratedDepthMiddleMm: 34.152598729818493, infiltratedDepthEndMm: 33.433516117812076,
    estimatedUsefulVolumeL: 2663.9027009258425, residualLossVolumeL: 576.0972990741575 },
  efficiency: { applicationEfficiencyPct: 82.21921916437785 },
  diagnostics: { advanceRatioPct: 8, maxNonErosiveFlowLps: 6.3 },
};
function near(actual, expected) {
  assert.ok(Number.isFinite(actual));
  assert.ok(Math.abs(actual - expected) <= Math.max(1e-8, 1e-9 * Math.abs(expected)), `${actual} != ${expected}`);
}
function checkGolden(result, expected) {
  assert.equal(result.ok, true);
  for (const [group, fields] of Object.entries(expected)) {
    for (const [key, value] of Object.entries(fields)) near(result.output[group][key], value);
  }
}
function expectedWith(changes) {
  return Object.fromEntries(Object.entries(golden).map(([group, values]) => [group, { ...values, ...changes[group] }]));
}
function ids(result) { return result.output.diagnostics.items.map(item => item.id); }
function failure(result, code) {
  assert.equal(result.ok, false);
  assert.ok(result.errors.some(error => error.code === code));
  assert.deepEqual(Object.keys(result), ["ok", "errors"]);
}

test("G01: all fourteen outputs, effective metadata, versions and P02/P04", () => {
  const result = calculate(input()); checkGolden(result, golden);
  assert.deepEqual(ids(result), ["P02", "P04"]);
  assert.equal(result.modelVersion, models.MODEL_VERSION);
  assert.equal(result.contractVersion, "irrigation-contract-v1");
  assert.equal(result.sourceHash, "42592487e6e07deb1b25a073d74086a09c1bb19cb38411aafc31d28ea64d2127");
  assert.equal(result.metadata.metadataSchemaVersion, "irrigation-metadata-v1");
  assert.deepEqual(result.metadata.evidenceState, { calculationImplemented: true, scientificValidation: "not_validated",
    parametersSelected: true, diagnosticsEvaluated: true, modelKind: "estimation", source: "spreadsheet-derived", fieldCalibration: "none" });
  assert.equal(result.metadata.assumptions.widthMeaning, "pending_validation");
  assert.equal(result.metadata.assumptions.soilWaterContentBasis, "pending_validation");
  assert.equal(result.output.application.estimatedUsefulVolumeL, 2663.9027009258425);
});

const cases = [
  ["G02", { furrow: { slopePct: 0.30 } }, { diagnostics: { maxNonErosiveFlowLps: 2.1 } }, ["P02", "P04"]],
  ["G03", { furrow: { slopePct: 1 } }, { diagnostics: { maxNonErosiveFlowLps: 0.63 } }, ["P01", "P02", "P04"]],
  ["G04", { soil: { texture: "Arenoso", fieldCapacityPct: 10, wiltingPointPct: 5 } },
    { soilWater: { availableWaterMm: 45.5, availableCapacityL: 3549, maxRecommendedDepthMm: 27.3, maxRecommendedVolumeL: 2129.4 } },
    ["P02", "P04", "P05", "P05", "P05"]],
  ["G05", {}, {}, ["P02", "P04"]],
  ["G06", { soil: { texture: "Arcilloso", fieldCapacityPct: 30, wiltingPointPct: 15 } },
    { soilWater: { availableWaterMm: 136.5, availableCapacityL: 10647, maxRecommendedDepthMm: 81.9, maxRecommendedVolumeL: 6388.2 } }, ["P02"]],
  ["G07", { irrigation: { flowLps: 7 } },
    { application: { appliedVolumeL: 25200, residualLossVolumeL: 22536.097299074157 }, efficiency: { applicationEfficiencyPct: 10.571042463991438 } }, ["P01", "P02", "P04"]],
  ["G08", { irrigation: { advanceTimeMin: 36 } },
    { diagnostics: { advanceRatioPct: 60 }, application: { infiltratedDepthMiddleMm: 29.16333314283537,
      infiltratedDepthEndMm: 22.045407685048602, estimatedUsefulVolumeL: 2274.7399851411587, residualLossVolumeL: 965.2600148588413 },
    efficiency: { applicationEfficiencyPct: 70.20802423275181 } }, ["P02", "P04"]],
  ["G10", { irrigation: { advanceTimeMin: 18 } },
    { diagnostics: { advanceRatioPct: 30 }, application: { infiltratedDepthMiddleMm: 32.13642792844283,
      infiltratedDepthEndMm: 29.16333314283537, estimatedUsefulVolumeL: 2506.6413784185406, residualLossVolumeL: 733.3586215814594 },
    efficiency: { applicationEfficiencyPct: 77.36547464254755 } }, ["P02", "P04"]],
  ["G11", { irrigation: { advanceTimeMin: 30 } },
    { diagnostics: { advanceRatioPct: 50 }, application: { infiltratedDepthMiddleMm: 30.186917696247164,
      infiltratedDepthEndMm: 24.647515087732476, estimatedUsefulVolumeL: 2354.579580307279, residualLossVolumeL: 885.4204196927212 },
    efficiency: { applicationEfficiencyPct: 72.67220926874317 } }, ["P02", "P04"]],
];
for (const [name, changes, outputs, diagnostics] of cases) {
  test(`${name}: complete golden vector and conservative diagnostics`, () => {
    const data = input();
    for (const [group, fields] of Object.entries(changes)) Object.assign(data[group], fields);
    const result = calculate(data); checkGolden(result, expectedWith(outputs));
    assert.deepEqual(ids(result), diagnostics);
    assert.ok(result.output.diagnostics.items.every(item => ["info", "warning"].includes(item.severity)));
  });
}

test("G09: invalid advance fails before math; G12: impossible balance fails without clamping", () => {
  const data = input(); data.irrigation.advanceTimeMin = 61;
  failure(calculate(data), "INVALID_RELATIONSHIP");
  data.irrigation.advanceTimeMin = 4.8; data.irrigation.flowLps = 0.1;
  const result = calculate(data); failure(result, "MODEL_INCONSISTENCY");
  const errors = Object.fromEntries(result.errors.map(error => [error.field, error]));
  near(errors["output.application.residualLossVolumeL"].received, -2303.9027009258425);
  near(errors["output.efficiency.applicationEfficiencyPct"].received, 739.9729724794007);
  assert.equal(errors["output.application.estimatedUsefulVolumeL"].rule, "useful_not_above_applied");
});

test("zero and small positive slope retain separate Excel branches without cap", () => {
  const data = input(); assert.equal(calculate(data).output.diagnostics.maxNonErosiveFlowLps, 6.3);
  data.furrow.slopePct = 1e-10;
  near(calculate(data).output.diagnostics.maxNonErosiveFlowLps, 6.3e9);
  data.furrow.slopePct = Number.MIN_VALUE;
  failure(calculate(data), "NON_FINITE_RESULT");
});

test("advance zero and equal to duration: mathematical opportunity boundaries", () => {
  const data = input(); data.irrigation.advanceTimeMin = 0;
  const zero = calculate(data); assert.equal(zero.ok, true);
  assert.equal(zero.output.diagnostics.advanceRatioPct, 0);
  assert.equal(zero.output.application.infiltratedDepthStartMm, zero.output.application.infiltratedDepthMiddleMm);
  assert.equal(zero.output.application.infiltratedDepthStartMm, zero.output.application.infiltratedDepthEndMm);
  data.irrigation.advanceTimeMin = data.irrigation.durationMin;
  const end = calculate(data); assert.equal(end.ok, true);
  assert.equal(end.output.application.infiltratedDepthEndMm, 0);
  assert.equal(end.output.diagnostics.advanceRatioPct, 100);
});

for (const field of ["etoMmPerDay", "cropCoefficient", "daysWithoutIrrigation"]) {
  test(`zero demand from ${field} is valid and produces point comparisons`, () => {
    const data = input(); data.crop[field] = 0;
    const result = calculate(data); assert.equal(result.ok, true);
    assert.equal(result.output.waterNeed.targetDepthMm, 0);
    assert.deepEqual(ids(result), ["P03", "P03", "P03"]);
    assert.deepEqual(result.output.diagnostics.items.map(item => item.evidence.point), ["start", "middle", "end"]);
  });
}

test("texture alone changes no output or metadata, even with a different descriptive label", () => {
  const data = input(), baseline = calculate(data);
  data.soil.texture = "Arenoso";
  const other = calculate(data);
  assert.deepEqual(other.output, baseline.output); assert.deepEqual(other.metadata, baseline.metadata);
  assert.equal(other.input.soil.fieldCapacityPct, 20); assert.equal(other.input.soil.wiltingPointPct, 10);
});

test("width and length affect literal area volumes, never the three infiltrations", () => {
  for (const [field, value] of [["widthM", 0.65], ["lengthM", 30]]) {
    const data = input(), baseline = calculate(data); data.furrow[field] = value;
    const result = calculate(data); assert.equal(result.ok, true);
    for (const point of ["Start", "Middle", "End"]) {
      assert.equal(result.output.application[`infiltratedDepth${point}Mm`], baseline.output.application[`infiltratedDepth${point}Mm`]);
    }
    near(result.output.application.estimatedUsefulVolumeL, baseline.output.application.estimatedUsefulVolumeL / 2);
    near(result.output.soilWater.availableCapacityL, baseline.output.soilWater.availableCapacityL / 2);
    near(result.output.soilWater.maxRecommendedVolumeL, baseline.output.soilWater.maxRecommendedVolumeL / 2);
  }
});

test("strict comparisons: equality is not an excess or shortfall", () => {
  const data = input(); data.irrigation.flowLps = 6.3;
  assert.ok(!ids(calculate(data)).includes("P01"));
  data.crop = { etoMmPerDay: 54.6, cropCoefficient: 1, daysWithoutIrrigation: 1 };
  assert.ok(!ids(calculate(data)).includes("P04"));
  const reference = calculate(input()).output.application;
  data.crop.etoMmPerDay = reference.infiltratedDepthEndMm;
  assert.ok(!ids(calculate(data)).includes("P02"));
  data.crop.etoMmPerDay = reference.infiltratedDepthStartMm;
  assert.ok(!ids(calculate(data)).includes("P03"));
  // Choose CC/PMP/density/depth so AU equals the start estimate exactly.
  data.soil = { texture: null, fieldCapacityPct: 100, wiltingPointPct: 0, bulkDensityGcm3: 1,
    rootDepthM: reference.infiltratedDepthStartMm / 1000, depletionThresholdPct: 100 };
  const result = calculate(data); assert.equal(result.ok, true);
  assert.ok(!ids(result).includes("P05"));
});

test("diagnostic evidence is full precision, versioned and ordered, messages are presentation only", () => {
  const data = input(); data.furrow.slopePct = 1;
  const result = calculate(data), [p01, p02, p04] = result.output.diagnostics.items;
  assert.deepEqual(result.metadata.diagnosticRules.evaluated, ["P01", "P02", "P03", "P04", "P05"]);
  for (const item of [p01, p02, p04]) {
    assert.equal(item.ruleVersion, models.DIAGNOSTICS_RULE_VERSION);
    assert.ok(item.fields.length > 0); assert.equal(item.evidence.scientificValidation, "not_validated");
  }
  assert.equal(p01.evidence.operator, ">"); assert.equal(p01.evidence.maxNonErosiveFlowLps, 0.63);
  assert.equal(p02.evidence.infiltratedDepthEndMm, result.output.application.infiltratedDepthEndMm);
  assert.equal(p02.evidence.operator, "<"); assert.equal(p04.evidence.operator, ">");
});

test("extreme finite inputs reject overflow/underflow safely before any success or JSON conversion", () => {
  const changes = [
    ["crop", "etoMmPerDay", Number.MAX_VALUE], ["soil", "rootDepthM", Number.MAX_VALUE],
    ["furrow", "widthM", Number.MAX_VALUE], ["irrigation", "flowLps", Number.MAX_VALUE],
  ];
  for (const [group, field, value] of changes) {
    const data = input(); data[group][field] = value;
    const result = calculate(data); failure(result, "NON_FINITE_RESULT");
    assert.ok(!JSON.stringify(result).includes("Infinity"));
  }
  const underflow = input(); underflow.irrigation.flowLps = Number.MIN_VALUE;
  underflow.irrigation.durationMin = Number.MIN_VALUE; underflow.irrigation.advanceTimeMin = 0;
  const result = calculate(underflow); failure(result, "NON_FINITE_RESULT");
  assert.ok(result.errors.some(error => error.field === "output.application.appliedVolumeL" && error.code === "MODEL_INCONSISTENCY"));
  const advanceOverflow = input(); advanceOverflow.irrigation.durationMin = Number.MAX_VALUE;
  advanceOverflow.irrigation.advanceTimeMin = Number.MAX_VALUE;
  failure(calculate(advanceOverflow), "NON_FINITE_RESULT");
});

test("no mutation, no shared input/metadata/diagnostics; deterministic across repeated calls", () => {
  const data = input(); for (const group of Object.values(data)) Object.freeze(group); Object.freeze(data);
  const baseline = calculate(data);
  for (let i = 0; i < 5; i++) assert.deepEqual(calculate(data), baseline);
  const changed = calculate(data);
  changed.input.soil.fieldCapacityPct = 99;
  changed.metadata.effectiveParameters.infiltrationCoefficient = 123;
  changed.metadata.diagnosticRules.evaluated.push("D03");
  changed.output.diagnostics.items[0].evidence.targetDepthMm = -1;
  changed.output.diagnostics.items[0].fields.push("extra");
  assert.deepEqual(calculate(data), baseline); assert.deepEqual(data, input());
  assert.equal(Object.isFrozen(models.EFFECTIVE_PARAMETERS), true);
  assert.equal(Object.isFrozen(models.UNIT_CONVERSIONS), true);
  assert.equal(Object.isFrozen(models.METADATA_TEMPLATE.diagnosticRules.evaluated), true);
  assert.throws(() => { models.EFFECTIVE_PARAMETERS.infiltrationCoefficient = 10; }, TypeError);
});

test("fourteen computed outputs match exactly the existing R2 snapshot column names, offline", () => {
  const source = fs.readFileSync(path.join(__dirname, "../db/migrations/20261012000000_create_irrigation_simulations.js"), "utf8");
  const doubles = [...source.matchAll(/table\.double\("([^"]+)"\)\.notNullable\(\)/g)].map(match => match[1]);
  const result = calculate(input());
  const inputColumns = Object.values(models.INPUT_CONTRACT).flatMap(fields => Object.values(fields)
    .filter(definition => definition.type === "number").map(definition => definition.sqlColumn));
  const outputColumns = [];
  for (const [group, fields] of Object.entries(models.OUTPUT_CONTRACT)) {
    assert.deepEqual(Object.keys(result.output[group]), Object.keys(fields));
    for (const [field, definition] of Object.entries(fields)) {
      if (definition.type === "number") {
        assert.ok(Number.isFinite(result.output[group][field])); outputColumns.push(definition.sqlColumn);
      }
    }
  }
  assert.equal(outputColumns.length, 14);
  assert.deepEqual(doubles.filter(column => !inputColumns.includes(column)), outputColumns);
});
