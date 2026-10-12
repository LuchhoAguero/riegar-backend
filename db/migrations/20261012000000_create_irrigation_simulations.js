/**
 * @param { import("knex").Knex } knex
 * @returns { import("knex").Knex.SchemaBuilder }
 */
exports.up = function (knex) {
  return knex.schema.createTable("irrigation_simulations", function (table) {
    table.engine("InnoDB");
    table.charset("utf8mb4");

    table.increments("id").primary();
    table.integer("finca_id").unsigned().notNullable();
    table.string("name", 255).nullable();

    // Inputs efectivos en las unidades canónicas de R1.
    // DOUBLE sin escala: no redondear el snapshot de JS Number en SQL.
    table.double("eto_mm_per_day").notNullable();
    table.double("crop_coefficient").notNullable();
    table.double("days_without_irrigation").notNullable();

    // La textura es descriptiva y no autocompleta CC/PMP.
    table.string("texture", 64).nullable();
    table.double("field_capacity_pct").notNullable();
    table.double("wilting_point_pct").notNullable();
    table.double("bulk_density_g_cm3").notNullable();
    table.double("root_depth_m").notNullable();
    table.double("depletion_threshold_pct").notNullable();

    table.double("width_m").notNullable();
    table.double("length_m").notNullable();
    table.double("slope_pct").notNullable();

    table.double("flow_lps").notNullable();
    table.double("duration_min").notNullable();
    table.double("advance_time_min").notNullable();

    // Outputs completos de una estimación que pasa los controles del modelo.
    table.double("target_depth_mm").notNullable();
    table.double("available_water_mm").notNullable();
    table.double("available_capacity_l").notNullable();
    table.double("max_recommended_depth_mm").notNullable();
    table.double("max_recommended_volume_l").notNullable();
    table.double("applied_volume_l").notNullable();
    table.double("infiltrated_depth_start_mm").notNullable();
    table.double("infiltrated_depth_middle_mm").notNullable();
    table.double("infiltrated_depth_end_mm").notNullable();
    table.double("estimated_useful_volume_l").notNullable();
    table.double("residual_loss_volume_l").notNullable();
    table.double("application_efficiency_pct").notNullable();
    table.double("advance_ratio_pct").notNullable();
    table.double("max_non_erosive_flow_lps").notNullable();

    table.string("model_version", 64).notNullable();
    table
      .specificType("source_hash", "char(64) character set ascii collate ascii_bin")
      .notNullable();
    table.string("contract_version", 32).notNullable();

    // Sin defaults JSON: la aplicación debe suministrar metadata completa
    // y un array diagnostics (incluso []), nunca omitir errores con defaults.
    table.json("model_metadata").notNullable();
    table.json("diagnostics").notNullable();

    // UTC suministrado por el servidor al guardar. Snapshot sin updated_at.
    table.datetime("created_at", { precision: 3 }).notNullable();

    table.check(
      "eto_mm_per_day >= 0 AND crop_coefficient >= 0 AND days_without_irrigation >= 0",
      [],
      "irr_sim_crop_ck"
    );
    table.check(
      "wilting_point_pct >= 0 AND field_capacity_pct > wilting_point_pct AND field_capacity_pct <= 100 AND depletion_threshold_pct > 0 AND depletion_threshold_pct <= 100",
      [],
      "irr_sim_soil_pct_ck"
    );
    table.check(
      "bulk_density_g_cm3 > 0 AND root_depth_m > 0",
      [],
      "irr_sim_soil_geometry_ck"
    );
    table.check(
      "width_m > 0 AND length_m > 0 AND slope_pct >= 0",
      [],
      "irr_sim_furrow_ck"
    );
    table.check(
      "flow_lps > 0 AND duration_min > 0 AND advance_time_min >= 0 AND advance_time_min <= duration_min",
      [],
      "irr_sim_irrigation_ck"
    );
    table.check(
      "target_depth_mm >= 0 AND available_water_mm > 0 AND max_recommended_depth_mm > 0 AND infiltrated_depth_start_mm >= 0 AND infiltrated_depth_middle_mm >= 0 AND infiltrated_depth_end_mm >= 0",
      [],
      "irr_sim_output_depth_ck"
    );
    table.check(
      "available_capacity_l > 0 AND max_recommended_volume_l > 0 AND applied_volume_l > 0 AND estimated_useful_volume_l >= 0 AND estimated_useful_volume_l <= applied_volume_l AND residual_loss_volume_l >= 0",
      [],
      "irr_sim_output_volume_ck"
    );
    table.check(
      "application_efficiency_pct >= 0 AND application_efficiency_pct <= 100 AND advance_ratio_pct >= 0 AND advance_ratio_pct <= 100 AND max_non_erosive_flow_lps > 0",
      [],
      "irr_sim_output_ratio_ck"
    );
    table.check(
      "JSON_TYPE(model_metadata) = 'OBJECT' AND JSON_TYPE(diagnostics) = 'ARRAY'",
      [],
      "irr_sim_json_ck"
    );
    table.check("CHAR_LENGTH(source_hash) = 64", [], "irr_sim_hash_ck");

    table.index(
      ["finca_id", "created_at", "id"],
      "irrigation_simulations_finca_created_id_idx"
    );
    table
      .foreign("finca_id", "irrigation_simulations_finca_id_foreign")
      .references("id")
      .inTable("fincas")
      .onDelete("RESTRICT")
      .onUpdate("RESTRICT");
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { import("knex").Knex.SchemaBuilder }
 */
exports.down = function (knex) {
  return knex.schema.dropTable("irrigation_simulations");
};
