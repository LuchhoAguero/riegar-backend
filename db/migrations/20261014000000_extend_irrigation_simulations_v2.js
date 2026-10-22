// MySQL DDL autocommits. A failed step requires inspection, never an automatic repair.
exports.config = { transaction: false };

const TABLE = "irrigation_simulations";
const COLUMNS = [
  "furrow_count", "daily_crop_water_use_mm_per_day",
  "days_until_available_water_exhaustion", "days_until_depletion_threshold",
  "total_applied_volume_l", "total_applied_volume_m3",
];
const CHECKS = [
  "irr_sim_version_pair_ck", "irr_sim_v1_extension_ck",
  "irr_sim_v2_extension_ck", "irr_sim_v2_days_ck",
];
const V1 = "(CAST(contract_version AS BINARY) = CAST('irrigation-contract-v1' AS BINARY) AND CAST(model_version AS BINARY) = CAST('irrigation-estimation-v1' AS BINARY))";
const V2 = "(CAST(contract_version AS BINARY) = CAST('irrigation-contract-v2' AS BINARY) AND CAST(model_version AS BINARY) = CAST('irrigation-estimation-v2' AS BINARY))";
const ALL_NULL = COLUMNS.map((column) => `${column} IS NULL`).join(" AND ");

async function preflight(knex, extended) {
  const [rows] = await knex.raw(
    "SELECT 'column' AS kind, COLUMN_NAME AS name FROM INFORMATION_SCHEMA.COLUMNS " +
    "WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? UNION ALL " +
    "SELECT 'check' AS kind, CONSTRAINT_NAME AS name FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS " +
    "WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND CONSTRAINT_TYPE = 'CHECK'",
    [TABLE, TABLE]
  );
  const columns = rows.filter((row) => row.kind === "column").map((row) => row.name);
  const checks = rows.filter((row) => row.kind === "check").map((row) => row.name);
  if (columns.length !== (extended ? 44 : 38) || checks.length !== (extended ? 14 : 10) ||
      COLUMNS.some((name) => columns.includes(name) !== extended) ||
      CHECKS.some((name) => checks.includes(name) !== extended)) {
    throw new Error("R4F-D3: unexpected or partial irrigation_simulations schema; inspect before retrying");
  }
}

exports.up = async function (knex) {
  await preflight(knex, false);
  await knex.schema.alterTable(TABLE, (table) => {
    table.bigInteger("furrow_count").unsigned().nullable();
    for (const column of COLUMNS.slice(1)) table.double(column).nullable();
  });
  await knex.schema.alterTable(TABLE, (table) => {
    table.check(`contract_version IS NOT NULL AND model_version IS NOT NULL AND (${V1} OR ${V2})`, [], CHECKS[0]);
    table.check(`${V2} OR (${V1} AND ${ALL_NULL})`, [], CHECKS[1]);
    table.check(`${V1} OR (${V2} AND furrow_count IS NOT NULL AND furrow_count >= 1 AND furrow_count <= 9007199254740991 AND daily_crop_water_use_mm_per_day IS NOT NULL AND daily_crop_water_use_mm_per_day >= 0 AND total_applied_volume_l IS NOT NULL AND total_applied_volume_l > 0 AND total_applied_volume_m3 IS NOT NULL AND total_applied_volume_m3 > 0)`, [], CHECKS[2]);
    table.check(`${V1} OR (${V2} AND daily_crop_water_use_mm_per_day IS NOT NULL AND ((daily_crop_water_use_mm_per_day = 0 AND days_until_available_water_exhaustion IS NULL AND days_until_depletion_threshold IS NULL) OR (daily_crop_water_use_mm_per_day > 0 AND days_until_available_water_exhaustion IS NOT NULL AND days_until_available_water_exhaustion > 0 AND days_until_depletion_threshold IS NOT NULL AND days_until_depletion_threshold > 0)))`, [], CHECKS[3]);
  });
};

exports.down = async function (knex) {
  await preflight(knex, true);
  // Not an atomic lock against writers: the operator must arrange maintenance.
  const [rows] = await knex.raw(
    `SELECT 1 AS blocked FROM irrigation_simulations WHERE contract_version IS NULL OR model_version IS NULL OR NOT ${V1} OR NOT (${ALL_NULL}) LIMIT 1`
  );
  if (rows.length !== 0) {
    throw new Error("R4F-D3: down refused; requires only exact V1 pairs and six NULL extensions");
  }
  await knex.schema.alterTable(TABLE, (table) => table.dropChecks(CHECKS));
  await knex.schema.alterTable(TABLE, (table) => table.dropColumns(...COLUMNS));
};
