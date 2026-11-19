// Herramienta LOCAL del operador. Nunca se publica como endpoint ni carga una clave privada en Render.
const fs = require("node:fs");
const path = require("node:path");
const { createHash, sign } = require("node:crypto");
const { PURPOSE, WINDOW_MS } = require("../src/staging-trial-budget");

function issueSinglePermit({ challenge, privateKey, ledgerDirectory, expectedTrialId, now = Date.now }) {
  if (challenge?.purpose !== PURPOSE || typeof challenge.trialId !== "string" ||
      !/^[A-Za-z0-9_-]{1,80}$/.test(challenge.trialId) || challenge.trialId !== expectedTrialId ||
      typeof challenge.bootNonce !== "string" || !/^[A-Za-z0-9_-]{43}$/.test(challenge.bootNonce) ||
      !Number.isSafeInteger(challenge.openedAt) || !Number.isSafeInteger(challenge.closesAt) ||
      challenge.closesAt - challenge.openedAt !== WINDOW_MS || now() < challenge.openedAt || now() >= challenge.closesAt ||
      privateKey?.asymmetricKeyType !== "ed25519" || privateKey.type !== "private") throw new Error("Invalid trial issuance");
  // El nombre del ledger lo fija el operador para el ensayo, NO el nonce ni una respuesta HTTP.
  // wx + fsync: una segunda emisión, incluso tras reinicios/fallos, se detiene sin sobrescribir.
  const ledgerFile = path.join(ledgerDirectory, expectedTrialId + ".jsonl");
  const fd = fs.openSync(ledgerFile, "wx", 0o600);
  try {
    fs.writeSync(fd, JSON.stringify({ state: "reserved", challenge }) + "\n");
    fs.fsyncSync(fd);
    const data = Buffer.from(JSON.stringify(challenge));
    const token = data.toString("base64url") + "." + sign(null, data, privateKey).toString("base64url");
    fs.writeSync(fd, JSON.stringify({ state: "issued", sha256: createHash("sha256").update(token).digest("hex") }) + "\n");
    fs.fsyncSync(fd);
    return token;
  } finally { fs.closeSync(fd); }
}
module.exports = { issueSinglePermit };
