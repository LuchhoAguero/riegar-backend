// knexfile.js
const { createKnexConfig } = require("./src/config/database");

module.exports = {
  development: createKnexConfig(),
  production: createKnexConfig(),
};
