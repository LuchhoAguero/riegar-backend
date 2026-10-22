// GV2-01 literal reference from the approved R4F-B specification. No calculator imports.
module.exports = {
  "id": "GV2-01",
  "input": {
    "crop": {
      "etoMmPerDay": 5,
      "cropCoefficient": 0.7,
      "daysWithoutIrrigation": 20
    },
    "soil": {
      "texture": "Franco",
      "fieldCapacityPct": 20,
      "wiltingPointPct": 10,
      "bulkDensityGcm3": 1.3,
      "rootDepthM": 0.7,
      "depletionThresholdPct": 60
    },
    "furrow": {
      "furrowSpacingM": 1.3,
      "lengthM": 60,
      "slopePct": 0,
      "furrowCount": 18
    },
    "irrigation": {
      "flowLps": 0.9,
      "durationMin": 120,
      "advanceTimeMin": 20
    }
  },
  "output": {
    "waterNeed": {
      "targetDepthMm": 70,
      "dailyCropWaterUseMmPerDay": 3.5
    },
    "soilWater": {
      "availableWaterMm": 91,
      "availableCapacityL": 7098,
      "maxRecommendedDepthMm": 54.6,
      "maxRecommendedVolumeL": 4258.8,
      "daysUntilAvailableWaterExhaustion": 26,
      "daysUntilDepletionThreshold": 15.6
    },
    "application": {
      "appliedVolumeL": 6480,
      "infiltratedDepthStartMm": 49.29503017546495,
      "infiltratedDepthMiddleMm": 47.19639816765682,
      "infiltratedDepthEndMm": 45,
      "estimatedUsefulVolumeL": 3681.3190570772317,
      "residualLossVolumeL": 2798.6809429227683
    },
    "totals": {
      "totalAppliedVolumeL": 116640,
      "totalAppliedVolumeM3": 116.64
    },
    "efficiency": {
      "applicationEfficiencyPct": 56.8104792758832
    },
    "diagnostics": {
      "advanceRatioPct": 16.666666666666668,
      "maxNonErosiveFlowLps": 6.3,
      "items": [
        {
          "id": "P02",
          "ruleVersion": "irrigation-diagnostics-v1",
          "severity": "warning",
          "fields": [
            "application.infiltratedDepthEndMm",
            "waterNeed.targetDepthMm"
          ],
          "evidence": {
            "infiltratedDepthEndMm": 45,
            "targetDepthMm": 70,
            "operator": "<",
            "unit": "mm",
            "source": "R1_comparison",
            "scientificValidation": "not_validated"
          },
          "message": "La lámina estimada al final es menor que la necesidad acumulada simplificada; no es un déficit medido."
        },
        {
          "id": "P04",
          "ruleVersion": "irrigation-diagnostics-v1",
          "severity": "warning",
          "fields": [
            "waterNeed.targetDepthMm",
            "soilWater.maxRecommendedDepthMm"
          ],
          "evidence": {
            "targetDepthMm": 70,
            "maxRecommendedDepthMm": 54.6,
            "operator": ">",
            "unit": "mm",
            "source": "R1_comparison",
            "scientificValidation": "not_validated"
          },
          "message": "La necesidad acumulada simplificada supera la lámina máxima estimada según el umbral seleccionado."
        }
      ]
    }
  },
  "metadata": {
    "metadataSchemaVersion": "irrigation-metadata-v2",
    "effectiveParameters": {
      "infiltrationCoefficient": 4.5,
      "infiltrationExponent": 0.5,
      "middleArrivalFactor": 0.5,
      "qmaxCoefficient": 0.0063,
      "qmaxZeroSlopeValue": 6.3,
      "advanceRules": null
    },
    "units": {
      "input": {
        "crop": {
          "etoMmPerDay": "mm/día",
          "cropCoefficient": "adimensional",
          "daysWithoutIrrigation": "días"
        },
        "soil": {
          "fieldCapacityPct": "%",
          "wiltingPointPct": "%",
          "bulkDensityGcm3": "g/cm3",
          "rootDepthM": "m",
          "depletionThresholdPct": "%"
        },
        "furrow": {
          "furrowSpacingM": "m",
          "lengthM": "m",
          "slopePct": "%",
          "furrowCount": "surcos"
        },
        "irrigation": {
          "flowLps": "L/s",
          "durationMin": "min",
          "advanceTimeMin": "min"
        }
      },
      "output": {
        "waterNeed": {
          "targetDepthMm": "mm",
          "dailyCropWaterUseMmPerDay": "mm/día"
        },
        "soilWater": {
          "availableWaterMm": "mm",
          "availableCapacityL": "L",
          "maxRecommendedDepthMm": "mm",
          "maxRecommendedVolumeL": "L",
          "daysUntilAvailableWaterExhaustion": "días",
          "daysUntilDepletionThreshold": "días"
        },
        "application": {
          "appliedVolumeL": "L",
          "infiltratedDepthStartMm": "mm",
          "infiltratedDepthMiddleMm": "mm",
          "infiltratedDepthEndMm": "mm",
          "estimatedUsefulVolumeL": "L",
          "residualLossVolumeL": "L"
        },
        "totals": {
          "totalAppliedVolumeL": "L",
          "totalAppliedVolumeM3": "m3"
        },
        "efficiency": {
          "applicationEfficiencyPct": "%"
        },
        "diagnostics": {
          "advanceRatioPct": "%",
          "maxNonErosiveFlowLps": "L/s"
        }
      },
      "effectiveParameters": {
        "infiltrationCoefficient": "mm/min^0.5",
        "infiltrationExponent": "adimensional",
        "middleArrivalFactor": "adimensional",
        "qmaxCoefficient": "L/s (slope fraction operand)",
        "qmaxZeroSlopeValue": "L/s"
      }
    },
    "assumptions": {
      "soilWaterContentBasis": "gravimetric_dry_weight",
      "furrowSpacingMeaning": "distance_between_furrows",
      "furrowSpacingUsage": "simplified_tributary_width",
      "furrowCountMeaning": "number_of_furrows_irrigated",
      "furrowRepresentativeness": "uniform_per_furrow_scenario",
      "totalAppliedVolumeScope": "per_furrow_applied_volume_times_furrow_count",
      "infiltrationCoefficientOrigin": "undocumented_legacy_spreadsheet",
      "infiltrationCalibration": "none",
      "advanceBands": "not_selected",
      "etoAndKc": "constant_during_period",
      "effectiveRain": "not_modeled",
      "initialMoisture": "not_modeled",
      "flow": "constant",
      "infiltration": "spreadsheet_empirical_estimate",
      "textureEffectOnInfiltration": "none",
      "residualMeaning": "does_not_identify_loss_cause",
      "efficiencyMeaning": "estimated_not_measured",
      "daysReferenceState": "field_capacity_reference",
      "daysMeaning": "reference_reserve_duration_not_remaining_days_from_now",
      "zeroDailyUsePolicy": "null_days_not_applicable_zero_daily_use"
    },
    "evidenceState": {
      "calculationImplemented": true,
      "scientificValidation": "not_validated",
      "parametersSelected": true,
      "diagnosticsEvaluated": true,
      "modelKind": "estimation",
      "source": "spreadsheet-derived",
      "fieldCalibration": "none"
    },
    "referenceVersions": {
      "catalogVersion": null,
      "calibrationVersion": null
    },
    "implementationReference": {
      "modelVersion": "irrigation-estimation-v2",
      "stage": "R4F_v2_estimation",
      "arithmetic": "IEEE-754_Number"
    },
    "diagnosticRules": {
      "ruleVersion": "irrigation-diagnostics-v1",
      "evaluated": [
        "P01",
        "P02",
        "P03",
        "P04",
        "P05"
      ]
    },
    "parameterProvenance": {
      "infiltration": "Hoja 1!C14:C16; F04:F06; undocumented legacy coefficient; not calibrated",
      "qmax": "Hoja 1!B9; F01; canonical zero 6.3; not scientifically validated",
      "soilWater": "Hoja 1!B24; F12; latest client confirmation: gravimetric dry weight",
      "spacing": "latest client confirmation; simplified tributary width assumption",
      "dailyUse": "Hoja 1!E18; F18",
      "exhaustionDays": "Hoja 1!E19; F19; reference reserve assumption",
      "thresholdDays": "latest client confirmation L; F20; absent from XLSX formulas",
      "totalApplied": "Hoja 1!B30:B32; F21:F22; representative per-furrow scenario"
    }
  },
  "modelVersion": "irrigation-estimation-v2",
  "contractVersion": "irrigation-contract-v2",
  "sourceHash": "30b031d7bd3aa4365c65b6750a91a4004db4ef3452c99bf3924698b89f9dec3b"
};
