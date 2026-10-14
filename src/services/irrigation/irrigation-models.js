// Pure, immutable model and contract definitions. No external configuration.
function deepFreeze(value) {
  for (const child of Object.values(value)) {
    if (child && typeof child === "object") deepFreeze(child);
  }
  return Object.freeze(value);
}

const MODEL_VERSION = "irrigation-estimation-v1";
const CONTRACT_VERSION = "irrigation-contract-v1";
const METADATA_SCHEMA_VERSION = "irrigation-metadata-v1";
const DIAGNOSTICS_RULE_VERSION = "irrigation-diagnostics-v1";
const SOURCE_HASH = "42592487e6e07deb1b25a073d74086a09c1bb19cb38411aafc31d28ea64d2127";

const EFFECTIVE_PARAMETERS = Object.freeze({
  infiltrationCoefficient: 4.5,
  infiltrationExponent: 0.5, // Implemented with Math.sqrt, not a variable power.
  middleArrivalFactor: 0.5,
  qmaxPositiveSlopeCoefficient: 0.0063,
  qmaxZeroSlopeValue: 6.3,
});
const UNIT_CONVERSIONS = Object.freeze({ percentPerUnit: 100, secondsPerMinute: 60, mmPerMeter: 1000 });

function numeric(sqlColumn, unit, min, exclusiveMin = false, max) {
  return { type: "number", sqlColumn, unit, min, exclusiveMin, max };
}

const INPUT_CONTRACT = deepFreeze({
  crop: {
    etoMmPerDay: numeric("eto_mm_per_day", "mm/día", 0),
    cropCoefficient: numeric("crop_coefficient", "adimensional", 0),
    daysWithoutIrrigation: numeric("days_without_irrigation", "días", 0),
  },
  soil: {
    texture: { type: "text", sqlColumn: "texture", optional: true, maxLength: 64 },
    fieldCapacityPct: numeric("field_capacity_pct", "%", 0, true, 100),
    wiltingPointPct: numeric("wilting_point_pct", "%", 0),
    bulkDensityGcm3: numeric("bulk_density_g_cm3", "g/cm3", 0, true),
    rootDepthM: numeric("root_depth_m", "m", 0, true),
    depletionThresholdPct: numeric("depletion_threshold_pct", "%", 0, true, 100),
  },
  furrow: {
    widthM: numeric("width_m", "m", 0, true),
    lengthM: numeric("length_m", "m", 0, true),
    slopePct: numeric("slope_pct", "%", 0),
  },
  irrigation: {
    flowLps: numeric("flow_lps", "L/s", 0, true),
    durationMin: numeric("duration_min", "min", 0, true),
    advanceTimeMin: numeric("advance_time_min", "min", 0),
  },
});

const OUTPUT_CONTRACT = deepFreeze({
  waterNeed: { targetDepthMm: numeric("target_depth_mm", "mm", 0) },
  soilWater: {
    availableWaterMm: numeric("available_water_mm", "mm", 0, true),
    availableCapacityL: numeric("available_capacity_l", "L", 0, true),
    maxRecommendedDepthMm: numeric("max_recommended_depth_mm", "mm", 0, true),
    maxRecommendedVolumeL: numeric("max_recommended_volume_l", "L", 0, true),
  },
  application: {
    appliedVolumeL: numeric("applied_volume_l", "L", 0, true),
    infiltratedDepthStartMm: numeric("infiltrated_depth_start_mm", "mm", 0),
    infiltratedDepthMiddleMm: numeric("infiltrated_depth_middle_mm", "mm", 0),
    infiltratedDepthEndMm: numeric("infiltrated_depth_end_mm", "mm", 0),
    estimatedUsefulVolumeL: numeric("estimated_useful_volume_l", "L", 0),
    residualLossVolumeL: numeric("residual_loss_volume_l", "L", 0),
  },
  efficiency: {
    applicationEfficiencyPct: numeric("application_efficiency_pct", "%", 0, false, 100),
  },
  diagnostics: {
    advanceRatioPct: numeric("advance_ratio_pct", "%", 0, false, 100),
    maxNonErosiveFlowLps: numeric("max_non_erosive_flow_lps", "L/s", 0, true),
    items: { type: "diagnostics", sqlColumn: "diagnostics" },
  },
});

const ERROR_CODES = Object.freeze({
  INVALID_SHAPE: "INVALID_SHAPE",
  UNKNOWN_FIELD: "UNKNOWN_FIELD",
  MISSING_FIELD: "MISSING_FIELD",
  INVALID_TYPE: "INVALID_TYPE",
  NON_FINITE_NUMBER: "NON_FINITE_NUMBER",
  OUT_OF_RANGE: "OUT_OF_RANGE",
  INVALID_RELATIONSHIP: "INVALID_RELATIONSHIP",
  NON_FINITE_RESULT: "NON_FINITE_RESULT",
  MODEL_INCONSISTENCY: "MODEL_INCONSISTENCY",
  INVALID_DIAGNOSTIC: "INVALID_DIAGNOSTIC",
  FATAL_DIAGNOSTIC: "FATAL_DIAGNOSTIC",
  MODEL_NOT_IMPLEMENTED: "MODEL_NOT_IMPLEMENTED",
});
const DIAGNOSTIC_SEVERITIES = Object.freeze(["info", "warning", "error"]);

function unitsFor(contract) {
  return Object.fromEntries(Object.entries(contract).map(([group, fields]) => [
    group, Object.fromEntries(Object.entries(fields)
      .filter(([, definition]) => definition.unit)
      .map(([field, definition]) => [field, definition.unit])),
  ]));
}

const METADATA_TEMPLATE = deepFreeze({
  metadataSchemaVersion: METADATA_SCHEMA_VERSION,
  effectiveParameters: {
    infiltrationCoefficient: EFFECTIVE_PARAMETERS.infiltrationCoefficient,
    infiltrationExponent: EFFECTIVE_PARAMETERS.infiltrationExponent,
    middleArrivalFactor: EFFECTIVE_PARAMETERS.middleArrivalFactor,
    qmaxCoefficient: EFFECTIVE_PARAMETERS.qmaxPositiveSlopeCoefficient,
    qmaxZeroSlopeValue: EFFECTIVE_PARAMETERS.qmaxZeroSlopeValue,
    advanceRules: null,
  },
  units: {
    input: unitsFor(INPUT_CONTRACT), output: unitsFor(OUTPUT_CONTRACT),
    effectiveParameters: {
      infiltrationCoefficient: "mm/min^0.5", infiltrationExponent: "adimensional",
      middleArrivalFactor: "adimensional", qmaxCoefficient: "L/s (slope fraction operand)",
      qmaxZeroSlopeValue: "L/s",
    },
  },
  assumptions: {
    widthMeaning: "pending_validation",
    soilWaterContentBasis: "pending_validation",
    infiltrationCalibration: "none",
    advanceBands: "not_selected",
    etoAndKc: "constant_during_period",
    effectiveRain: "not_modeled",
    initialMoisture: "not_modeled",
    flow: "constant",
    infiltration: "spreadsheet_empirical_estimate",
    textureEffectOnInfiltration: "none",
    residualMeaning: "does_not_identify_loss_cause",
    efficiencyMeaning: "estimated_not_measured",
  },
  evidenceState: {
    calculationImplemented: true,
    scientificValidation: "not_validated",
    parametersSelected: true,
    diagnosticsEvaluated: true,
    modelKind: "estimation",
    source: "spreadsheet-derived",
    fieldCalibration: "none",
  },
  referenceVersions: { catalogVersion: null, calibrationVersion: null },
  implementationReference: { modelVersion: MODEL_VERSION, stage: "R3B_estimation", arithmetic: "IEEE-754_Number" },
  diagnosticRules: { ruleVersion: DIAGNOSTICS_RULE_VERSION, evaluated: ["P01", "P02", "P03", "P04", "P05"] },
  parameterProvenance: {
    infiltration: "Hoja 1!C14:C16; F04:F06; not calibrated",
    qmax: "Hoja 1!B9; F01; zero branch canonical 6.3; pending validation",
    soilWater: "Hoja 1!B24; F12; CC/PMP basis pending validation",
  },
});

// Only clones this internally defined, acyclic JSON template; no precision conversion.
function copyTemplate(value) {
  if (Array.isArray(value)) return value.map(copyTemplate);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, copyTemplate(child)]));
  }
  return value;
}

function createIrrigationMetadata() {
  return copyTemplate(METADATA_TEMPLATE);
}

module.exports = Object.freeze({
  MODEL_VERSION, CONTRACT_VERSION, METADATA_SCHEMA_VERSION, DIAGNOSTICS_RULE_VERSION,
  SOURCE_HASH, INPUT_CONTRACT, OUTPUT_CONTRACT, ERROR_CODES, DIAGNOSTIC_SEVERITIES,
  EFFECTIVE_PARAMETERS, UNIT_CONVERSIONS, METADATA_TEMPLATE, createIrrigationMetadata,
});
