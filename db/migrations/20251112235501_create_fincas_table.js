// db/migrations/TIMESTAMP_create_fincas_table.js

exports.up = function(knex) {
  return knex.schema.createTable('fincas', function(table) {
    table.increments('id').primary();
    table.string('nombre_finca').notNullable();
    table.string('ubicacion').nullable(); // 'nullable' significa que puede estar vacío

    // Esta es la "llave foránea" que conecta la finca con el usuario
    table.integer('user_id').unsigned().notNullable();
    table.foreign('user_id').references('id').inTable('users');

    table.timestamps(true, true);
  });
};

exports.down = function(knex) {
  return knex.schema.dropTable('fincas');
};