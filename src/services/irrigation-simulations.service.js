const { ACTIVE_DESCRIPTOR, resolveActiveDescriptor } = require("./irrigation-simulations.versions");
const persistence = require("./irrigation-simulations.persistence");
const { validId, normalizeName, validatePagination } = require("./irrigation-simulations.mapper");
const { mapCalculationToSnapshotVersioned, mapStoredDetailVersioned, mapHistorySummaryVersioned } = require("./irrigation-simulations.versioned-mapper");

// Explicit dependency, no framework or import of live DB configuration.
function createIrrigationSimulationService(knex, { descriptor = ACTIVE_DESCRIPTOR, calculate, now = () => new Date() } = {}) {
  const active = resolveActiveDescriptor(descriptor);
  const runCalculation = calculate ?? active.calculate;
  async function create({ userId, fincaId, name, canonicalInput }) {
    validId(userId, "userId"); validId(fincaId, "fincaId");
    return knex.transaction(async trx => {
      const farm = await persistence.findOwnedFarm(trx, userId, fincaId, true);
      if (!farm) return { kind: "FARM_NOT_FOUND" };
      const normalizedName = normalizeName(name);
      const result = runCalculation(canonicalInput);
      if (!result.ok) return { kind: "MODEL_ERROR", errors: result.errors };
      const snapshot = mapCalculationToSnapshotVersioned({ fincaId, name: normalizedName, calculationResult: result, createdAt: now() }, { descriptor: active });
      const id = await persistence.insertSnapshot(trx, snapshot);
      const row = await persistence.findSnapshot(trx, { userId, fincaId, simulationId: id });
      if (!row) throw new Error("Snapshot insertado no recuperable dentro de la transacción.");
      return { kind: "SUCCESS", snapshot: mapStoredDetailVersioned(row) };
    });
  }
  async function history({ userId, fincaId, ...pagination }) {
    validId(userId, "userId"); validId(fincaId, "fincaId");
    const { limit, cursor } = validatePagination(pagination);
    if (!await persistence.findOwnedFarm(knex, userId, fincaId)) return { kind: "FARM_NOT_FOUND" };
    const rows = await persistence.listVersionedSnapshots(knex, { userId, fincaId, limit, cursor });
    const hasMore = rows.length > limit, page = rows.slice(0, limit);
    const items = page.map(mapHistorySummaryVersioned), last = items.at(-1);
    return { kind: "SUCCESS", items, pagination: { limit, hasMore,
      nextCursor: hasMore ? { createdAt: last.simulation.createdAt, id: last.simulation.id } : null } };
  }
  async function detail({ userId, fincaId, simulationId }) {
    validId(userId, "userId"); validId(fincaId, "fincaId"); validId(simulationId, "simulationId");
    if (!await persistence.findOwnedFarm(knex, userId, fincaId)) return { kind: "FARM_NOT_FOUND" };
    const row = await persistence.findSnapshot(knex, { userId, fincaId, simulationId });
    return row ? { kind: "SUCCESS", snapshot: mapStoredDetailVersioned(row) } : { kind: "SIMULATION_NOT_FOUND" };
  }
  return { create, history, detail };
}
module.exports = { createIrrigationSimulationService };
