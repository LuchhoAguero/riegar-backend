// db/migrations/TIMESTAMP_create_calculos_table.js

exports.up = function (knex) {
  return knex.schema.createTable("calculos", function (table) {
    table.increments("id").primary();

    // --- Clave Foránea ---
    table.integer("finca_id").unsigned().notNullable();
    table.foreign("finca_id").references("id").inTable("fincas");

    // --- Datos del Cálculo ---
    table.string("nombre_calculo").defaultTo("Cálculo sin nombre");
    table.string("tipo_canal").notNullable(); // rectangular, trapezoidal, etc.

    // Parámetros de entrada
    table.decimal("b", 8, 4); // Ancho de fondo
    table.decimal("h", 8, 4).notNullable(); // Profundidad
    table.decimal("z", 8, 4); // Pendiente lateral
    table.decimal("n", 8, 4).notNullable(); // Coef. Manning
    table.decimal("S", 10, 6).notNullable(); // Pendiente

    // Resultados
    table.decimal("A", 10, 4).notNullable(); // Área
    table.decimal("P", 10, 4).notNullable(); // Perímetro
    table.decimal("Q_m3s", 12, 6).notNullable(); // Caudal en m3/s

    table.timestamps(true, true);
  });
};

exports.down = function (knex) {
  return knex.schema.dropTable("calculos");
};
