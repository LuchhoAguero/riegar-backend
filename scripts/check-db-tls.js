const knex = require("../src/config/knex");

async function checkTls() {
  const connection = await knex.client.acquireConnection();
  try {
    const [cipherRow] = await knex.raw("SHOW SESSION STATUS LIKE 'Ssl_cipher'").connection(connection);
    const [versionRow] = await knex.raw("SHOW SESSION STATUS LIKE 'Ssl_version'").connection(connection);
    const cipher = cipherRow[0]?.Value || "";
    const version = versionRow[0]?.Value || "";

    console.log(`Database TLS: ${cipher ? "enabled" : "disabled"}`);
    console.log(`TLS version: ${version || "unavailable"}`);
    console.log(`Cipher: ${cipher || "none"}`);

    if (process.env.DB_SSL === "true" && !cipher) process.exitCode = 1;
  } finally {
    await knex.client.releaseConnection(connection);
  }
}

checkTls()
  .catch(() => {
    console.error("Database TLS check failed; verify the database connection and CA certificate.");
    process.exitCode = 1;
  })
  .finally(() => knex.destroy());
