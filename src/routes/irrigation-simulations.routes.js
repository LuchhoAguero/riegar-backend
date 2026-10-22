const knex = require("../config/knex");
const { createIrrigationSimulationRouter } = require("./irrigation-simulations.router");

// Bridge release. Expanded schema must be applied/certified before deployment.
module.exports = createIrrigationSimulationRouter(knex);
