const knex = require("knex");
const { createKnexConfig } = require("./database");

module.exports = knex(createKnexConfig());
