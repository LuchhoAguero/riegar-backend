"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const models = require("../src/services/irrigation/irrigation-models");
const { validateIrrigationInput, validateIrrigationOutput } = require("../src/services/irrigation/irrigation-validation");
const { calculateIrrigationSimulation } = require("../src/services/irrigation/irrigation-calculator.service");

function g01Input() {
  return {
    crop: { etoMmPerDay: 5, cropCoefficient: 0.7, daysWithoutIrrigation: 20 },
    soil: { texture: "Franco", fieldCapacityPct: 20, wiltingPointPct: 10, bulkDensityGcm3: 1.3, rootDepthM: 0.7, depletionThresholdPct: 60 },
    furrow: { widthM: 1.3, lengthM: 60, slopePct: 0 },
    irrigation: { flowLps: 0.9, durationMin: 60, advanceTimeMin: 4.8 },
  };
}

// Literal R1 values for contract validation, not calculation proof.
function g01Output() {
  return {
    waterNeed: { targetDepthMm: 70 },
    soilWater: { availableWaterMm: 91, availableCapacityL: 7098, maxRecommendedDepthMm: 54.6, maxRecommendedVolumeL: 4258.8 },
    application: { appliedVolumeL: 3240, infiltratedDepthStartMm: 34.856850115866756, infiltratedDepthMiddleMm: 34.152598729818493, infiltratedDepthEndMm: 33.433516117812076, estimatedUsefulVolumeL: 2663.9027009258425, residualLossVolumeL: 576.09729907415749 },
    efficiency: { applicationEfficiencyPct: 82.219219164377855 },
    diagnostics: { advanceRatioPct: 8, maxNonErosiveFlowLps: 6.3, items: [] },
  };
}

function assertRejected(result, field, code) {
  assert.equal(result.ok, false);
  assert.ok(result.errors.some(error => error.field === field && error.code === code));
  assert.ok(!Object.hasOwn(result, "input") && !Object.hasOwn(result, "output"));
}

// R1 numeric tolerance is test-only; no result normalization.
function assertWithinTolerance(actual, expected) {
  assert.ok(Number.isFinite(actual) && Number.isFinite(expected));
  assert.ok(Math.abs(actual - expected) <= Math.max(1e-8, 1e-9 * Math.abs(expected)));
}

test("G01 input accepted; implemented model returns the complete successful contract", () => {
  const input = g01Input();
  assert.deepEqual(validateIrrigationInput(input), { ok: true, input });
  const result = calculateIrrigationSimulation(input);
  assert.equal(result.ok, true);
  assert.deepEqual(Object.keys(result), ["ok", "modelVersion", "contractVersion", "sourceHash", "input", "output", "metadata"]);
  assert.deepEqual(calculateIrrigationSimulation(input), result);
});

for (const group of ["crop", "soil", "furrow", "irrigation"]) {
  test(`missing group: ${group}`, () => {
    const input = g01Input();
    delete input[group];
    assertRejected(calculateIrrigationSimulation(input), `input.${group}`, "INVALID_SHAPE");
  });
}

test("root and group shapes reject null, arrays, primitives and class instances", () => {
  for (const value of [null, undefined, [], 0, false, "input", new Date(0)]) {
    assertRejected(validateIrrigationInput(value), "input", "INVALID_SHAPE");
    const input = g01Input(); input.crop = value;
    assertRejected(validateIrrigationInput(input), "input.crop", "INVALID_SHAPE");
  }
});

test("all fourteen numeric inputs reject coercion, missing and non-finite values", () => {
  const original = g01Input();
  for (const [group, fields] of Object.entries(original)) {
    for (const [field, value] of Object.entries(fields)) {
      if (typeof value !== "number") continue;
      for (const invalid of [String(value), "", false, true, null, [], {}, undefined, NaN, Infinity, -Infinity]) {
        const input = g01Input(); input[group][field] = invalid;
        const code = invalid === undefined ? "MISSING_FIELD" : typeof invalid !== "number" ? "INVALID_TYPE" : "NON_FINITE_NUMBER";
        assertRejected(validateIrrigationInput(input), `input.${group}.${field}`, code);
      }
    }
  }
});

const invalidDomains = [
  ["crop", "etoMmPerDay", -1], ["crop", "cropCoefficient", -1], ["crop", "daysWithoutIrrigation", -1],
  ["soil", "fieldCapacityPct", 101], ["soil", "wiltingPointPct", -1],
  ["soil", "bulkDensityGcm3", 0], ["soil", "rootDepthM", 0],
  ["soil", "depletionThresholdPct", 0], ["soil", "depletionThresholdPct", 101],
  ["furrow", "widthM", 0], ["furrow", "lengthM", 0], ["furrow", "slopePct", -1],
  ["irrigation", "flowLps", 0], ["irrigation", "durationMin", 0], ["irrigation", "advanceTimeMin", -1],
];
for (const [group, field, value] of invalidDomains) {
  test(`domain rejects ${group}.${field}=${value}`, () => {
    const input = g01Input(); input[group][field] = value;
    assertRejected(validateIrrigationInput(input), `input.${group}.${field}`, "OUT_OF_RANGE");
  });
}

test("CC equal to/below PMP and advance above duration are fatal relationships", () => {
  for (const cc of [10, 9]) {
    const input = g01Input(); input.soil.fieldCapacityPct = cc;
    assertRejected(validateIrrigationInput(input), "input.soil.fieldCapacityPct", "INVALID_RELATIONSHIP");
  }
  const input = g01Input(); input.irrigation.advanceTimeMin = 61;
  assertRejected(validateIrrigationInput(input), "input.irrigation.advanceTimeMin", "INVALID_RELATIONSHIP");
});

test("structural boundaries accepted without inventing agronomic caps or integer-day policy", () => {
  const input = g01Input();
  input.crop.etoMmPerDay = 0; input.crop.cropCoefficient = 2; input.crop.daysWithoutIrrigation = 0.25;
  input.soil.fieldCapacityPct = 100; input.soil.wiltingPointPct = 0; input.soil.depletionThresholdPct = 100;
  input.furrow.slopePct = 250; input.irrigation.advanceTimeMin = input.irrigation.durationMin;
  assert.equal(validateIrrigationInput(input).ok, true);
  input.crop.daysWithoutIrrigation = 0; input.irrigation.advanceTimeMin = 0;
  assert.equal(validateIrrigationInput(input).ok, true);
});

test("texture null, omitted and undefined become null; text normalized without autocompleting soil", () => {
  for (const variant of ["null", "omitted", "undefined", "text"]) {
    const input = g01Input();
    input.soil.texture = variant === "text" ? "  Arenoso  " : variant === "null" ? null : undefined;
    if (variant === "omitted") delete input.soil.texture;
    const result = validateIrrigationInput(input);
    assert.equal(result.ok, true);
    assert.equal(result.input.soil.texture, variant === "text" ? "Arenoso" : null);
    assert.equal(result.input.soil.fieldCapacityPct, 20); assert.equal(result.input.soil.wiltingPointPct, 10);
  }
  for (const value of [false, 7, {}, "", "   ", "a".repeat(65)]) {
    const input = g01Input(); input.soil.texture = value;
    assert.equal(validateIrrigationInput(input).ok, false);
  }
});

test("unknown fields reject IDs, timestamps, output injection and alternative units", () => {
  for (const field of ["userId", "fincaId", "createdAt", "output", "modelVersion"]) {
    const input = { ...g01Input(), [field]: "not-part-of-contract" };
    assertRejected(validateIrrigationInput(input), `input.${field}`, "UNKNOWN_FIELD");
  }
  for (const field of ["runoffL", "durationHours", "flowM3s"]) {
    const input = g01Input(); input.irrigation[field] = 1;
    assertRejected(validateIrrigationInput(input), `input.irrigation.${field}`, "UNKNOWN_FIELD");
  }
  const input = g01Input(); input.furrow.declaredFurrowsPerHa = 18;
  assertRejected(validateIrrigationInput(input), "input.furrow.declaredFurrowsPerHa", "UNKNOWN_FIELD");
});

test("input is not mutated and normalized snapshots are independent", () => {
  const input = g01Input();
  for (const group of Object.values(input)) Object.freeze(group);
  Object.freeze(input);
  const snapshot = validateIrrigationInput(input).input;
  snapshot.soil.fieldCapacityPct = 99;
  assert.equal(input.soil.fieldCapacityPct, 20);
  assert.equal(calculateIrrigationSimulation(input).ok, true);
});

test("accessors are rejected without invocation and expected errors are safe JSON", () => {
  const input = g01Input(); let calls = 0;
  Object.defineProperty(input.crop, "etoMmPerDay", { enumerable: true, get() { calls++; throw new Error("getter executed"); } });
  assert.equal(validateIrrigationInput(input).ok, false); assert.equal(calls, 0);
  const unsafe = g01Input(); unsafe.irrigation.flowLps = "private-token-not-to-echo";
  const result = calculateIrrigationSimulation(unsafe);
  assert.ok(!JSON.stringify(result).includes("private-token-not-to-echo"));
  assert.ok(result.errors.every(e => e.code && e.field && e.message && e.rule && e.expected));
});

test("versions, schemas and source hash are stable, unique definitions and deeply frozen", () => {
  assert.equal(models.MODEL_VERSION, "irrigation-estimation-v1");
  assert.equal(models.CONTRACT_VERSION, "irrigation-contract-v1");
  assert.equal(models.METADATA_SCHEMA_VERSION, "irrigation-metadata-v1");
  assert.equal(models.DIAGNOSTICS_RULE_VERSION, "irrigation-diagnostics-v1");
  assert.equal(models.SOURCE_HASH, "42592487E6E07DEB1B25A073D74086A09C1BB19CB38411AAFC31D28EA64D2127".toLowerCase());
  assert.match(models.SOURCE_HASH, /^[0-9a-f]{64}$/);
  assert.equal(Object.isFrozen(models), true);
  assert.equal(Object.isFrozen(models.INPUT_CONTRACT.soil.fieldCapacityPct), true);
  assert.equal(Object.isFrozen(models.OUTPUT_CONTRACT.application), true);
  assert.throws(() => { models.INPUT_CONTRACT.soil.fieldCapacityPct.max = 200; }, TypeError);
});

test("metadata is fresh, deterministic and selects only authorized estimation parameters", () => {
  const first = models.createIrrigationMetadata(), second = models.createIrrigationMetadata();
  assert.deepEqual(first, second); assert.notEqual(first, second);
  assert.equal(first.metadataSchemaVersion, models.METADATA_SCHEMA_VERSION);
  assert.equal(first.implementationReference.modelVersion, models.MODEL_VERSION);
  assert.deepEqual(first.effectiveParameters, { infiltrationCoefficient: 4.5, infiltrationExponent: 0.5,
    middleArrivalFactor: 0.5, qmaxCoefficient: 0.0063, qmaxZeroSlopeValue: 6.3, advanceRules: null });
  assert.equal(first.evidenceState.calculationImplemented, true);
  assert.equal(first.evidenceState.scientificValidation, "not_validated");
  first.effectiveParameters.infiltrationCoefficient = 123; first.units.input.furrow.widthM = "cm";
  assert.equal(second.effectiveParameters.infiltrationCoefficient, 4.5);
  assert.equal(models.METADATA_TEMPLATE.units.input.furrow.widthM, "m");
});

test("output validator accepts G01 literals and preserves Number precision without claiming calculation", () => {
  const output = g01Output(), result = validateIrrigationOutput(output);
  assert.deepEqual(result, { ok: true, output });
  for (const [group, fields] of Object.entries(output)) {
    for (const [field, value] of Object.entries(fields)) if (typeof value === "number") {
      assertWithinTolerance(result.output[group][field], value);
      assert.equal(result.output[group][field], value);
    }
  }
  result.output.application.appliedVolumeL = 1;
  assert.equal(output.application.appliedVolumeL, 3240);
});

test("all fourteen outputs reject missing, nonnumeric and non-finite values", () => {
  for (const [group, fields] of Object.entries(g01Output())) {
    for (const [field, value] of Object.entries(fields)) {
      if (typeof value !== "number") continue;
      for (const invalid of [undefined, "number", null, NaN, Infinity]) {
        const output = g01Output(); output[group][field] = invalid;
        assert.equal(validateIrrigationOutput(output).ok, false);
      }
    }
  }
});

test("output inconsistencies are fatal, with no clamping or mutation", () => {
  const cases = [
    ["efficiency", "applicationEfficiencyPct", 101], ["efficiency", "applicationEfficiencyPct", -1],
    ["application", "estimatedUsefulVolumeL", 3241], ["application", "residualLossVolumeL", -1],
    ["diagnostics", "advanceRatioPct", 101], ["diagnostics", "maxNonErosiveFlowLps", 0],
  ];
  for (const [group, field, value] of cases) {
    const output = g01Output(); output[group][field] = value;
    assertRejected(validateIrrigationOutput(output), `output.${group}.${field}`, "MODEL_INCONSISTENCY");
    assert.equal(output[group][field], value);
  }
});

test("structured nonfatal diagnostics are copied; errors never become persistible diagnostics", () => {
  const output = g01Output();
  output.diagnostics.items = [{ id: "CONTRACT_TEST_ONLY", ruleVersion: models.DIAGNOSTICS_RULE_VERSION,
    severity: "warning", fields: ["irrigation.flowLps"], evidence: { measured: 0.1, units: "L/s" } }];
  const result = validateIrrigationOutput(output);
  assert.equal(result.ok, true);
  result.output.diagnostics.items[0].evidence.measured = 2;
  assert.equal(output.diagnostics.items[0].evidence.measured, 0.1);
  output.diagnostics.items[0].severity = "error";
  assert.equal(validateIrrigationOutput(output).errors[0].code, "FATAL_DIAGNOSTIC");
  output.diagnostics.items[0].severity = "invalid";
  assert.equal(validateIrrigationOutput(output).ok, false);
});

test("diagnostics reject absent identity, bad fields, non-finite evidence and cyclic objects", () => {
  for (const evidence of [{ value: Infinity }, { value: undefined }, { value: new Date(0) }]) {
    const output = g01Output(); output.diagnostics.items = [{ id: "TEST", ruleVersion: "test", severity: "info", fields: [], evidence }];
    assert.equal(validateIrrigationOutput(output).ok, false);
  }
  const evidence = {}; evidence.self = evidence;
  const output = g01Output(); output.diagnostics.items = [{ id: "TEST", ruleVersion: "test", severity: "info", fields: [], evidence }];
  assert.equal(validateIrrigationOutput(output).ok, false);
  output.diagnostics.items = [{}]; assert.equal(validateIrrigationOutput(output).ok, false);
});

test("diagnostic arrays reject sparse/accessor data without hidden JSON normalization", () => {
  const output = g01Output(); output.diagnostics.items = new Array(1);
  assert.equal(validateIrrigationOutput(output).ok, false);
  let calls = 0;
  const fields = []; Object.defineProperty(fields, "0", { get() { calls++; return "input"; } });
  output.diagnostics.items = [{ id: "TEST", ruleVersion: "test", severity: "info", fields, evidence: {} }];
  assert.equal(validateIrrigationOutput(output).ok, false); assert.equal(calls, 0);
  output.diagnostics.items[0].fields = [];
  output.diagnostics.items[0].evidence = { list: new Array(2) };
  assert.equal(validateIrrigationOutput(output).ok, false);
});

test("unexpected programming exceptions propagate instead of becoming successful or validation results", () => {
  const input = new Proxy({}, { getPrototypeOf() { throw new Error("unexpected runtime failure"); } });
  assert.throws(() => calculateIrrigationSimulation(input), /unexpected runtime failure/);
});
