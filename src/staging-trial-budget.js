const { createPublicKey, randomBytes, verify } = require("node:crypto");

const PURPOSE = "riegar-academic-single-insert-v1";
const WINDOW_MS = 10 * 60 * 1000;
const uint = value => Number.isInteger(value) && value > 0 && value <= 4294967295;
function readPublicKey(encoded) {
  if (typeof encoded !== "string" || !/^[A-Za-z0-9_-]{59}$/.test(encoded)) throw new Error("Invalid trial public key");
  const key = createPublicKey({ key: Buffer.from(encoded, "base64url"), format: "der", type: "spki" });
  if (key.asymmetricKeyType !== "ed25519" || key.export({ format: "der", type: "spki" }).toString("base64url") !== encoded) throw new Error("Invalid trial public key");
  return key;
}
function validPublicKey(encoded) { try { readPublicKey(encoded); return true; } catch { return false; } }

// Un permiso firmado se dirige a UN arranque. Reiniciar invalida el permiso anterior;
// el emisor privado usa un ledger durable por ensayo y no emite otro automáticamente.
function createTrialBudget({ trialId, userId, farmId, publicKey, now = Date.now }) {
  if (typeof trialId !== "string" || !/^[A-Za-z0-9_-]{1,80}$/.test(trialId) || !uint(userId) || !uint(farmId)) throw new Error("Invalid trial configuration");
  const key = readPublicKey(publicKey), openedAt = now(), closesAt = openedAt + WINDOW_MS;
  const bootNonce = randomBytes(32).toString("base64url");
  let consumed = false;
  const available = () => !consumed && now() >= openedAt && now() < closesAt;
  const challenge = Object.freeze({ purpose: PURPOSE, trialId, bootNonce, userId, farmId, openedAt, closesAt });
  return Object.freeze({
    available,
    challenge: () => challenge,
    consume(token, { userId: requester, farmId: target }) {
      if (!available() || requester !== userId || target !== farmId || typeof token !== "string" || token.length > 2048) return false;
      const parts = token.split(".");
      if (parts.length !== 2 || parts.some(part => !/^[A-Za-z0-9_-]+$/.test(part))) return false;
      try {
        const data = Buffer.from(parts[0], "base64url"), signature = Buffer.from(parts[1], "base64url");
        if (signature.length !== 64 || !verify(null, data, key, signature)) return false;
        const claims = JSON.parse(data.toString("utf8"));
        if (!claims || Object.keys(claims).length !== Object.keys(challenge).length ||
            Object.entries(challenge).some(([field, value]) => claims[field] !== value)) return false;
        // Síncrono y previo a next()/SQL. Nunca se rearma, ni tras rollback o error.
        consumed = true;
        return true;
      } catch { return false; }
    },
  });
}
module.exports = { PURPOSE, WINDOW_MS, validPublicKey, createTrialBudget };
