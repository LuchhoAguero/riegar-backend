"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const versions = require("../src/services/irrigation-simulations.versions");
const { IrrigationSnapshotError } = versions;
const legacy = require("../src/services/irrigation-simulations.mapper");
const v2Mapper = require("../src/services/irrigation-simulations.v2-mapper");
const facade = require("../src/services/irrigation-simulations.versioned-mapper");
const golden = require("./fixtures/irrigation-v2-golden");
const date = new Date("2026-10-20T15:30:45.123Z");
function inputV1() {
  const i = structuredClone(golden.input); i.furrow.widthM = i.furrow.furrowSpacingM;
  delete i.furrow.furrowSpacingM; delete i.furrow.furrowCount;
  i.irrigation.durationMin = 60; i.irrigation.advanceTimeMin = 4.8; return i;
}
function row(descriptor) {
  const input = descriptor === versions.ACTIVE_V1 ? inputV1() : structuredClone(golden.input);
  return { id: 7, ...descriptor.mapWrite({ fincaId: 3, createdAt: date, calculationResult: descriptor.calculate(input) }) };
}
function rejects(reason) { return e => e instanceof IrrigationSnapshotError && e.reason === reason && e.code === "INVALID_IRRIGATION_SNAPSHOT"; }

test("registry has exactly two immutable descriptors pointing to the approved modules", () => {
  assert.deepEqual(Object.keys(versions.CONTRACT_REGISTRY), ["irrigation-contract-v1", "irrigation-contract-v2"]);
  const keys = ["modelVersion", "contractVersion", "metadataSchemaVersion", "diagnosticsRuleVersion", "sourceHash",
    "INPUT_CONTRACT", "OUTPUT_CONTRACT", "validateInput", "validateOutput", "calculate", "mapWrite", "readDetail", "readHistory", "publicMetadataKeys"];
  for (const [n, d] of [[1, versions.ACTIVE_V1], [2, versions.ACTIVE_V2]]) {
    const base = n === 1 ? "../src/services/irrigation" : "../src/services/irrigation/v2";
    const models = require(`${base}/irrigation-models`), validation = require(`${base}/irrigation-validation`);
    const calculator = require(`${base}/irrigation-calculator.service`), mapper = n === 1 ? legacy : v2Mapper;
    assert.deepEqual(Object.keys(d), keys);
    assert.equal(d.modelVersion, models.MODEL_VERSION); assert.equal(d.contractVersion, models.CONTRACT_VERSION);
    assert.equal(d.metadataSchemaVersion, models.METADATA_SCHEMA_VERSION); assert.equal(d.sourceHash, models.SOURCE_HASH);
    assert.equal(d.diagnosticsRuleVersion, "irrigation-diagnostics-v1");
    assert.equal(d.INPUT_CONTRACT, models.INPUT_CONTRACT); assert.equal(d.OUTPUT_CONTRACT, models.OUTPUT_CONTRACT);
    assert.equal(d.validateInput, validation.validateIrrigationInput); assert.equal(d.validateOutput, validation.validateIrrigationOutput);
    assert.equal(d.calculate, calculator.calculateIrrigationSimulation); assert.equal(d.mapWrite, mapper.mapCalculationToSnapshot);
    assert.equal(d.readDetail, mapper.mapStoredDetail); assert.equal(d.readHistory, mapper.mapHistorySummary);
    assert.ok(Object.isFrozen(d)); assert.ok(Object.isFrozen(d.publicMetadataKeys)); assert.equal(d.publicMetadataKeys.length, 9);
    assert.throws(() => { d.modelVersion = "changed"; }, TypeError);
  }
  assert.ok(Object.isFrozen(versions.CONTRACT_REGISTRY));
  assert.throws(() => { versions.CONTRACT_REGISTRY.unknown = versions.ACTIVE_V1; }, TypeError);
});

test("stored V1 and V2 exact pairs resolve from object and text JSON snapshots", () => {
  for (const active of [versions.ACTIVE_V1, versions.ACTIVE_V2]) for (const jsonText of [false, true]) {
    const r = row(active);
    if (jsonText) { r.model_metadata = JSON.stringify(r.model_metadata); r.diagnostics = JSON.stringify(r.diagnostics); }
    const before = structuredClone(r); assert.equal(versions.resolveStoredVersion(r), active); assert.deepEqual(r, before);
  }
});

test("unknown contracts, case, spacing, prototype keys and coercion never fall back", () => {
  for (const contract of ["unknown", "IRRIGATION-CONTRACT-V1", " irrigation-contract-v1", "irrigation-contract-v1 ",
    "__proto__", "constructor", 1, null, new String("irrigation-contract-v1")]) {
    const r = row(versions.ACTIVE_V1); r.contract_version = contract;
    assert.throws(() => versions.resolveStoredVersion(r), rejects("UNSUPPORTED_CONTRACT"));
  }
  const r = row(versions.ACTIVE_V1); delete r.contract_version;
  assert.throws(() => versions.resolveStoredVersion(r), rejects("SNAPSHOT_SHAPE_INVALID"));
});

test("crossed models and altered hashes produce distinct internal errors", () => {
  for (const active of [versions.ACTIVE_V1, versions.ACTIVE_V2]) {
    const r = row(active); r.model_version = active === versions.ACTIVE_V1 ? versions.ACTIVE_V2.modelVersion : versions.ACTIVE_V1.modelVersion;
    assert.throws(() => versions.resolveStoredVersion(r), rejects("MODEL_MISMATCH"));
    r.model_version = active.modelVersion.toUpperCase(); assert.throws(() => versions.resolveStoredVersion(r), rejects("MODEL_MISMATCH"));
    r.model_version = active.modelVersion; r.source_hash = "0".repeat(64);
    assert.throws(() => versions.resolveStoredVersion(r), rejects("SOURCE_HASH_MISMATCH"));
  }
});

test("schema, metadata rule and item rule mismatches have explicit internal reasons", () => {
  for (const active of [versions.ACTIVE_V1, versions.ACTIVE_V2]) {
    let r = row(active); r.model_metadata.metadataSchemaVersion = "other";
    assert.throws(() => versions.resolveStoredVersion(r), rejects("METADATA_SCHEMA_MISMATCH"));
    r = row(active); r.model_metadata.diagnosticRules.ruleVersion = "other";
    assert.throws(() => versions.resolveStoredVersion(r), rejects("DIAGNOSTICS_RULE_MISMATCH"));
    r = row(active); r.diagnostics[0].ruleVersion = "other";
    assert.throws(() => versions.resolveStoredVersion(r), rejects("DIAGNOSTICS_RULE_MISMATCH"));
    r = row(active); r.model_metadata.implementationReference.modelVersion = "other";
    assert.throws(() => versions.resolveStoredVersion(r), rejects("MODEL_MISMATCH"));
  }
});

test("incomplete, unsafe or double-encoded JSON is invalid storage, never an application input error", () => {
  for (const change of [r => { r.model_metadata = "{"; }, r => { r.model_metadata = JSON.stringify(JSON.stringify(r.model_metadata)); },
    r => { r.diagnostics = JSON.stringify(JSON.stringify(r.diagnostics)); }, r => { delete r.model_metadata.units; },
    r => { r.model_metadata.assumptions = []; }, r => { r.model_metadata.effectiveParameters.x = Infinity; },
    r => { r.model_metadata.self = r.model_metadata; }, r => { r.diagnostics = new Array(1); },
    r => { r.diagnostics[0].fields = new Array(1); }, r => { r.diagnostics[0].severity = "error"; }]) {
    const r = row(versions.ACTIVE_V2); change(r);
    assert.throws(() => versions.resolveStoredVersion(r), e => e instanceof IrrigationSnapshotError && !(e instanceof legacy.IrrigationApplicationError));
  }
});

test("row/JSON accessors are rejected without evaluation", () => {
  for (const where of ["version", "metadata", "unrelated"]) {
    const r = row(versions.ACTIVE_V2); let calls = 0;
    const object = where === "metadata" ? r.model_metadata.assumptions : r;
    const field = where === "version" ? "contract_version" : "trap";
    Object.defineProperty(object, field, { enumerable: true, get() { calls++; throw Error("must not read"); } });
    assert.throws(() => versions.resolveStoredVersion(r), rejects("SNAPSHOT_SHAPE_INVALID")); assert.equal(calls, 0);
  }
});

test("metadata structural validation rejects missing nested data without enforcing today's parameter values", () => {
  for (const active of [versions.ACTIVE_V1, versions.ACTIVE_V2]) {
    const valid = row(active); valid.model_metadata.effectiveParameters.infiltrationCoefficient = 8;
    assert.equal(versions.resolveStoredVersion(valid), active);
    for (const corrupt of [r => { delete r.model_metadata.effectiveParameters.infiltrationCoefficient; },
      r => { r.model_metadata.effectiveParameters.infiltrationCoefficient = null; },
      r => { delete r.model_metadata.units.input.crop.etoMmPerDay; },
      r => { r.model_metadata.evidenceState.calculationImplemented = "true"; },
      r => { delete r.model_metadata.assumptions.soilWaterContentBasis; }]) {
      const invalidRow = row(active); corrupt(invalidRow);
      assert.throws(() => versions.resolveStoredVersion(invalidRow), rejects("SNAPSHOT_SHAPE_INVALID"));
    }
  }
});

test("active server descriptor defaults to V1 and only accepts registered bundle identity", () => {
  assert.equal(versions.ACTIVE_DESCRIPTOR, versions.ACTIVE_V1);
  assert.equal(versions.resolveActiveDescriptor(), versions.ACTIVE_V1);
  assert.equal(versions.resolveActiveDescriptor(versions.ACTIVE_V2), versions.ACTIVE_V2);
  for (const bad of [null, {}, { ...versions.ACTIVE_V2 }, "irrigation-contract-v2"]) {
    assert.throws(() => versions.resolveActiveDescriptor(bad), rejects("SNAPSHOT_SHAPE_INVALID"));
  }
  const r1 = versions.ACTIVE_V1.calculate(inputV1());
  assert.equal(facade.mapCalculationToSnapshotVersioned({ fincaId: 3, createdAt: date, calculationResult: r1 }).contract_version, "irrigation-contract-v1");
  const r2 = versions.ACTIVE_V2.calculate(structuredClone(golden.input));
  assert.throws(() => facade.mapCalculationToSnapshotVersioned({ fincaId: 3, createdAt: date, calculationResult: r2 }), rejects("MODEL_MISMATCH"));
  assert.equal(facade.mapCalculationToSnapshotVersioned({ fincaId: 3, createdAt: date, calculationResult: r2 }, { descriptor: versions.ACTIVE_V2 }).contract_version,
    "irrigation-contract-v2");
});
