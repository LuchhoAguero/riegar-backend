const v1Models = require("./irrigation/irrigation-models");
const v1Validation = require("./irrigation/irrigation-validation");
const v1Calculator = require("./irrigation/irrigation-calculator.service");
const v1Mapper = require("./irrigation-simulations.mapper");
const v2Models = require("./irrigation/v2/irrigation-models");
const v2Validation = require("./irrigation/v2/irrigation-validation");
const v2Calculator = require("./irrigation/v2/irrigation-calculator.service");
const v2Mapper = require("./irrigation-simulations.v2-mapper");
const { IrrigationSnapshotError, invalid, ownData, PUBLIC_METADATA_KEYS, validateProvenance } = require("./irrigation-simulations.snapshot");

function descriptor(models, validation, calculator, mapper) {
  return Object.freeze({ modelVersion: models.MODEL_VERSION, contractVersion: models.CONTRACT_VERSION,
    metadataSchemaVersion: models.METADATA_SCHEMA_VERSION, diagnosticsRuleVersion: models.DIAGNOSTICS_RULE_VERSION,
    sourceHash: models.SOURCE_HASH, INPUT_CONTRACT: models.INPUT_CONTRACT, OUTPUT_CONTRACT: models.OUTPUT_CONTRACT,
    validateInput: validation.validateIrrigationInput, validateOutput: validation.validateIrrigationOutput,
    calculate: calculator.calculateIrrigationSimulation, mapWrite: mapper.mapCalculationToSnapshot,
    readDetail: mapper.mapStoredDetail, readHistory: mapper.mapHistorySummary, publicMetadataKeys: PUBLIC_METADATA_KEYS });
}
const ACTIVE_V1 = descriptor(v1Models, v1Validation, v1Calculator, v1Mapper);
const ACTIVE_V2 = descriptor(v2Models, v2Validation, v2Calculator, v2Mapper);
const CONTRACT_REGISTRY = Object.freeze({ [ACTIVE_V1.contractVersion]: ACTIVE_V1, [ACTIVE_V2.contractVersion]: ACTIVE_V2 });
const METADATA_TEMPLATES = Object.freeze({ [ACTIVE_V1.contractVersion]: v1Models.METADATA_TEMPLATE,
  [ACTIVE_V2.contractVersion]: v2Models.METADATA_TEMPLATE });
// Bridge composition: keep POST V1 until a coordinated public cutover is authorized.
const ACTIVE_DESCRIPTOR = ACTIVE_V1;
function resolveStoredVersion(row) {
  const contract = ownData(row, "contract_version");
  if (typeof contract !== "string" || !Object.hasOwn(CONTRACT_REGISTRY, contract)) invalid("UNSUPPORTED_CONTRACT");
  const result = CONTRACT_REGISTRY[contract];
  validateProvenance(row, result, METADATA_TEMPLATES[contract]);
  return result;
}
function resolveActiveDescriptor(active = ACTIVE_DESCRIPTOR) {
  if (!active || !Object.hasOwn(CONTRACT_REGISTRY, active.contractVersion) || CONTRACT_REGISTRY[active.contractVersion] !== active) invalid();
  return active;
}
module.exports = { CONTRACT_REGISTRY, ACTIVE_V1, ACTIVE_V2, ACTIVE_DESCRIPTOR, resolveStoredVersion,
  resolveActiveDescriptor, IrrigationSnapshotError };
