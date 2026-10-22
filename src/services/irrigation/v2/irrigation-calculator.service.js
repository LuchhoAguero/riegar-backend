const {
  MODEL_VERSION, CONTRACT_VERSION, SOURCE_HASH, DIAGNOSTICS_RULE_VERSION, ERROR_CODES,
  EFFECTIVE_PARAMETERS: parameters, UNIT_CONVERSIONS: units, createIrrigationMetadata,
} = require("./irrigation-models");
const { validateIrrigationInput, validateIrrigationOutput } = require("./irrigation-validation");

function buildDiagnostics(input, output) {
  const items = [];
  function add(id, severity, fields, evidence, message) {
    items.push({ id, ruleVersion: DIAGNOSTICS_RULE_VERSION, severity, fields,
      evidence: { ...evidence, source: "R1_comparison", scientificValidation: "not_validated" }, message });
  }
  const target = output.waterNeed.targetDepthMm;
  const maximum = output.soilWater.maxRecommendedDepthMm;
  const qmax = output.diagnostics.maxNonErosiveFlowLps;
  if (input.irrigation.flowLps > qmax) {
    add("P01", "warning", ["irrigation.flowLps", "furrow.slopePct", "diagnostics.maxNonErosiveFlowLps"],
      { flowLps: input.irrigation.flowLps, slopePct: input.furrow.slopePct, maxNonErosiveFlowLps: qmax,
        operator: ">", units: { flowLps: "L/s", slopePct: "%", maxNonErosiveFlowLps: "L/s" } },
      "El caudal supera el máximo no erosivo estimado por la planilla; no demuestra erosión efectiva.");
  }
  if (output.application.infiltratedDepthEndMm < target) {
    add("P02", "warning", ["application.infiltratedDepthEndMm", "waterNeed.targetDepthMm"],
      { infiltratedDepthEndMm: output.application.infiltratedDepthEndMm, targetDepthMm: target, operator: "<", unit: "mm" },
      "La lámina estimada al final es menor que la necesidad acumulada simplificada; no es un déficit medido.");
  }
  const points = [
    ["start", "infiltratedDepthStartMm"], ["middle", "infiltratedDepthMiddleMm"], ["end", "infiltratedDepthEndMm"],
  ];
  for (const [point, field] of points) {
    if (output.application[field] > target) {
      add("P03", "info", [`application.${field}`, "waterNeed.targetDepthMm"],
        { point, infiltratedDepthMm: output.application[field], targetDepthMm: target, operator: ">", unit: "mm" },
        "La infiltración estimada supera la necesidad simplificada en este punto; no demuestra pérdida profunda.");
    }
  }
  if (target > maximum) {
    add("P04", "warning", ["waterNeed.targetDepthMm", "soilWater.maxRecommendedDepthMm"],
      { targetDepthMm: target, maxRecommendedDepthMm: maximum, operator: ">", unit: "mm" },
      "La necesidad acumulada simplificada supera la lámina máxima estimada según el umbral seleccionado.");
  }
  for (const [point, field] of points) {
    if (output.application[field] > maximum) {
      add("P05", "warning", [`application.${field}`, "soilWater.maxRecommendedDepthMm"],
        { point, infiltratedDepthMm: output.application[field], maxRecommendedDepthMm: maximum, operator: ">", unit: "mm" },
        "La infiltración estimada supera la lámina del umbral en este punto; no demuestra percolación profunda.");
    }
  }
  return items;
}

// Spreadsheet-derived estimation only. No IO, rounding or physical normalization.
// Expected errors are results; unexpected programming errors propagate.
function calculateIrrigationSimulation(input) {
  const validation = validateIrrigationInput(input);
  if (!validation.ok) return validation;
  const snapshot = validation.input;
  const { crop, soil, furrow, irrigation } = snapshot;
  const targetDepthMm = crop.etoMmPerDay * crop.cropCoefficient * crop.daysWithoutIrrigation;
  const availableWaterMm = ((soil.fieldCapacityPct - soil.wiltingPointPct) / units.percentPerUnit)
    * soil.bulkDensityGcm3 * soil.rootDepthM * units.mmPerMeter;
  const availableCapacityL = availableWaterMm * furrow.furrowSpacingM * furrow.lengthM;
  const maxRecommendedDepthMm = availableWaterMm * (soil.depletionThresholdPct / units.percentPerUnit);
  const maxRecommendedVolumeL = maxRecommendedDepthMm * furrow.furrowSpacingM * furrow.lengthM;
  const appliedVolumeL = irrigation.flowLps * irrigation.durationMin * units.secondsPerMinute;
  const advanceRatioPct = units.percentPerUnit * irrigation.advanceTimeMin / irrigation.durationMin;
  const maxNonErosiveFlowLps = furrow.slopePct === 0 ? parameters.qmaxZeroSlopeValue
    : parameters.qmaxPositiveSlopeCoefficient / (furrow.slopePct / units.percentPerUnit);
  const opportunityStartMin = irrigation.durationMin;
  const opportunityMiddleMin = irrigation.durationMin - irrigation.advanceTimeMin * parameters.middleArrivalFactor;
  const opportunityEndMin = irrigation.durationMin - irrigation.advanceTimeMin;
  const infiltratedDepthStartMm = parameters.infiltrationCoefficient * Math.sqrt(opportunityStartMin);
  const infiltratedDepthMiddleMm = parameters.infiltrationCoefficient * Math.sqrt(opportunityMiddleMin);
  const infiltratedDepthEndMm = parameters.infiltrationCoefficient * Math.sqrt(opportunityEndMin);
  const estimatedUsefulVolumeL = infiltratedDepthMiddleMm * furrow.furrowSpacingM * furrow.lengthM;
  const residualLossVolumeL = appliedVolumeL - estimatedUsefulVolumeL;
  const applicationEfficiencyPct = units.percentPerUnit * estimatedUsefulVolumeL / appliedVolumeL;
  const dailyCropWaterUseMmPerDay = crop.etoMmPerDay * crop.cropCoefficient;
  // No division for zero use. The guard below distinguishes positive underflow.
  const daysUntilAvailableWaterExhaustion = dailyCropWaterUseMmPerDay > 0
    ? availableWaterMm / dailyCropWaterUseMmPerDay : null;
  const daysUntilDepletionThreshold = dailyCropWaterUseMmPerDay > 0
    ? maxRecommendedDepthMm / dailyCropWaterUseMmPerDay : null;
  const totalAppliedVolumeL = appliedVolumeL * furrow.furrowCount;
  const totalAppliedVolumeM3 = totalAppliedVolumeL / units.litersPerCubicMeter;
  const output = {
    waterNeed: { targetDepthMm, dailyCropWaterUseMmPerDay },
    soilWater: { availableWaterMm, availableCapacityL, maxRecommendedDepthMm, maxRecommendedVolumeL,
      daysUntilAvailableWaterExhaustion, daysUntilDepletionThreshold },
    application: { appliedVolumeL, infiltratedDepthStartMm, infiltratedDepthMiddleMm, infiltratedDepthEndMm,
      estimatedUsefulVolumeL, residualLossVolumeL },
    totals: { totalAppliedVolumeL, totalAppliedVolumeM3 },
    efficiency: { applicationEfficiencyPct },
    diagnostics: { advanceRatioPct, maxNonErosiveFlowLps, items: [] },
  };
  // Reject invalid magnitudes before constructing any diagnostic evidence.
  const consistency = validateIrrigationOutput(output);
  if (crop.etoMmPerDay > 0 && crop.cropCoefficient > 0 && dailyCropWaterUseMmPerDay === 0) {
    const errors = consistency.ok ? [] : consistency.errors;
    errors.push({ code: ERROR_CODES.MODEL_INCONSISTENCY, category: "consistency",
      field: "output.waterNeed.dailyCropWaterUseMmPerDay", rule: "positive_daily_use_representable",
      expected: "> 0 when ETo and Kc are positive", received: dailyCropWaterUseMmPerDay,
      message: "El consumo positivo no es representable; no se interpreta como consumo nulo." });
    return { ok: false, errors };
  }
  if (!consistency.ok) return consistency;
  output.diagnostics.items = buildDiagnostics(snapshot, output);
  const checked = validateIrrigationOutput(output);
  if (!checked.ok) return checked;
  return {
    ok: true, modelVersion: MODEL_VERSION, contractVersion: CONTRACT_VERSION, sourceHash: SOURCE_HASH,
    input: snapshot, output: checked.output, metadata: createIrrigationMetadata(),
  };
}

module.exports = { calculateIrrigationSimulation };
