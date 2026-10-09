const path = require("path");
const fs = require("fs");

require("dotenv").config({ quiet: true });

function getDatabaseSetting(name, railwayName) {
  return process.env[name] || process.env[railwayName];
}

function getDatabaseConnection() {
  const port = getDatabaseSetting("DB_PORT", "MYSQLPORT");
  const ssl = getDatabaseSsl();

  return {
    host: getDatabaseSetting("DB_HOST", "MYSQLHOST"),
    port: port ? Number(port) : undefined,
    user: getDatabaseSetting("DB_USER", "MYSQLUSER"),
    password: getDatabaseSetting("DB_PASSWORD", "MYSQLPASSWORD"),
    database: getDatabaseSetting("DB_NAME", "MYSQLDATABASE"),
    ...(ssl ? { ssl } : {}),
  };
}

function getDatabaseSsl() {
  const enabled = process.env.DB_SSL || "false";
  if (enabled !== "true" && enabled !== "false") {
    throw new Error("DB_SSL must be true or false");
  }
  if (enabled === "false") return undefined;

  if (!process.env.DB_SSL_CA_PATH) {
    throw new Error("DB_SSL_CA_PATH is required when DB_SSL=true");
  }

  try {
    return {
      ca: fs.readFileSync(process.env.DB_SSL_CA_PATH, "utf8"),
      rejectUnauthorized: true,
    };
  } catch {
    throw new Error("Cannot read the CA certificate at DB_SSL_CA_PATH");
  }
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
  getDatabaseSsl();
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
