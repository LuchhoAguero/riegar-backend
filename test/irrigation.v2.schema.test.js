const { test } = require("node:test");
const assert = require("node:assert/strict");
const knex = require("knex");
const migration = require("../db/migrations/20261014000000_extend_irrigation_simulations_v2");
const original = require("../db/migrations/20261012000000_create_irrigation_simulations");

const columns = ["furrow_count", "daily_crop_water_use_mm_per_day",
  "days_until_available_water_exhaustion", "days_until_depletion_threshold",
  "total_applied_volume_l", "total_applied_volume_m3"];
const names = ["irr_sim_version_pair_ck", "irr_sim_v1_extension_ck",
  "irr_sim_v2_extension_ck", "irr_sim_v2_days_ck"];

// Small SQL three-valued interpreter for the actual captured predicates, not a
// second copy of the constraints. null represents UNKNOWN; CHECK rejects false.
function predicate(sql) {
  const tokens = [];
  const lexer = /\s*(>=|<=|=|>|<|\(|\)|'[^']*'|[A-Za-z_]\w*|\d+(?:\.\d+)?)/gy;
  let offset = 0;
  while (offset < sql.length) {
    lexer.lastIndex = offset;
    const match = lexer.exec(sql);
    assert.ok(match, `unsupported SQL at ${sql.slice(offset)}`);
    tokens.push(match[1]); offset = lexer.lastIndex;
  }
  let i = 0;
  const take = (word) => { if (tokens[i] === word) { i++; return true; } return false; };
  const need = (word) => assert.ok(take(word), `expected ${word}, got ${tokens[i]}`);
  const and = (a, b) => a === false || b === false ? false : a === null || b === null ? null : true;
  const or = (a, b) => a === true || b === true ? true : a === null || b === null ? null : false;
  function value() {
    if (take("CAST")) {
      need("("); const v = value(); need("AS"); need("BINARY"); need(")"); return v;
    }
    const token = tokens[i++];
    if (token.startsWith("'")) return () => token.slice(1, -1);
    if (/^\d/.test(token)) return () => token.includes(".") ? Number(token) : BigInt(token);
    return (row) => row[token] ?? null;
  }
  function atom() {
    if (take("NOT")) { const a = atom(); return (r) => a(r) === null ? null : !a(r); }
    if (take("(")) { const a = expression(); need(")"); return a; }
    const a = value();
    if (take("IS")) {
      const not = take("NOT"); need("NULL"); return (r) => not ? a(r) !== null : a(r) === null;
    }
    const op = tokens[i++], b = value();
    assert.ok(["=", ">", ">=", "<", "<="].includes(op));
    return (r) => {
      const x = a(r), y = b(r);
      if (x === null || y === null) return null;
      // Numeric equality accepts Number/BigInt; string equality remains exact.
      if (op === "=") return typeof x === "string" || typeof y === "string" ? x === y : x == y;
      if (op === ">") return x > y;
      if (op === ">=") return x >= y;
      if (op === "<") return x < y;
      return x <= y;
    };
  }
  function conjunction() {
    let a = atom();
    while (take("AND")) { const left = a, b = atom(); a = (r) => and(left(r), b(r)); }
    return a;
  }
  function expression() {
    let a = conjunction();
    while (take("OR")) { const left = a, b = conjunction(); a = (r) => or(left(r), b(r)); }
    return a;
  }
  const result = expression(); assert.equal(i, tokens.length); return result;
}

async function harness(extended = false, data = []) {
  const compiler = knex({ client: "mysql2" }); // No connection configuration.
  const originalSQL = [];
  original.up({ schema: { createTable(name, callback) {
    originalSQL.push(...compiler.schema.createTable(name, callback).toSQL().map((s) => s.sql));
  } } });
  const schemaRows = [
    ...[...originalSQL[0].matchAll(/`(\w+)` (?:int|varchar|double|char|json|datetime)/g)]
      .map((m) => ({ kind: "column", name: m[1] })),
    ...[...originalSQL[0].matchAll(/constraint (\w+) check/g)]
      .map((m) => ({ kind: "check", name: m[1] })),
  ];
  if (extended) schemaRows.push(...columns.map((name) => ({ kind: "column", name })),
    ...names.map((name) => ({ kind: "check", name })));
  const sql = [], checks = {}, events = [], queries = [];
  const db = {
    async raw(query, bindings) {
      events.push("read"); queries.push({ query, bindings });
      if (query.includes("INFORMATION_SCHEMA")) return [schemaRows, []];
      const where = query.split(" WHERE ")[1].replace(/ LIMIT 1$/, "");
      return [data.some((r) => predicate(where)(r) === true) ? [{ blocked: 1 }] : [], []];
    },
    schema: { alterTable(name, callback) {
      events.push("ddl");
      const statements = compiler.schema.alterTable(name, (table) => {
        const check = table.check.bind(table);
        table.check = (expr, bindings, constraint) => {
          checks[constraint] = expr; return check(expr, bindings, constraint);
        };
        callback(table);
      }).toSQL();
      sql.push(...statements.map((s) => s.sql));
      return Promise.resolve();
    } },
  };
  return { db, sql, checks, events, queries, schemaRows, originalSQL, close: () => compiler.destroy() };
}

const pair = (v) => ({ contract_version: `irrigation-contract-v${v}`, model_version: `irrigation-estimation-v${v}` });
const v1 = () => ({ ...pair(1), ...Object.fromEntries(columns.map((c) => [c, null])) });
const v2 = () => ({ ...pair(2), furrow_count: 18, daily_crop_water_use_mm_per_day: 3.5,
  days_until_available_water_exhaustion: 26, days_until_depletion_threshold: 15.6,
  total_applied_volume_l: 116640, total_applied_volume_m3: 116.64 });

test("UP compiles six nullable columns then four exact checks, preserving original schema", async () => {
  const h = await harness();
  try {
    assert.equal(h.schemaRows.filter((r) => r.kind === "column").length, 38);
    assert.equal(h.schemaRows.filter((r) => r.kind === "check").length, 10);
    await migration.up(h.db);
    assert.deepEqual(h.events, ["read", "ddl", "ddl"]);
    assert.equal(h.sql.length, 5);
    assert.equal((h.sql[0].match(/add `/g) || []).length, 6);
    columns.forEach((c, i) => assert.ok(h.sql[0].includes(`add \`${c}\` ${i === 0 ? "bigint unsigned" : "double"} null`)));
    assert.doesNotMatch(h.sql.join(" "), /default|update |insert |rename|furrow_spacing_m|modify |drop |if not exists/i);
    assert.deepEqual(Object.keys(h.checks), names);
    assert.match(h.checks[names[0]], /CAST\(contract_version AS BINARY\)/);
    assert.match(h.checks[names[0]], /CAST\(model_version AS BINARY\)/);
    assert.match(h.checks[names[2]], /furrow_count <= 9007199254740991/);
    assert.doesNotMatch(Object.values(h.checks).join(" "), /source_hash|JSON|\*|\//);
    assert.match(h.originalSQL.join(" "), /datetime\(3\).*JSON_TYPE/s);
    assert.match(h.originalSQL.join(" "), /on update RESTRICT on delete RESTRICT/);
    assert.equal(migration.config.transaction, false);
    assert.deepEqual(h.queries[0].bindings, ["irrigation_simulations", "irrigation_simulations"]);
  } finally { await h.close(); }
});

test("CHECK interpreter distinguishes SQL UNKNOWN from false", () => {
  assert.equal(predicate("x > 0")({ x: null }), null);
  assert.equal(predicate("x IS NOT NULL AND x > 0")({ x: null }), false);
  assert.equal(predicate("x IS NULL OR x > 0")({ x: null }), true);
});

test("CHECK matrix: version pairs, V1 isolation, V2 presence/range and zero/positive days", async () => {
  const h = await harness();
  try {
    await migration.up(h.db);
    const predicates = Object.values(h.checks).map(predicate);
    const accepts = (row) => predicates.every((p) => p(row) !== false);
    for (const row of [v1(), v2(), { ...v2(), furrow_count: 9007199254740991n },
      { ...v2(), daily_crop_water_use_mm_per_day: 0, days_until_available_water_exhaustion: null, days_until_depletion_threshold: null }]) {
      assert.equal(accepts(row), true, JSON.stringify(row, (_, v) => typeof v === "bigint" ? String(v) : v));
    }
    for (const column of columns) assert.equal(accepts({ ...v1(), [column]: 1 }), false, column);
    const invalid = [
      ...[null, 0, -1, 9007199254740992n].map((n) => ({ furrow_count: n })),
      ...[null, -1].map((n) => ({ daily_crop_water_use_mm_per_day: n })),
      ...["total_applied_volume_l", "total_applied_volume_m3"].flatMap((c) => [null, 0, -1].map((n) => ({ [c]: n }))),
      { daily_crop_water_use_mm_per_day: 0 },
      ...["days_until_available_water_exhaustion", "days_until_depletion_threshold"].flatMap((c) => [null, 0, -1].map((n) => ({ [c]: n }))),
      { days_until_available_water_exhaustion: null, days_until_depletion_threshold: null },
      { daily_crop_water_use_mm_per_day: 0, days_until_available_water_exhaustion: null },
      { daily_crop_water_use_mm_per_day: 0, days_until_depletion_threshold: null },
      { contract_version: pair(1).contract_version }, { model_version: pair(1).model_version },
      { contract_version: "unknown" }, { model_version: "unknown" },
      { contract_version: pair(2).contract_version.toUpperCase() },
      { model_version: pair(2).model_version.toUpperCase() },
      { contract_version: `${pair(2).contract_version} ` }, { model_version: `${pair(2).model_version} ` },
      { contract_version: null }, { model_version: null },
    ];
    invalid.forEach((patch, index) => assert.equal(accepts({ ...v2(), ...patch }), false, `invalid case ${index}`));
    assert.equal(predicate(h.checks[names[1]])({ ...v1(), furrow_count: 1 }), false);
    assert.equal(predicate(h.checks[names[2]])({ ...v2(), furrow_count: null }), false);
    assert.equal(predicate(h.checks[names[3]])({ ...v2(), daily_crop_water_use_mm_per_day: null }), false);
    // Constraints deliberately do not enforce floating-point identities.
    assert.equal(accepts({ ...v2(), total_applied_volume_l: 1, total_applied_volume_m3: 7 }), true);
  } finally { await h.close(); }
});

test("DOWN compiles only four check drops then six column drops after all reads", async () => {
  for (const data of [[], [v1(), v1()]]) {
    const h = await harness(true, data);
    try {
      await migration.down(h.db);
      assert.deepEqual(h.events, ["read", "read", "ddl", "ddl"]);
      assert.equal(h.sql.length, 2);
      names.forEach((name) => assert.ok(h.sql[0].includes(`drop constraint ${name}`)));
      assert.equal((h.sql[0].match(/drop constraint/g) || []).length, 4);
      columns.forEach((c) => assert.ok(h.sql[1].includes(`drop \`${c}\``)));
      assert.equal((h.sql[1].match(/drop `/g) || []).length, 6);
      assert.doesNotMatch(h.sql.join(" "), /delete |update |drop table|width_m|created_at|foreign|index|primary/i);
    } finally { await h.close(); }
  }
});

test("DOWN refuses V2, unknown/crossed/case/trailing pairs or any extension before DDL", async () => {
  const invalid = [v2(), { ...v1(), ...pair(2) },
    ...["contract_version", "model_version"].flatMap((c) => [null, "unknown", v1()[c].toUpperCase(), `${v1()[c]} `, pair(2)[c]].map((n) => ({ ...v1(), [c]: n }))),
    ...columns.map((c) => ({ ...v1(), [c]: 0 }))];
  for (const row of invalid) {
    const h = await harness(true, [v1(), row]);
    try {
      await assert.rejects(migration.down(h.db), /down refused/);
      assert.deepEqual(h.events, ["read", "read"]); assert.deepEqual(h.sql, []);
    } finally { await h.close(); }
  }
});

test("UP/DOWN refuse missing, partial and already applied schemas without any DDL", async () => {
  for (const direction of ["up", "down"]) {
    for (const kind of ["missing", "one-column", "all-columns", "one-check", "opposite"]) {
      const h = await harness(direction === "down");
      try {
        if (kind === "missing") h.schemaRows.length = 0;
        if (kind === "opposite") {
          if (direction === "down") h.schemaRows.splice(48);
          else h.schemaRows.push(...columns.map((name) => ({ kind: "column", name })), ...names.map((name) => ({ kind: "check", name })));
        } else if (direction === "up") {
          if (kind === "one-column") h.schemaRows.push({ kind: "column", name: columns[0] });
          if (kind === "all-columns") h.schemaRows.push(...columns.map((name) => ({ kind: "column", name })));
          if (kind === "one-check") h.schemaRows.push({ kind: "check", name: names[0] });
        } else if (kind !== "missing") {
          const remove = kind === "one-check" ? names[0] : columns[0];
          h.schemaRows.splice(h.schemaRows.findIndex((r) => r.name === remove), 1);
        }
        await assert.rejects(migration[direction](h.db), /unexpected or partial/);
        assert.deepEqual(h.events, ["read"]); assert.deepEqual(h.sql, []);
      } finally { await h.close(); }
    }
  }
});

test("every interrupted prefix of additive/removal DDL is reported, never repaired", async () => {
  for (const direction of ["up", "down"]) {
    for (let addedColumns = 0; addedColumns <= 6; addedColumns++) {
      for (let addedChecks = 0; addedChecks <= 4; addedChecks++) {
        if (direction === "up" && addedColumns === 0 && addedChecks === 0) continue;
        if (direction === "down" && addedColumns === 6 && addedChecks === 4) continue;
        const h = await harness();
        try {
          h.schemaRows.push(...columns.slice(0, addedColumns).map((name) => ({ kind: "column", name })),
            ...names.slice(0, addedChecks).map((name) => ({ kind: "check", name })));
          await assert.rejects(migration[direction](h.db), /unexpected or partial/);
          assert.deepEqual(h.events, ["read"]); assert.deepEqual(h.sql, []);
        } finally { await h.close(); }
      }
    }
  }
});

test("preflight/read/DDL failures propagate without repair or later DDL", async () => {
  for (const direction of ["up", "down"]) {
    for (let at = 1; at <= (direction === "down" ? 4 : 3); at++) {
      const h = await harness(direction === "down");
      try {
        let calls = 0;
        const fail = (fn) => (...args) => { if (++calls === at) throw new Error("synthetic failure"); return fn(...args); };
        h.db.raw = fail(h.db.raw); h.db.schema.alterTable = fail(h.db.schema.alterTable);
        await assert.rejects(migration[direction](h.db), /synthetic failure/);
        assert.equal(calls, at);
      } finally { await h.close(); }
    }
  }
});
