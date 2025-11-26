// knexfile.js
module.exports = {
  development: {
    client: 'mysql2', // Le decimos a Knex que estamos usando MySQL
    connection: {
      host: '127.0.0.1',      // La dirección de tu servidor de base de datos
      user: 'root',           // El usuario por defecto de MySQL
      password: 'NuevaContraseña123', // <-- REEMPLAZA CON TU CONTRASEÑA
      database: 'riegar_db'   // El nombre de la base de datos que creamos
    },
    migrations: {
      directory: './db/migrations' // Carpeta donde se guardarán las migraciones
    }
  }
};