const { test } = require("node:test");
const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const knex = require("knex");

test("existing migration: offline SQL confirms name capacity and DECIMAL scales", async () => {
  // Compile only: no SQL is executed, no database connection is configured.
  const compiler = knex({ client: "mysql2" });
  let sql;
  const capture = { schema: { createTable(name, callback) {
    sql = compiler.schema.createTable(name, callback).toSQL().map((statement) => statement.sql).join(" ");
  } } };
  try {
    require("../db/migrations/20251113003352_create_calculos_table").up(capture);
    assert.match(sql, /`nombre_calculo` varchar\(255\)/);
    for (const field of ["b", "h", "z", "n"]) assert.ok(sql.includes(`\`${field}\` decimal(8, 4)`));
    assert.ok(sql.includes("`S` decimal(10, 6)"));
    for (const field of ["A", "P"]) assert.ok(sql.includes(`\`${field}\` decimal(10, 4)`));
    assert.ok(sql.includes("`Q_m3s` decimal(12, 6)"));
  } finally { await compiler.destroy(); }
});

test("src/server and root entry start with synthetic environment, without DB queries", () => {
  for (const entry of ["./src/server", "./server"]) {
    const script = `require(${JSON.stringify(entry)}); setTimeout(() => process.exit(0), 100);`;
    const result = spawnSync(process.execPath, ["-e", script], {
      cwd: require("node:path").resolve(__dirname, ".."),
      env: {
        ...process.env,
        PORT: "0", DB_HOST: "example.invalid", DB_PORT: "3306", DB_USER: "test",
        DB_PASSWORD: "test-only", DB_NAME: "test", DB_SSL: "false",
        JWT_SECRET: "test-only", EMAIL_USER: "test@example.invalid", EMAIL_PASS: "test-only",
        CORS_ORIGIN: "http://localhost:5173",
      },
      encoding: "utf8", timeout: 5000, windowsHide: true,
    });
    assert.equal(result.status, 0, "server entry must start and exit successfully");
    assert.match(result.stdout, /RiegAR backend listening on port 0/);
  }
});
