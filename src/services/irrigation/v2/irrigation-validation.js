const {
  INPUT_CONTRACT, OUTPUT_CONTRACT, ERROR_CODES, DIAGNOSTIC_SEVERITIES,
} = require("./irrigation-models");

function issue(errors, code, field, rule, expected, message, category, value) {
  const error = { code, field, rule, expected, message, category };
  // Do not echo arbitrary text, objects, functions, secrets or non-finite numbers.
  if (value === null || typeof value === "boolean" ||
      (typeof value === "number" && Number.isFinite(value))) error.received = value;
  errors.push(error);
}

function isPlainObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function isDataArray(value) {
  if (!Array.isArray(value)) return false;
  const keys = Reflect.ownKeys(value);
  if (keys.length !== value.length + 1) return false;
  for (let index = 0; index < value.length; index++) {
    const descriptor = Object.getOwnPropertyDescriptor(value, index);
    if (!descriptor || !Object.hasOwn(descriptor, "value")) return false;
  }
  return true;
}

function shape(value, allowed, field, errors, category) {
  if (!isPlainObject(value)) {
    issue(errors, ERROR_CODES.INVALID_SHAPE, field, "plain_object", "plain object",
      "Debe ser un objeto de datos del contrato.", category);
    return false;
  }
  let dataOnly = true;
  for (const key of Reflect.ownKeys(value)) {
    const path = typeof key === "string" ? `${field}.${key}` : field;
    if (typeof key !== "string" || !allowed.includes(key)) {
      issue(errors, ERROR_CODES.UNKNOWN_FIELD, path, "known_fields_only", allowed.join(", "),
        "Campo fuera del contrato canónico.", category);
    }
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!Object.hasOwn(descriptor, "value")) {
      issue(errors, ERROR_CODES.INVALID_SHAPE, path, "data_properties_only", "data property",
        "No se admiten getters o setters en el contrato.", category);
      dataOnly = false;
    }
  }
  return dataOnly;
}

function numberValue(value, definition, field, errors, category) {
  if (value === null && definition.nullable) return;
  if (typeof value !== "number") {
    issue(errors, value === undefined ? ERROR_CODES.MISSING_FIELD : ERROR_CODES.INVALID_TYPE,
      field, "finite_number", "finite number", "Debe ser un número finito sin coerción.", category, value);
    return;
  }
  if (!Number.isFinite(value)) {
    issue(errors, category === "validation" ? ERROR_CODES.NON_FINITE_NUMBER : ERROR_CODES.NON_FINITE_RESULT,
      field, "finite_number", "finite number", "El valor no es representable como número finito.", category);
    return;
  }
  if (definition.integer) {
    if (!Number.isSafeInteger(value) || value < definition.min || value > definition.max) {
      issue(errors, ERROR_CODES.OUT_OF_RANGE, field, "positive_safe_integer", "integer 1..9007199254740991",
        "Debe ser un entero seguro positivo sin coerción.", category, value);
    }
    return;
  }
  const belowMin = definition.exclusiveMin ? value <= definition.min : value < definition.min;
  if (belowMin || (definition.max !== undefined && value > definition.max)) {
    issue(errors, category === "validation" ? ERROR_CODES.OUT_OF_RANGE : ERROR_CODES.MODEL_INCONSISTENCY,
      field, "structural_domain", `${definition.exclusiveMin ? ">" : ">="} ${definition.min}` +
      (definition.max === undefined ? "" : `; <= ${definition.max}`),
      "No cumple el dominio estructural; no se normaliza ni recorta.", category, value);
  }
}

function cloneEvidence(value, field, errors, ancestors = new Set()) {
  if (value === null || typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if ((!isDataArray(value) && !isPlainObject(value)) || ancestors.has(value)) {
    issue(errors, ERROR_CODES.INVALID_DIAGNOSTIC, field, "finite_acyclic_json", "acyclic JSON data",
      "La evidencia debe ser JSON sin ciclos ni valores no finitos.", "consistency");
    return undefined;
  }
  ancestors.add(value);
  const copy = Array.isArray(value) ? [] : {};
  for (const key of Reflect.ownKeys(value)) {
    if (Array.isArray(value) && key === "length") continue;
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (typeof key !== "string" || !Object.hasOwn(descriptor, "value")) {
      issue(errors, ERROR_CODES.INVALID_DIAGNOSTIC, field, "data_properties_only", "JSON data properties",
        "La evidencia no admite símbolos ni accesores.", "consistency");
      continue;
    }
    Object.defineProperty(copy, key, {
      value: cloneEvidence(descriptor.value, `${field}.${key}`, errors, ancestors),
      enumerable: true, writable: true, configurable: true,
    });
  }
  ancestors.delete(value);
  return copy;
}

function diagnosticsValue(items, field, errors) {
  if (!isDataArray(items)) {
    issue(errors, ERROR_CODES.INVALID_DIAGNOSTIC, field, "diagnostic_array", "array",
      "Los diagnósticos deben ser un array evaluado.", "consistency");
    return [];
  }
  return Array.from(items, (item, index) => {
    const path = `${field}[${index}]`;
    if (!shape(item, ["id", "ruleVersion", "severity", "fields", "evidence", "message"], path, errors, "consistency")) return null;
    for (const key of ["id", "ruleVersion"]) {
      if (typeof item[key] !== "string" || !item[key].trim()) {
        issue(errors, ERROR_CODES.INVALID_DIAGNOSTIC, `${path}.${key}`, "nonempty_identifier", "nonempty string",
          "Se requiere un identificador estable no vacío.", "consistency");
      }
    }
    if (!DIAGNOSTIC_SEVERITIES.includes(item.severity)) {
      issue(errors, ERROR_CODES.INVALID_DIAGNOSTIC, `${path}.severity`, "diagnostic_severity", "info, warning, error",
        "Severidad desconocida.", "consistency");
    } else if (item.severity === "error") {
      issue(errors, ERROR_CODES.FATAL_DIAGNOSTIC, `${path}.severity`, "no_fatal_diagnostic_in_success", "info or warning",
        "Un error fatal no puede acompañar una simulación persistible.", "consistency");
    }
    if (!isDataArray(item.fields) || item.fields.some(value => typeof value !== "string" || !value.trim())) {
      issue(errors, ERROR_CODES.INVALID_DIAGNOSTIC, `${path}.fields`, "field_paths", "array of nonempty strings",
        "Se requieren rutas de campos afectados.", "consistency");
    }
    if (!isPlainObject(item.evidence)) {
      issue(errors, ERROR_CODES.INVALID_DIAGNOSTIC, `${path}.evidence`, "evidence_object", "JSON object",
        "Se requiere un objeto de evidencia.", "consistency");
    }
    if (item.message !== undefined && typeof item.message !== "string") {
      issue(errors, ERROR_CODES.INVALID_DIAGNOSTIC, `${path}.message`, "optional_text", "string or absent",
        "El mensaje de presentación debe ser texto.", "consistency");
    }
    return {
      id: item.id, ruleVersion: item.ruleVersion, severity: item.severity,
      fields: isDataArray(item.fields) ? [...item.fields] : [],
      evidence: cloneEvidence(item.evidence, `${path}.evidence`, errors),
      ...(item.message === undefined ? {} : { message: item.message }),
    };
  });
}

function validateData(value, contract, root, category) {
  const errors = [], copy = {};
  if (!shape(value, Object.keys(contract), root, errors, category)) return { errors, copy };
  for (const [group, definitions] of Object.entries(contract)) {
    const field = `${root}.${group}`;
    const source = Object.hasOwn(value, group) ? value[group] : undefined;
    if (!shape(source, Object.keys(definitions), field, errors, category)) continue;
    copy[group] = {};
    for (const [key, definition] of Object.entries(definitions)) {
      const path = `${field}.${key}`, received = Object.hasOwn(source, key) ? source[key] : undefined;
      if (definition.type === "number") {
        numberValue(received, definition, path, errors, category);
        copy[group][key] = received;
      } else if (definition.type === "text") {
        if (received === null || received === undefined) copy[group][key] = null;
        else if (typeof received !== "string") {
          issue(errors, ERROR_CODES.INVALID_TYPE, path, "optional_texture", "string, null or absent",
            "La textura es descriptiva y debe ser texto.", category);
        } else {
          const text = received.trim();
          if (!text || [...text].length > definition.maxLength) {
            issue(errors, ERROR_CODES.OUT_OF_RANGE, path, "texture_length", `1..${definition.maxLength} characters`,
              "La textura no puede estar vacía ni exceder la capacidad de persistencia.", category);
          }
          copy[group][key] = text;
        }
      } else copy[group][key] = diagnosticsValue(received, path, errors);
    }
  }
  return { errors, copy };
}

function finite(value) { return typeof value === "number" && Number.isFinite(value); }

function validateIrrigationInput(input) {
  const { errors, copy } = validateData(input, INPUT_CONTRACT, "input", "validation");
  if (finite(copy.soil?.fieldCapacityPct) && finite(copy.soil?.wiltingPointPct) &&
      copy.soil.fieldCapacityPct <= copy.soil.wiltingPointPct) {
    issue(errors, ERROR_CODES.INVALID_RELATIONSHIP, "input.soil.fieldCapacityPct", "CC_greater_than_PMP",
      "> soil.wiltingPointPct", "La capacidad de campo debe superar el PMP.", "validation", copy.soil.fieldCapacityPct);
  }
  if (finite(copy.irrigation?.advanceTimeMin) && finite(copy.irrigation?.durationMin) &&
      copy.irrigation.advanceTimeMin > copy.irrigation.durationMin) {
    issue(errors, ERROR_CODES.INVALID_RELATIONSHIP, "input.irrigation.advanceTimeMin", "advance_within_duration",
      "<= irrigation.durationMin", "El avance no puede superar la duración del riego.", "validation", copy.irrigation.advanceTimeMin);
  }
  return errors.length ? { ok: false, errors } : { ok: true, input: copy };
}

function validateIrrigationOutput(output) {
  const { errors, copy } = validateData(output, OUTPUT_CONTRACT, "output", "consistency");
  const daily = copy.waterNeed?.dailyCropWaterUseMmPerDay;
  if (finite(daily) && daily >= 0) {
    for (const field of ["daysUntilAvailableWaterExhaustion", "daysUntilDepletionThreshold"]) {
      const value = copy.soilWater?.[field];
      if ((daily === 0 && value !== null) || (daily > 0 && value === null)) {
        issue(errors, ERROR_CODES.MODEL_INCONSISTENCY, `output.soilWater.${field}`, "days_match_daily_use",
          daily === 0 ? "null when daily use is zero" : "positive finite number when daily use is positive",
          "El plazo debe corresponder al consumo diario; no se sustituye ni se omite.", "consistency", value);
      }
    }
  }
  if (finite(copy.application?.estimatedUsefulVolumeL) && finite(copy.application?.appliedVolumeL) &&
      copy.application.estimatedUsefulVolumeL > copy.application.appliedVolumeL) {
    issue(errors, ERROR_CODES.MODEL_INCONSISTENCY, "output.application.estimatedUsefulVolumeL", "useful_not_above_applied",
      "<= application.appliedVolumeL", "El aprovechamiento estimado supera el agua aplicada.", "consistency", copy.application.estimatedUsefulVolumeL);
  }
  return errors.length ? { ok: false, errors } : { ok: true, output: copy };
}

module.exports = { validateIrrigationInput, validateIrrigationOutput };
