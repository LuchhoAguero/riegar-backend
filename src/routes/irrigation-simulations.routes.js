const express = require("express");
const knex = require("../config/knex");
const auth = require("../middleware/auth.middleware");
const { createIrrigationSimulationService } = require("../services/irrigation-simulations.service");
const { IrrigationApplicationError } = require("../services/irrigation-simulations.mapper");
const { HttpInputError, routeId, knownFields, postInput, historyQuery, encodeCursor, publicSnapshot } = require("./irrigation-simulations.http");
const service = createIrrigationSimulationService(knex);
const router = express.Router();
const base = "/api/fincas/:fincaId/irrigation-simulations";
const INPUT_CODES = new Set(["INVALID_SHAPE", "UNKNOWN_FIELD", "MISSING_FIELD", "INVALID_TYPE", "NON_FINITE_NUMBER", "OUT_OF_RANGE", "INVALID_RELATIONSHIP"]);
const MODEL_CODES = new Set(["MODEL_INCONSISTENCY", "NON_FINITE_RESULT", "INVALID_DIAGNOSTIC", "FATAL_DIAGNOSTIC"]);

function sendResult(res, result, status) {
  if (result.kind === "FARM_NOT_FOUND" || result.kind === "SIMULATION_NOT_FOUND") {
    return res.status(404).json({ error: "Recurso no encontrado o no tienes permiso.", code: "RESOURCE_NOT_FOUND" });
  }
  if (result.kind === "MODEL_ERROR") {
    if (!Array.isArray(result.errors) || !result.errors.length) throw new Error("Resultado de modelo inválido.");
    const codes = result.errors.map(error => error.code);
    let httpStatus, code;
    if (codes.every(value => INPUT_CODES.has(value))) { httpStatus = 400; code = "INVALID_IRRIGATION_INPUT"; }
    else if (codes.every(value => MODEL_CODES.has(value))) { httpStatus = 422; code = "IRRIGATION_MODEL_INCONSISTENCY"; }
    else if (codes.every(value => value === "MODEL_NOT_IMPLEMENTED")) { httpStatus = 503; code = "IRRIGATION_MODEL_UNAVAILABLE"; }
    else throw new Error("Código de modelo inesperado.");
    const errors = result.errors.map(error => Object.fromEntries(["code", "category", "field", "rule", "expected", "message"]
      .filter(key => typeof error[key] === "string").map(key => [key, error[key]])));
    return res.status(httpStatus).json({ error: "La simulación no pudo completarse con estos datos.", code, errors });
  }
  if (result.kind !== "SUCCESS") throw new Error("Resultado de servicio inesperado.");
  return res.status(status).json(publicSnapshot(result.snapshot));
}
function failure(res, error) {
  if (error instanceof HttpInputError || error instanceof IrrigationApplicationError) {
    return res.status(400).json({ error: error.message, code: error.code, field: error.field });
  }
  console.error("Error inesperado de simulaciones de riego.");
  return res.status(500).json({ error: "Ocurrió un error en el servidor.", code: "INTERNAL_ERROR" });
}
router.post(base, auth, async (req, res) => {
  try {
    const fincaId = routeId(req.params.fincaId, "fincaId");
    knownFields(req.query, [], "query");
    if (!req.is("application/json")) return res.status(415).json({ error: "Se requiere Content-Type application/json.", code: "INVALID_CONTENT_TYPE" });
    const body = postInput(req.body);
    return sendResult(res, await service.create({ userId: req.user.userId, fincaId, ...body }), 201);
  } catch (error) { return failure(res, error); }
});
router.get(base, auth, async (req, res) => {
  try {
    const fincaId = routeId(req.params.fincaId, "fincaId");
    const result = await service.history({ userId: req.user.userId, fincaId, ...historyQuery(req.query) });
    if (result.kind !== "SUCCESS") return sendResult(res, result, 200);
    return res.json({ items: result.items, pagination: { ...result.pagination, nextCursor: encodeCursor(result.pagination.nextCursor) } });
  } catch (error) { return failure(res, error); }
});
router.get(`${base}/:simulationId`, auth, async (req, res) => {
  try {
    const fincaId = routeId(req.params.fincaId, "fincaId");
    const simulationId = routeId(req.params.simulationId, "simulationId");
    knownFields(req.query, [], "query");
    return sendResult(res, await service.detail({ userId: req.user.userId, fincaId, simulationId }), 200);
  } catch (error) { return failure(res, error); }
});
module.exports = router;
