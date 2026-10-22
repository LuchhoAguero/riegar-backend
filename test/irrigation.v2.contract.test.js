"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const models = require("../src/services/irrigation/v2/irrigation-models");
const { validateIrrigationInput: inputCheck, validateIrrigationOutput: outputCheck } = require("../src/services/irrigation/v2/irrigation-validation");
const { calculateIrrigationSimulation: calculate } = require("../src/services/irrigation/v2/irrigation-calculator.service");
const golden = require("./fixtures/irrigation-v2-golden");
const input = () => structuredClone(golden.input);
const output = () => structuredClone(golden.output);
function has(result, code, field) {
  assert.equal(result.ok, false);
  assert.ok(result.errors.some(e => e.code === code && (!field || e.field === field)), JSON.stringify(result));
  assert.deepEqual(Object.keys(result), ["ok", "errors"]);
}

test("V2 input shape has exactly the approved sixteen fields and fifteen strict numbers", () => {
  const expected = { crop: ["etoMmPerDay", "cropCoefficient", "daysWithoutIrrigation"],
    soil: ["texture", "fieldCapacityPct", "wiltingPointPct", "bulkDensityGcm3", "rootDepthM", "depletionThresholdPct"],
    furrow: ["furrowSpacingM", "lengthM", "slopePct", "furrowCount"],
    irrigation: ["flowLps", "durationMin", "advanceTimeMin"] };
  assert.deepEqual(Object.fromEntries(Object.entries(models.INPUT_CONTRACT).map(([g, d]) => [g, Object.keys(d)])), expected);
  assert.deepEqual(inputCheck(input()), { ok: true, input: input() });
  assert.equal(Object.values(models.INPUT_CONTRACT).flatMap(Object.values).filter(d => d.type === "number").length, 15);
  assert.equal(models.INPUT_CONTRACT.furrow.furrowSpacingM.unit, "m");
  assert.equal(models.INPUT_CONTRACT.furrow.furrowCount.integer, true);
});

test("every V2 number rejects missing, null, coercion and non-finite input", () => {
  for (const [group, defs] of Object.entries(models.INPUT_CONTRACT)) for (const [field, d] of Object.entries(defs)) {
    if (d.type !== "number") continue;
    const path = `input.${group}.${field}`;
    for (const v of [null, "18", true, [], {}, undefined]) {
      const data = input(); data[group][field] = v;
      has(inputCheck(data), v === undefined ? "MISSING_FIELD" : "INVALID_TYPE", path);
    }
    for (const v of [NaN, Infinity, -Infinity]) {
      const data = input(); data[group][field] = v; has(inputCheck(data), "NON_FINITE_NUMBER", path);
    }
    const data = input(); delete data[group][field]; has(inputCheck(data), "MISSING_FIELD", path);
  }
});

test("V2 unknown fields reject width aliases, authority, derived fields and excluded features", () => {
  for (const key of ["modelVersion", "contractVersion", "metadata", "output", "sourceHash", "userId", "name"]) {
    const data = input(); data[key] = "client"; has(inputCheck(data), "UNKNOWN_FIELD", `input.${key}`);
  }
  for (const [group, field] of [["furrow", "widthM"], ["furrow", "wettedWidthM"], ["furrow", "surfaceAreaM2"],
    ["irrigation", "runoff"], ["soil", "daysUntilDepletionThreshold"]]) {
    const data = input(); data[group][field] = 1; has(inputCheck(data), "UNKNOWN_FIELD", `input.${group}.${field}`);
  }
  for (const group of Object.keys(golden.input)) {
    const data = input(); delete data[group]; has(inputCheck(data), "INVALID_SHAPE", `input.${group}`);
  }
});

test("root/groups must be plain data and accessors are rejected without invocation", () => {
  for (const value of [null, [], 7, "data", new Date()]) has(inputCheck(value), "INVALID_SHAPE", "input");
  for (const group of Object.keys(golden.input)) for (const value of [null, [], 1, "data", new Date()]) {
    const data = input(); data[group] = value; has(inputCheck(data), "INVALID_SHAPE", `input.${group}`);
  }
  let calls = 0; const data = input();
  Object.defineProperty(data.furrow, "furrowSpacingM", { get() { calls++; throw Error("getter"); } });
  has(inputCheck(data), "INVALID_SHAPE", "input.furrow.furrowSpacingM"); assert.equal(calls, 0);
  const withSymbol = input(); withSymbol[Symbol("extra")] = 1; has(inputCheck(withSymbol), "UNKNOWN_FIELD");
  assert.equal(inputCheck(Object.assign(Object.create(null), input())).ok, true);
});

test("soil and advance relationships retain canonical V1 validation", () => {
  for (const pmp of [20, 21]) { const data = input(); data.soil.wiltingPointPct = pmp;
    has(inputCheck(data), "INVALID_RELATIONSHIP", "input.soil.fieldCapacityPct"); }
  const data = input(); data.irrigation.advanceTimeMin = 121;
  has(inputCheck(data), "INVALID_RELATIONSHIP", "input.irrigation.advanceTimeMin");
  for (const [group, field, value] of [["furrow", "furrowSpacingM", 0], ["furrow", "lengthM", 0], ["furrow", "slopePct", -1],
    ["soil", "fieldCapacityPct", 101], ["soil", "depletionThresholdPct", 0], ["soil", "depletionThresholdPct", 101],
    ["soil", "bulkDensityGcm3", 0], ["soil", "rootDepthM", 0], ["irrigation", "durationMin", 0], ["irrigation", "flowLps", 0],
    ["crop", "etoMmPerDay", -1], ["crop", "cropCoefficient", -1], ["crop", "daysWithoutIrrigation", -1]]) {
    const x = input(); x[group][field] = value; has(inputCheck(x), "OUT_OF_RANGE", `input.${group}.${field}`);
  }
  const fraction = input(); fraction.crop.daysWithoutIrrigation = 0.5; assert.equal(inputCheck(fraction).ok, true);
});

test("texture is optional/descriptive, trimmed, and bounded by Unicode code points", () => {
  for (const mode of [null, undefined, "missing"]) {
    const data = input(); if (mode === "missing") delete data.soil.texture; else data.soil.texture = mode;
    const r = inputCheck(data); assert.equal(r.ok, true); assert.equal(r.input.soil.texture, null);
  }
  const data = input(); data.soil.texture = "  Franco  "; assert.equal(inputCheck(data).input.soil.texture, "Franco");
  data.soil.texture = "😀".repeat(64); assert.equal(inputCheck(data).ok, true);
  for (const s of ["", "  ", "a".repeat(65), "😀".repeat(65)]) {
    data.soil.texture = s; has(inputCheck(data), "OUT_OF_RANGE", "input.soil.texture");
  }
  data.soil.texture = 1; has(inputCheck(data), "INVALID_TYPE", "input.soil.texture");
});

test("V2 output shape is the approved nineteen magnitudes plus diagnostic array", () => {
  assert.deepEqual(Object.fromEntries(Object.entries(models.OUTPUT_CONTRACT).map(([g, defs]) => [g, Object.keys(defs)])),
    Object.fromEntries(Object.entries(golden.output).map(([g, fields]) => [g, Object.keys(fields)])));
  const defs = Object.values(models.OUTPUT_CONTRACT).flatMap(Object.values);
  assert.equal(defs.filter(d => d.type === "number").length, 19);
  assert.equal(defs.filter(d => d.nullable).length, 2);
  assert.deepEqual(outputCheck(output()), { ok: true, output: output() });
  for (const [group, fields] of Object.entries(models.OUTPUT_CONTRACT)) for (const [field, d] of Object.entries(fields)) {
    if (d.type !== "number") continue;
    for (const value of ["1", false, undefined, NaN, Infinity]) {
      const data = output(); data[group][field] = value;
      has(outputCheck(data), Number.isNaN(value) || value === Infinity ? "NON_FINITE_RESULT" : value === undefined ? "MISSING_FIELD" : "INVALID_TYPE",
        `output.${group}.${field}`);
    }
    const data = output(); data[group][field] = null;
    has(outputCheck(data), d.nullable ? "MODEL_INCONSISTENCY" : "INVALID_TYPE", `output.${group}.${field}`);
  }
  const extra = output(); extra.totals.totalRecommendedVolumeL = 1; has(outputCheck(extra), "UNKNOWN_FIELD");
});

test("nullable day policy requires both explicit nulls for zero and both numbers for positive daily use", () => {
  const zero = output(); zero.waterNeed.dailyCropWaterUseMmPerDay = 0;
  zero.soilWater.daysUntilAvailableWaterExhaustion = null; zero.soilWater.daysUntilDepletionThreshold = null;
  assert.deepEqual(outputCheck(zero), { ok: true, output: zero });
  for (const field of ["daysUntilAvailableWaterExhaustion", "daysUntilDepletionThreshold"]) {
    const missing = structuredClone(zero); delete missing.soilWater[field]; has(outputCheck(missing), "MISSING_FIELD", `output.soilWater.${field}`);
    const wrong = structuredClone(zero); wrong.soilWater[field] = 0; has(outputCheck(wrong), "MODEL_INCONSISTENCY");
    const positive = structuredClone(zero); positive.soilWater[field] = 1; has(outputCheck(positive), "MODEL_INCONSISTENCY");
    const pair = output(); pair.soilWater[field] = null; has(outputCheck(pair), "MODEL_INCONSISTENCY");
  }
});

test("versions, source and full approved metadata are exact, immutable and independently copied", () => {
  assert.equal(models.MODEL_VERSION, golden.modelVersion); assert.equal(models.CONTRACT_VERSION, golden.contractVersion);
  assert.equal(models.SOURCE_HASH, golden.sourceHash); assert.equal(models.METADATA_SCHEMA_VERSION, "irrigation-metadata-v2");
  assert.equal(models.DIAGNOSTICS_RULE_VERSION, "irrigation-diagnostics-v1");
  assert.deepEqual(models.METADATA_TEMPLATE, golden.metadata);
  const meta = models.createIrrigationMetadata(); assert.deepEqual(meta, golden.metadata); assert.equal(Object.keys(meta).length, 9);
  function frozen(v) { assert.ok(Object.isFrozen(v)); for (const x of Object.values(v)) if (x && typeof x === "object") frozen(x); }
  frozen(models.INPUT_CONTRACT); frozen(models.OUTPUT_CONTRACT); frozen(models.METADATA_TEMPLATE);
  meta.assumptions.soilWaterContentBasis = "changed"; meta.diagnosticRules.evaluated.push("D01");
  assert.deepEqual(models.createIrrigationMetadata(), golden.metadata);
  const units = contract => Object.fromEntries(Object.entries(contract).map(([g, d]) => [g,
    Object.fromEntries(Object.entries(d).filter(([, d]) => d.unit).map(([f, d]) => [f, d.unit]))]));
  assert.deepEqual(golden.metadata.units.input, units(models.INPUT_CONTRACT));
  assert.deepEqual(golden.metadata.units.output, units(models.OUTPUT_CONTRACT));
});

test("diagnostic guards reject unsafe JSON, sparse arrays and fatal severities without partial success", () => {
  for (const change of [o => { o.diagnostics.items[0].severity = "error"; },
    o => { o.diagnostics.items[0].evidence.x = Infinity; },
    o => { o.diagnostics.items[0].evidence.self = o.diagnostics.items[0].evidence; },
    o => { o.diagnostics.items = new Array(1); }, o => { o.diagnostics.items[0].fields = new Array(1); }]) {
    const data = output(); change(data); assert.equal(outputCheck(data).ok, false);
  }
  assert.deepEqual(calculate(input()).output.diagnostics.items, golden.output.diagnostics.items);
});
