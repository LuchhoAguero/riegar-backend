// Specific Knex queries. The caller supplies the connection/transaction.
const HISTORY_COLUMNS = Object.freeze(["id", "finca_id", "name", "created_at", "model_version", "contract_version",
  "source_hash", "target_depth_mm", "applied_volume_l", "application_efficiency_pct", "diagnostics"]);
async function insertSnapshot(trx, snapshot) {
  // Knex/mysql2 text queries do not infer JSON column types from JS bindings.
  // Serialize exactly once here, after the mapper has validated JSON data.
  if (!snapshot.model_metadata || typeof snapshot.model_metadata !== "object" || Array.isArray(snapshot.model_metadata) || !Array.isArray(snapshot.diagnostics)) throw new TypeError("JSON de snapshot requiere objeto/array, sin serialización previa.");
  const [id] = await trx("irrigation_simulations").insert({ ...snapshot,
    model_metadata: JSON.stringify(snapshot.model_metadata), diagnostics: JSON.stringify(snapshot.diagnostics) });
  return id;
}
function findOwnedFarm(db, userId, fincaId, lock = false) {
  const query = db("fincas").where({ id: fincaId, user_id: userId });
  if (lock) query.forShare();
  return query.first();
}
function listSnapshots(db, { userId, fincaId, limit, cursor }) {
  const query = db("irrigation_simulations as s").join("fincas as f", "s.finca_id", "f.id")
    .where({ "s.finca_id": fincaId, "f.user_id": userId })
    .select(HISTORY_COLUMNS.map(column => `s.${column}`));
  if (cursor) query.andWhere(function () {
    this.where("s.created_at", "<", cursor.createdAt).orWhere(function () {
      this.where("s.created_at", "=", cursor.createdAt).andWhere("s.id", "<", cursor.id);
    });
  });
  return query.orderBy("s.created_at", "desc").orderBy("s.id", "desc").limit(limit + 1);
}
function findSnapshot(db, { userId, fincaId, simulationId }) {
  return db("irrigation_simulations as s").join("fincas as f", "s.finca_id", "f.id")
    .where({ "s.id": simulationId, "s.finca_id": fincaId, "f.user_id": userId }).select("s.*").first();
}
module.exports = { insertSnapshot, findOwnedFarm, listSnapshots, findSnapshot, HISTORY_COLUMNS };
