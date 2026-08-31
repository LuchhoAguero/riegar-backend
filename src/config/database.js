const path = require("path");

require("dotenv").config();

function getDatabaseSetting(name, railwayName) {
  return process.env[name] || process.env[railwayName];
}

function getDatabaseConnection() {
  const port = getDatabaseSetting("DB_PORT", "MYSQLPORT");

  return {
    host: getDatabaseSetting("DB_HOST", "MYSQLHOST"),
    port: port ? Number(port) : undefined,
    user: getDatabaseSetting("DB_USER", "MYSQLUSER"),
    password: getDatabaseSetting("DB_PASSWORD", "MYSQLPASSWORD"),
    database: getDatabaseSetting("DB_NAME", "MYSQLDATABASE"),
  };
}

function createKnexConfig() {
  return {
    client: "mysql2",
    connection: getDatabaseConnection(),
    migrations: {
      directory: path.resolve(__dirname, "../../db/migrations"),
    },
  };
}

function validateDatabaseConfig() {
  const requiredSettings = [
    ["DB_HOST", "MYSQLHOST"],
    ["DB_PORT", "MYSQLPORT"],
    ["DB_USER", "MYSQLUSER"],
    ["DB_PASSWORD", "MYSQLPASSWORD"],
    ["DB_NAME", "MYSQLDATABASE"],
  ];

  const missing = requiredSettings
    .filter(([name, railwayName]) => !getDatabaseSetting(name, railwayName))
    .map(([name, railwayName]) => `${name} or ${railwayName}`);

  if (missing.length > 0) {
    throw new Error(
      `Missing required database configuration: ${missing.join(", ")}`
    );
  }

  const port = Number(getDatabaseSetting("DB_PORT", "MYSQLPORT"));
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("DB_PORT or MYSQLPORT must be a valid port number");
  }
}

module.exports = {
  createKnexConfig,
  validateDatabaseConfig,
};
