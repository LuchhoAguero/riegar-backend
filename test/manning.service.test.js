const { test } = require("node:test");
const assert = require("node:assert/strict");
const { calculateManning, validateManningInput, ManningError } = require("../src/services/manning.service");

const base = { tipo_canal: "rectangular", b: 1, h: 0.5, z: 1, n: 0.012, S: 0.001 };
function close(actual, expected) {
  assert.ok(Math.abs(actual - expected) <= Math.max(1e-12, Math.abs(expected) * 1e-12));
}
function rejects(input, code = "invalid_input", field) {
  assert.throws(() => calculateManning(input), (error) => {
    assert.ok(error instanceof ManningError);
    assert.equal(error.code, code);
    if (field) assert.ok(error.fields[field]);
    return true;
  });
}

for (const [tipo_canal, A, P, Q_m3s] of [
  ["rectangular", 0.5, 2, 0.5228961337882106],
  ["triangular", 0.25, 1.4142135623730951, 0.20751146821137745],
  ["trapezoidal", 0.75, 2.414213562373095, 0.9065749945753862],
]) {
  test(`golden ${tipo_canal}: A/P/R/V/Q`, () => {
    const actual = calculateManning({ ...base, tipo_canal });
    for (const [field, expected] of Object.entries({ A, P, R: A / P, V: Q_m3s / A, Q_m3s })) {
      close(actual[field], expected);
      assert.ok(Number.isFinite(actual[field]) && actual[field] > 0);
    }
  });
}

for (const field of ["b", "h", "n", "S"]) {
  for (const value of [0, -1]) {
    test(`${field}=${value} rejected`, () => rejects({ ...base, [field]: value }, "invalid_input", field));
  }
}
for (const [tipo_canal, z] of [["triangular", -1], ["triangular", 0], ["trapezoidal", -1]]) {
  test(`${tipo_canal} z=${z} rejected`, () => rejects({ ...base, tipo_canal, z }, "invalid_input", "z"));
}
test("trapezoidal z=0 is rectangular geometry", () => {
  const result = calculateManning({ ...base, tipo_canal: "trapezoidal", z: 0 });
  close(result.A, 0.5); close(result.P, 2); close(result.Q_m3s, 0.5228961337882106);
});
test("unknown channel rejected", () => rejects({ ...base, tipo_canal: "circular" }));

for (const field of ["b", "h", "n", "S", "z"]) {
  test(`${field}: reject coercible, missing and non-finite values`, () => {
    for (const value of ["1", "0.012", "bad", "", true, false, null, [], {}, undefined, NaN, Infinity, -Infinity]) {
      rejects({ ...base, tipo_canal: "trapezoidal", [field]: value }, "invalid_input", field);
    }
  });
}
test("body must be an object", () => {
  for (const input of [undefined, null, [], true, false, 1, "input"]) rejects(input);
});
test("incomplete payload rejected", () => rejects({ tipo_canal: "rectangular" }));
test("irrelevant dimensions normalized, without validating unused client fields", () => {
  assert.equal(validateManningInput({ ...base, z: "unused" }).z, null);
  assert.equal(validateManningInput({ ...base, tipo_canal: "triangular", b: null }).b, null);
});
test("forged derivatives are ignored and input is not mutated", () => {
  const input = Object.freeze({ ...base, A: 999999, P: 1, R: null, V: Infinity, Q_m3s: 123456 });
  assert.deepEqual(calculateManning(input), calculateManning(base));
  assert.equal(input.Q_m3s, 123456);
});
for (const [label, changes] of [
  ["area overflow", { b: Number.MAX_VALUE, h: 2 }],
  ["area underflow", { b: Number.MIN_VALUE, h: Number.MIN_VALUE }],
  ["perimeter overflow", { h: Number.MAX_VALUE }],
  ["flow overflow", { n: Number.MIN_VALUE }],
  ["flow underflow", { b: 1e-150, h: 1e-150, S: Number.MIN_VALUE }],
  ["side slope overflow", { tipo_canal: "triangular", z: Number.MAX_VALUE }],
]) {
  test(`${label}: invalid_geometry instead of non-finite/zero result`, () => rejects({ ...base, ...changes }, "invalid_geometry"));
}
test("small positive parameters are not arbitrarily limited or rounded", () => {
  const result = calculateManning({ ...base, n: 0.01234, S: 0.0000001 });
  assert.equal(result.n, 0.01234);
  assert.equal(result.S, 0.0000001);
  assert.ok(Number.isFinite(result.Q_m3s) && result.Q_m3s > 0);
});
