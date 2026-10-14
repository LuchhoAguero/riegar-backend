const { INPUT_CONTRACT, OUTPUT_CONTRACT } = require("./irrigation/irrigation-models");
const { validateIrrigationInput, validateIrrigationOutput } = require("./irrigation/irrigation-validation");

class IrrigationApplicationError extends Error {
  constructor(field, message) { super(message); this.code = "INVALID_APPLICATION_INPUT"; this.field = field; }
}
function validId(value, field) {
  if (!Number.isInteger(value) || value < 1 || value > 4294967295) {
    throw new IrrigationApplicationError(field, "Debe ser un identificador INT UNSIGNED positivo.");
  }
  return value;
}
function normalizeName(value) {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string" || !value.trim() || [...value.trim()].length > 255) {
    throw new IrrigationApplicationError("name", "Debe ser texto no vacío de hasta 255 caracteres, o null.");
  }
  return value.trim();
}
function dateCopy(value) {
  if (!(value instanceof Date) || !Number.isFinite(value.getTime()) || value.getUTCFullYear() < 1000 || value.getUTCFullYear() > 9999) throw new TypeError("createdAt debe ser Date válido de aplicación en el rango DATETIME.");
  return new Date(value.getTime());
}
// JSON data only: avoid stringify/reparse, shared references or non-finite nulls.
function copyJson(value, ancestors = new Set()) {
  if (value === null || typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (!value || typeof value !== "object" || ancestors.has(value) ||
      (!Array.isArray(value) && Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null)) {
    throw new TypeError("Snapshot JSON inválido.");
  }
  ancestors.add(value);
  if (Array.isArray(value)) {
    if (Reflect.ownKeys(value).length !== value.length + 1) throw new TypeError("Array JSON inválido.");
    const copy = Array.from({ length: value.length }, (_, index) => {
      const d = Object.getOwnPropertyDescriptor(value, String(index));
      if (!d || !Object.hasOwn(d, "value")) throw new TypeError("Array JSON inválido.");
      return copyJson(d.value, ancestors);
    });
    ancestors.delete(value); return copy;
  }
  const entries = Reflect.ownKeys(value).map(key => {
    const d = Object.getOwnPropertyDescriptor(value, key);
    if (typeof key !== "string" || !Object.hasOwn(d, "value")) throw new TypeError("Objeto JSON inválido.");
    return [key, copyJson(d.value, ancestors)];
  });
  ancestors.delete(value); return Object.fromEntries(entries);
}
function jsonSnapshot(value, array) {
  const parsed = typeof value === "string" ? JSON.parse(value) : value;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed) !== array) throw new TypeError("Tipo de snapshot JSON inválido.");
  return copyJson(parsed);
}
function requiredText(value) {
  if (typeof value !== "string" || !value) throw new TypeError("Versión/hash histórico ausente.");
  return value;
}
function mapCalculationToSnapshot({ fincaId, name, calculationResult: result, createdAt }) {
  validId(fincaId, "fincaId");
  if (result?.ok !== true) throw new TypeError("Solo un cálculo exitoso puede mapearse a persistencia.");
  if (!validateIrrigationInput(result.input).ok || !validateIrrigationOutput(result.output).ok) {
    throw new TypeError("Resultado incompleto o inconsistente: no mapeable.");
  }
  if (!/^[0-9a-f]{64}$/.test(result.sourceHash) || result.input.soil.texture === undefined) throw new TypeError("Procedencia/snapshot canónico incompleto.");
  if (!result.metadata || typeof result.metadata !== "object" || Array.isArray(result.metadata)) throw new TypeError("Metadata efectiva debe ser un objeto.");
  requiredText(result.metadata.metadataSchemaVersion);
  for (const key of ["effectiveParameters", "units", "assumptions", "evidenceState", "referenceVersions", "implementationReference"]) {
    if (!result.metadata[key] || typeof result.metadata[key] !== "object" || Array.isArray(result.metadata[key])) throw new TypeError("Metadata reproducible incompleta.");
  }
  const row = { finca_id: fincaId, name: normalizeName(name) };
  for (const [contract, values] of [[INPUT_CONTRACT, result.input], [OUTPUT_CONTRACT, result.output]]) {
    for (const [group, fields] of Object.entries(contract)) for (const [field, d] of Object.entries(fields)) {
      if (d.type !== "diagnostics") row[d.sqlColumn] = values[group][field];
    }
  }
  return {
    ...row, model_version: requiredText(result.modelVersion), contract_version: requiredText(result.contractVersion),
    source_hash: requiredText(result.sourceHash), model_metadata: jsonSnapshot(result.metadata, false),
    diagnostics: jsonSnapshot(result.output.diagnostics.items, true), created_at: dateCopy(createdAt),
  };
}
function readGroups(row, contract) {
  return Object.fromEntries(Object.entries(contract).map(([group, fields]) => [group,
    Object.fromEntries(Object.entries(fields).map(([field, d]) => {
      const value = row[d.sqlColumn];
      if (d.type === "diagnostics") return [field, jsonSnapshot(value, true)];
      if (d.type === "number" && (typeof value !== "number" || !Number.isFinite(value))) throw new TypeError("Número histórico inválido.");
      if (d.type === "text" && value !== null && typeof value !== "string") throw new TypeError("Texto histórico inválido.");
      return [field, value];
    }))]));
}
function identity(row) {
  if (row.name !== null && typeof row.name !== "string") throw new TypeError("Nombre histórico inválido.");
  return { id: validId(row.id, "simulationId"), name: row.name, fincaId: validId(row.finca_id, "fincaId"),
    createdAt: dateCopy(row.created_at).toISOString() };
}
function model(row) {
  return { modelVersion: requiredText(row.model_version), contractVersion: requiredText(row.contract_version), sourceHash: requiredText(row.source_hash) };
}
function mapStoredDetail(row) {
  return { simulation: identity(row), model: model(row), input: readGroups(row, INPUT_CONTRACT),
    output: readGroups(row, OUTPUT_CONTRACT), metadata: jsonSnapshot(row.model_metadata, false) };
}
function mapHistorySummary(row) {
  const diagnostics = jsonSnapshot(row.diagnostics, true);
  if (diagnostics.some(d => !d || typeof d.severity !== "string")) throw new TypeError("Diagnóstico histórico inválido.");
  for (const key of ["target_depth_mm", "applied_volume_l", "application_efficiency_pct"]) {
    if (typeof row[key] !== "number" || !Number.isFinite(row[key])) throw new TypeError("Resumen histórico inválido.");
  }
  return { simulation: identity(row), model: model(row), summary: {
    targetDepthMm: row.target_depth_mm, appliedVolumeL: row.applied_volume_l,
    applicationEfficiencyPct: row.application_efficiency_pct,
    diagnostics: { count: diagnostics.length, severities: [...new Set(diagnostics.map(d => d.severity))] },
  } };
}
function validatePagination({ limit = 20, cursor = null } = {}) {
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw new IrrigationApplicationError("limit", "Debe ser entero entre 1 y 100.");
  if (cursor === null) return { limit, cursor: null };
  if (!cursor || typeof cursor !== "object" || Array.isArray(cursor) ||
      Object.keys(cursor).length !== 2 || !Object.hasOwn(cursor, "createdAt") || !Object.hasOwn(cursor, "id")) {
    throw new IrrigationApplicationError("cursor", "Cursor inválido.");
  }
  validId(cursor.id, "cursor.id");
  if (typeof cursor.createdAt !== "string" || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(cursor.createdAt)) {
    throw new IrrigationApplicationError("cursor.createdAt", "Fecha UTC canónica requerida.");
  }
  const date = new Date(cursor.createdAt);
  if (!Number.isFinite(date.getTime()) || date.toISOString() !== cursor.createdAt) throw new IrrigationApplicationError("cursor.createdAt", "Fecha UTC inválida.");
  return { limit, cursor: { createdAt: date, id: cursor.id } };
}
module.exports = { IrrigationApplicationError, validId, normalizeName, mapCalculationToSnapshot,
  mapStoredDetail, mapHistorySummary, validatePagination };
