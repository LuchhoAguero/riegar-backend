const { INPUT_CONTRACT, OUTPUT_CONTRACT, MODEL_VERSION, CONTRACT_VERSION, METADATA_SCHEMA_VERSION,
  DIAGNOSTICS_RULE_VERSION, SOURCE_HASH, METADATA_TEMPLATE } = require("./irrigation/v2/irrigation-models");
const { validateIrrigationInput, validateIrrigationOutput } = require("./irrigation/v2/irrigation-validation");
const legacy = require("./irrigation-simulations.mapper");
const { invalid, ownData, isPlainObject, copyJson, validateProvenance, snapshotBoundary } = require("./irrigation-simulations.snapshot");
const versions = Object.freeze({ modelVersion: MODEL_VERSION, contractVersion: CONTRACT_VERSION,
  metadataSchemaVersion: METADATA_SCHEMA_VERSION, diagnosticsRuleVersion: DIAGNOSTICS_RULE_VERSION, sourceHash: SOURCE_HASH });

function readFurrowCount(value) {
  let count = value;
  if (typeof value === "string") {
    if (!/^[1-9][0-9]{0,15}$/.test(value)) invalid();
    const integer = BigInt(value);
    // JS '$' can match before a final newline; canonical text must be exact.
    if (integer.toString() !== value || integer < 1n || integer > 9007199254740991n) invalid();
    count = Number(integer);
  }
  if (typeof count !== "number" || !Number.isSafeInteger(count) || count < 1) invalid();
  return count;
}
function dateCopy(value) {
  if (!(value instanceof Date) || !Number.isFinite(value.getTime()) || value.getUTCFullYear() < 1000 || value.getUTCFullYear() > 9999) invalid();
  return new Date(value.getTime());
}
function validateCanonical(input, output) {
  const checkedInput = validateIrrigationInput(input), checkedOutput = validateIrrigationOutput(output);
  if (!checkedInput.ok || !checkedOutput.ok) invalid();
  // No normalization/defaults of calculator snapshots or stored canonical inputs.
  for (const [group, fields] of Object.entries(INPUT_CONTRACT)) for (const field of Object.keys(fields)) {
    if (ownData(ownData(input, group), field) !== checkedInput.input[group][field]) invalid();
  }
  const daily = checkedOutput.output.waterNeed.dailyCropWaterUseMmPerDay;
  const { etoMmPerDay, cropCoefficient } = checkedInput.input.crop;
  if ((etoMmPerDay === 0 || cropCoefficient === 0) ? daily !== 0 : daily === 0) invalid();
  return { input: checkedInput.input, output: checkedOutput.output };
}
function mapCalculationToSnapshot({ fincaId, name, calculationResult: result, createdAt }) {
  // Application identity errors keep the existing application contract on WRITE.
  legacy.validId(fincaId, "fincaId");
  const normalizedName = legacy.normalizeName(name);
  return snapshotBoundary(() => {
    result = copyJson(result);
    if (!isPlainObject(result) || ownData(result, "ok") !== true || !isPlainObject(result.metadata) ||
      !Array.isArray(result.output?.diagnostics?.items)) invalid();
    const { input, output } = validateCanonical(result.input, result.output);
    const { metadata, diagnostics } = validateProvenance({ model_version: result.modelVersion, contract_version: result.contractVersion,
      source_hash: result.sourceHash, model_metadata: result.metadata, diagnostics: output.diagnostics.items }, versions, METADATA_TEMPLATE);
    const row = { finca_id: fincaId, name: normalizedName };
    for (const [contract, values] of [[INPUT_CONTRACT, input], [OUTPUT_CONTRACT, output]]) {
      for (const [group, fields] of Object.entries(contract)) for (const [field, definition] of Object.entries(fields)) {
        if (definition.type !== "diagnostics") row[definition.sqlColumn] = values[group][field];
      }
    }
    return { ...row, model_version: MODEL_VERSION, source_hash: SOURCE_HASH, contract_version: CONTRACT_VERSION,
      model_metadata: metadata, diagnostics, created_at: dateCopy(createdAt) };
  });
}
function readGroups(row, contract, diagnostics) {
  return Object.fromEntries(Object.entries(contract).map(([group, fields]) => [group,
    Object.fromEntries(Object.entries(fields).map(([field, d]) => {
      if (d.type === "diagnostics") return [field, copyJson(diagnostics)];
      const value = ownData(row, d.sqlColumn);
      if (field === "furrowCount") return [field, readFurrowCount(value)];
      // Only count has a string adapter. Every other number is a stored Number.
      if (d.type === "number" && !(value === null && d.nullable) && (typeof value !== "number" || !Number.isFinite(value))) invalid();
      if (d.type === "text" && value !== null && typeof value !== "string") invalid();
      return [field, value];
    }))]));
}
function mapStoredDetail(row) {
  return snapshotBoundary(() => {
    const { metadata, diagnostics } = validateProvenance(row, versions, METADATA_TEMPLATE);
    const groups = validateCanonical(readGroups(row, INPUT_CONTRACT), readGroups(row, OUTPUT_CONTRACT, diagnostics));
    const common = legacy.mapHistorySummary({ ...row, diagnostics });
    return { simulation: common.simulation, model: common.model, input: groups.input, output: groups.output, metadata };
  });
}
function mapHistorySummary(row) {
  return snapshotBoundary(() => {
    const { diagnostics } = validateProvenance(row, versions, METADATA_TEMPLATE);
    const count = readFurrowCount(ownData(row, "furrow_count"));
    const total = ownData(row, "total_applied_volume_l");
    if (typeof total !== "number" || !Number.isFinite(total) || total <= 0) invalid();
    for (const [field, min, exclusive, max] of [["target_depth_mm", 0, false], ["applied_volume_l", 0, true],
      ["application_efficiency_pct", 0, false, 100]]) {
      const value = ownData(row, field);
      if (typeof value !== "number" || !Number.isFinite(value) || (exclusive ? value <= min : value < min) ||
        (max !== undefined && value > max)) invalid();
    }
    const common = legacy.mapHistorySummary({ ...row, diagnostics });
    return { ...common, summary: { ...common.summary, furrowCount: count, totalAppliedVolumeL: total } };
  });
}
module.exports = { mapCalculationToSnapshot, mapStoredDetail, mapHistorySummary, readFurrowCount };
