/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function (knex) {
  return knex.schema.createTable("users", function (table) {
    table.increments("id").primary(); // ID autoincremental (clave primaria)
    table.string("nombre").notNullable();
    table.string("email").notNullable().unique(); // El email debe ser único
    table.string("password_hash").notNullable(); // Nunca guardamos la contraseña en texto plano
    table.timestamps(true, true); // Crea las columnas created_at y updated_at
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function (knex) {
  return knex.schema.dropTable("users");
};
