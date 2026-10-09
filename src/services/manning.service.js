// Pure hydraulic validation and calculation. No storage or HTTP dependencies.
class ManningError extends Error {
  constructor(code, message, fields = {}) {
    super(message);
    this.name = "ManningError";
    this.code = code;
    this.fields = fields;
  }
}

function validateManningInput(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new ManningError("invalid_input", "El cálculo debe ser un objeto JSON.");
  }

  const { tipo_canal } = input;
  if (!["rectangular", "triangular", "trapezoidal"].includes(tipo_canal)) {
    throw new ManningError("invalid_input", "Tipo de canal inválido.", {
      tipo_canal: "Debe ser rectangular, triangular o trapezoidal.",
    });
  }

  const fields = {};
  const applicable = ["h", "n", "S"];
  if (tipo_canal !== "triangular") applicable.push("b");
  if (tipo_canal !== "rectangular") applicable.push("z");

  for (const field of applicable) {
    const value = input[field];
    const allowsZero = field === "z" && tipo_canal === "trapezoidal";
    if (typeof value !== "number" || !Number.isFinite(value)) {
      fields[field] = "Debe ser un número finito.";
    } else if (allowsZero ? value < 0 : value <= 0) {
      fields[field] = allowsZero
        ? "No puede ser negativo."
        : "Debe ser mayor a cero.";
    }
  }

  if (Object.keys(fields).length) {
    throw new ManningError("invalid_input", "Parámetros hidráulicos inválidos.", fields);
  }

  return {
    tipo_canal,
    b: tipo_canal === "triangular" ? null : input.b,
    h: input.h,
    z: tipo_canal === "rectangular" ? null : input.z,
    n: input.n,
    S: input.S,
  };
}

function calculateManning(input) {
  const params = validateManningInput(input);
  const { tipo_canal, b, h, z, n, S } = params;
  let A;
  let P;
  if (tipo_canal === "rectangular") {
    A = b * h;
    P = b + 2 * h;
  } else if (tipo_canal === "triangular") {
    A = z * h * h;
    P = 2 * h * Math.sqrt(1 + z * z);
  } else {
    A = b * h + z * h * h;
    P = b + 2 * h * Math.sqrt(1 + z * z);
  }

  const R = A / P;
  const Q_m3s = (1 / n) * A * Math.pow(R, 2 / 3) * Math.sqrt(S);
  const V = Q_m3s / A;
  const derived = { A, P, R, V, Q_m3s };
  if (Object.values(derived).some((value) => !Number.isFinite(value) || value <= 0)) {
    throw new ManningError(
      "invalid_geometry",
      "La geometría o los parámetros producen un resultado hidráulico no representable."
    );
  }

  return { ...params, ...derived };
}

module.exports = { ManningError, validateManningInput, calculateManning };
