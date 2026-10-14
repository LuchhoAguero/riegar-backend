const { calculateIrrigationSimulation } = require("./irrigation/irrigation-calculator.service");
const persistence = require("./irrigation-simulations.persistence");
const { validId, normalizeName, mapCalculationToSnapshot, mapStoredDetail, mapHistorySummary, validatePagination } = require("./irrigation-simulations.mapper");

// Explicit dependency, no framework or import of live DB configuration.
function createIrrigationSimulationService(knex, { calculate = calculateIrrigationSimulation, now = () => new Date() } = {}) {
  async function create({ userId, fincaId, name, canonicalInput }) {
    validId(userId, "userId"); validId(fincaId, "fincaId");
    return knex.transaction(async trx => {
      const farm = await persistence.findOwnedFarm(trx, userId, fincaId, true);
      if (!farm) return { kind: "FARM_NOT_FOUND" };
      const normalizedName = normalizeName(name);
      const result = calculate(canonicalInput);
      if (!result.ok) return { kind: "MODEL_ERROR", errors: result.errors };
      const snapshot = mapCalculationToSnapshot({ fincaId, name: normalizedName, calculationResult: result, createdAt: now() });
      const id = await persistence.insertSnapshot(trx, snapshot);
      const row = await persistence.findSnapshot(trx, { userId, fincaId, simulationId: id });
      if (!row) throw new Error("Snapshot insertado no recuperable dentro de la transacción.");
      return { kind: "SUCCESS", snapshot: mapStoredDetail(row) };
    });
  }
  async function history({ userId, fincaId, ...pagination }) {
    validId(userId, "userId"); validId(fincaId, "fincaId");
    const { limit, cursor } = validatePagination(pagination);
    if (!await persistence.findOwnedFarm(knex, userId, fincaId)) return { kind: "FARM_NOT_FOUND" };
    const rows = await persistence.listSnapshots(knex, { userId, fincaId, limit, cursor });
    const hasMore = rows.length > limit, page = rows.slice(0, limit);
    const items = page.map(mapHistorySummary), last = items.at(-1);
    return { kind: "SUCCESS", items, pagination: { limit, hasMore,
      nextCursor: hasMore ? { createdAt: last.simulation.createdAt, id: last.simulation.id } : null } };
  }
  async function detail({ userId, fincaId, simulationId }) {
    validId(userId, "userId"); validId(fincaId, "fincaId"); validId(simulationId, "simulationId");
    if (!await persistence.findOwnedFarm(knex, userId, fincaId)) return { kind: "FARM_NOT_FOUND" };
    const row = await persistence.findSnapshot(knex, { userId, fincaId, simulationId });
    return row ? { kind: "SUCCESS", snapshot: mapStoredDetail(row) } : { kind: "SIMULATION_NOT_FOUND" };
  }
  return { create, history, detail };
}
module.exports = { createIrrigationSimulationService };
