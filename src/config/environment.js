const { validateDatabaseConfig } = require("./database");

function validateEnvironment() {
  validateDatabaseConfig();

  const requiredVariables = ["JWT_SECRET", "EMAIL_USER", "EMAIL_PASS", "CORS_ORIGIN"];
  const missing = requiredVariables.filter((name) => !process.env[name]);

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment configuration: ${missing.join(", ")}`
    );
  }
}

module.exports = { validateEnvironment };
