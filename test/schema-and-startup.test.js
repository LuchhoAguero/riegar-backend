const { test } = require("node:test");
const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const knex = require("knex");

test("runtime and CLI share UTC Date handling independently of host timezone", () => {
  const script = `
    const assert = require("node:assert/strict");
    const { createKnexConfig } = require("./src/config/database");
    const config = createKnexConfig();
    const cli = require("./knexfile");
    const runtime = require("./src/config/knex");
    const date = new Date("2026-10-12T15:30:45.123Z");
    try {
      assert.equal(config.connection.timezone, "Z");
      assert.equal(runtime.client.connectionSettings.timezone, "Z");
      for (const environment of ["development", "production"]) {
        assert.equal(cli[environment].connection.timezone, "Z");
      }
      assert.equal(require("mysql2").escape(date, false, config.connection.timezone),
        "'2026-10-12 15:30:45.123'");
    } finally { runtime.destroy(); }
  `;
  for (const timezone of ["UTC", "America/Buenos_Aires"]) {
    const result = spawnSync(process.execPath, ["-e", script], {
      cwd: require("node:path").resolve(__dirname, ".."),
      env: {
        ...process.env, TZ: timezone, DB_HOST: "example.invalid", DB_PORT: "3306",
        DB_USER: "test", DB_PASSWORD: "test-only", DB_NAME: "test", DB_SSL: "false",
      },
      encoding: "utf8", timeout: 5000, windowsHide: true,
    });
    assert.equal(result.status, 0, "shared UTC policy must pass in both host timezones");
  }
});

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
