// Storage boundaries shared by versioned mappers. No DB, HTTP or calculations.
class IrrigationSnapshotError extends Error {
  constructor(reason = "SNAPSHOT_SHAPE_INVALID") {
    super("Snapshot de riego inválido o incompatible.");
    this.name = "IrrigationSnapshotError";
    this.code = "INVALID_IRRIGATION_SNAPSHOT";
    this.reason = reason;
  }
}
function invalid(reason) { throw new IrrigationSnapshotError(reason); }
function isPlainObject(value) {
  return value !== null && typeof value === "object" &&
    (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
}
function ownData(object, key) {
  if (!isPlainObject(object)) invalid();
  const d = Object.getOwnPropertyDescriptor(object, key);
  if (!d || !Object.hasOwn(d, "value")) invalid();
  return d.value;
}
function copyJson(value, ancestors = new Set()) {
  if (value === null || typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if ((!Array.isArray(value) && !isPlainObject(value)) || ancestors.has(value)) invalid();
  ancestors.add(value);
  let copy;
  if (Array.isArray(value)) {
    if (Reflect.ownKeys(value).length !== value.length + 1) invalid();
    copy = Array.from({ length: value.length }, (_, i) => {
      const d = Object.getOwnPropertyDescriptor(value, String(i));
      if (!d || !Object.hasOwn(d, "value")) invalid();
      return copyJson(d.value, ancestors);
    });
  } else {
    copy = Object.fromEntries(Reflect.ownKeys(value).map(key => {
      const d = Object.getOwnPropertyDescriptor(value, key);
      if (typeof key !== "string" || !Object.hasOwn(d, "value")) invalid();
      return [key, copyJson(d.value, ancestors)];
    }));
  }
  ancestors.delete(value);
  return copy;
}
function readJsonSnapshot(value, array) {
  let parsed = value;
  if (typeof value === "string") {
    try { parsed = JSON.parse(value); } catch { invalid(); }
  }
  if (array ? !Array.isArray(parsed) : !isPlainObject(parsed)) invalid();
  return copyJson(parsed);
}
const PUBLIC_METADATA_KEYS = Object.freeze(["metadataSchemaVersion", "effectiveParameters", "units", "assumptions",
  "evidenceState", "referenceVersions", "implementationReference", "diagnosticRules", "parameterProvenance"]);
const RULE_IDS = Object.freeze(["P01", "P02", "P03", "P04", "P05"]);
const V2_COLUMNS = Object.freeze(["furrow_count", "daily_crop_water_use_mm_per_day", "days_until_available_water_exhaustion",
  "days_until_depletion_threshold", "total_applied_volume_l", "total_applied_volume_m3"]);

function metadataShape(value, template) {
  // Validate the stored version's structure, never replace its historical values.
  if (template === null) { if (value !== null) invalid(); return; }
  if (Array.isArray(template)) {
    if (!Array.isArray(value) || value.length !== template.length) invalid();
    template.forEach((item, index) => metadataShape(value[index], item));
  } else if (isPlainObject(template)) {
    if (!isPlainObject(value)) invalid();
    for (const key of Object.keys(template)) metadataShape(ownData(value, key), template[key]);
  } else if (typeof value !== typeof template) invalid();
}
function validateProvenance(row, descriptor, metadataTemplate) {
  if (!isPlainObject(row) || Reflect.ownKeys(row).some(key => typeof key !== "string" ||
    !Object.hasOwn(Object.getOwnPropertyDescriptor(row, key), "value"))) invalid();
  if (ownData(row, "contract_version") !== descriptor.contractVersion) invalid("UNSUPPORTED_CONTRACT");
  if (ownData(row, "model_version") !== descriptor.modelVersion) invalid("MODEL_MISMATCH");
  if (ownData(row, "source_hash") !== descriptor.sourceHash) invalid("SOURCE_HASH_MISMATCH");
  const metadata = readJsonSnapshot(ownData(row, "model_metadata"), false);
  if (metadata.metadataSchemaVersion !== descriptor.metadataSchemaVersion) invalid("METADATA_SCHEMA_MISMATCH");
  for (const key of PUBLIC_METADATA_KEYS) {
    if (!Object.hasOwn(metadata, key) || (key !== "metadataSchemaVersion" && !isPlainObject(metadata[key]))) invalid();
  }
  if (metadata.implementationReference.modelVersion !== descriptor.modelVersion) invalid("MODEL_MISMATCH");
  if (metadata.diagnosticRules.ruleVersion !== descriptor.diagnosticsRuleVersion) invalid("DIAGNOSTICS_RULE_MISMATCH");
  metadataShape(metadata, metadataTemplate);
  const evaluated = metadata.diagnosticRules.evaluated;
  if (!Array.isArray(evaluated) || evaluated.length !== RULE_IDS.length || evaluated.some((id, i) => id !== RULE_IDS[i])) invalid();
  const diagnostics = readJsonSnapshot(ownData(row, "diagnostics"), true);
  for (const item of diagnostics) {
    if (!isPlainObject(item)) invalid();
    if (item.ruleVersion !== descriptor.diagnosticsRuleVersion) invalid("DIAGNOSTICS_RULE_MISMATCH");
    if (!RULE_IDS.includes(item.id) || !["info", "warning"].includes(item.severity) ||
      !Array.isArray(item.fields) || item.fields.some(f => typeof f !== "string" || !f.trim()) ||
      !isPlainObject(item.evidence) || (Object.hasOwn(item, "message") && typeof item.message !== "string") ||
      Object.keys(item).some(k => !["id", "ruleVersion", "severity", "fields", "evidence", "message"].includes(k))) invalid();
  }
  return { metadata, diagnostics };
}
function snapshotBoundary(callback, { preserveApplicationInput = false } = {}) {
  try { return callback(); } catch (error) {
    if (error instanceof IrrigationSnapshotError) throw error;
    if (preserveApplicationInput && error?.code === "INVALID_APPLICATION_INPUT") throw error;
    if (error instanceof TypeError || error instanceof SyntaxError || error?.code === "INVALID_APPLICATION_INPUT") invalid();
    throw error;
  }
}
module.exports = { IrrigationSnapshotError, invalid, isPlainObject, ownData, copyJson, readJsonSnapshot,
  PUBLIC_METADATA_KEYS, V2_COLUMNS, validateProvenance, snapshotBoundary };
