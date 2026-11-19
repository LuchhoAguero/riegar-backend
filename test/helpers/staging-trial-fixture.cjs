const { generateKeyPairSync, sign } = require("node:crypto");
const { publicKey, privateKey } = generateKeyPairSync("ed25519");
const encoded = publicKey.export({ format: "der", type: "spki" }).toString("base64url");
const trialOptions = (userId, farmId) => ({ creationUserId: userId, creationFarmId: farmId, trialId: "offline-trial", trialPublicKey: encoded });
const trialEnvironment = (userId, farmId) => ({ RIEGAR_DEMO_V2_USER_ID: String(userId), RIEGAR_DEMO_V2_FARM_ID: String(farmId), RIEGAR_DEMO_V2_TRIAL_ID: "offline-trial", RIEGAR_DEMO_V2_PUBLIC_KEY: encoded });
const signChallenge = challenge => { const data = Buffer.from(JSON.stringify(challenge)); return data.toString("base64url") + "." + sign(null, data, privateKey).toString("base64url"); };
module.exports = { publicKey, privateKey, encoded, trialOptions, trialEnvironment, signChallenge };
