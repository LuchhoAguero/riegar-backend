const { ACTIVE_DESCRIPTOR, resolveActiveDescriptor } = require("../services/irrigation-simulations.versions");
const { publicSnapshotVersioned } = require("../services/irrigation-simulations.versioned-mapper");
const { validatePagination } = require("../services/irrigation-simulations.mapper");

class HttpInputError extends Error {
  constructor(code, field, message) { super(message); this.code = code; this.field = field; }
}
function routeId(value, field) {
  if (typeof value !== "string" || !/^[1-9]\d{0,9}$/.test(value) || Number(value) > 4294967295) {
    throw new HttpInputError("INVALID_ROUTE_PARAMETER", field, "Identificador decimal positivo INT UNSIGNED requerido.");
  }
  return Number(value);
}
function knownFields(value, allowed, field) {
  for (const key of Object.keys(value)) {
    if (!allowed.includes(key)) throw new HttpInputError("INVALID_REQUEST", `${field}.${key}`, "Campo fuera del contrato HTTP.");
  }
}
function postInput(body, descriptor = ACTIVE_DESCRIPTOR) {
  const { INPUT_CONTRACT } = resolveActiveDescriptor(descriptor);
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new HttpInputError("INVALID_REQUEST", "body", "El cuerpo debe ser un objeto JSON.");
  }
  knownFields(body, ["name", ...Object.keys(INPUT_CONTRACT)], "body");
  const canonicalInput = {};
  for (const [group, definitions] of Object.entries(INPUT_CONTRACT)) {
    if (!Object.hasOwn(body, group)) continue; // Let the frozen validator report missing groups.
    const value = body[group];
    if (value && typeof value === "object" && !Array.isArray(value)) knownFields(value, Object.keys(definitions), group);
    canonicalInput[group] = value;
  }
  return { name: body.name, canonicalInput };
}
function decodeCursor(token) {
  try {
    if (typeof token !== "string" || token.length > 256 || !/^[A-Za-z0-9_-]+$/.test(token)) throw new Error();
    const bytes = Buffer.from(token, "base64url");
    if (bytes.toString("base64url") !== token) throw new Error();
    const text = bytes.toString("utf8");
    if (!Buffer.from(text, "utf8").equals(bytes)) throw new Error();
    const value = JSON.parse(text);
    if (!value || typeof value !== "object" || Array.isArray(value) || value.v !== 1 ||
        Object.keys(value).length !== 3 || !Object.hasOwn(value, "createdAt") || !Object.hasOwn(value, "id")) throw new Error();
    const cursor = { createdAt: value.createdAt, id: value.id };
    validatePagination({ cursor });
    return cursor;
  } catch { throw new HttpInputError("INVALID_PAGINATION", "cursor", "Cursor inválido."); }
}
function encodeCursor(cursor) {
  return cursor === null ? null : Buffer.from(JSON.stringify({ v: 1, createdAt: cursor.createdAt, id: cursor.id }), "utf8").toString("base64url");
}
function historyQuery(query) {
  knownFields(query, ["limit", "cursor"], "query");
  let limit = 20;
  if (query.limit !== undefined) {
    if (typeof query.limit !== "string" || !/^[1-9]\d{0,2}$/.test(query.limit) || Number(query.limit) > 100) {
      throw new HttpInputError("INVALID_PAGINATION", "limit", "Limit debe ser entero decimal entre 1 y 100.");
    }
    limit = Number(query.limit);
  }
  return { limit, cursor: query.cursor === undefined ? null : decodeCursor(query.cursor) };
}
function publicSnapshot(snapshot) {
  return publicSnapshotVersioned(snapshot);
}
module.exports = { HttpInputError, routeId, knownFields, postInput, historyQuery, encodeCursor, publicSnapshot };
