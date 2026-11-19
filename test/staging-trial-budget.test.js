const test = require("node:test"), assert = require("node:assert/strict");
const fs = require("node:fs"), os = require("node:os"), path = require("node:path");
const { generateKeyPairSync } = require("node:crypto");
const { createTrialBudget, validPublicKey, WINDOW_MS } = require("../src/staging-trial-budget");
const { issueSinglePermit } = require("../scripts/issue-staging-trial-permit.cjs");
const { encoded, privateKey, signChallenge } = require("./helpers/staging-trial-fixture.cjs");
const config = { trialId: "offline-single-insert", userId: 2, farmId: 2, publicKey: encoded };
const identity = { userId: 2, farmId: 2 };

test("single-use: concurrent requests admit at most one before SQL", async () => {
  const gate = createTrialBudget(config), token = signChallenge(gate.challenge());
  const allowed = await Promise.all(Array.from({ length: 30 }, async () => gate.consume(token, identity)));
  assert.equal(allowed.filter(Boolean).length, 1);
  assert.equal(gate.available(), false);
});
test("single-use: error or rollback after admission never rearms the budget", async () => {
  const gate = createTrialBudget(config), token = signChallenge(gate.challenge());
  await assert.rejects(async () => { assert.equal(gate.consume(token, identity), true); throw Error("simulated acknowledgement loss"); });
  assert.equal(gate.consume(token, identity), false);
});
test("single-use: restart or another instance cannot accept an old permit", () => {
  const first = createTrialBudget(config), second = createTrialBudget(config);
  assert.notEqual(first.challenge().bootNonce, second.challenge().bootNonce);
  const token = signChallenge(first.challenge());
  assert.equal(second.consume(token, identity), false);
  assert.equal(first.consume(token, identity), true);
  assert.equal(createTrialBudget(config).consume(token, identity), false);
});
test("single-use: window expiry rejects without extending itself", () => {
  let clock = 1000000;
  const gate = createTrialBudget({ ...config, now: () => clock }), token = signChallenge(gate.challenge());
  clock += WINDOW_MS;
  assert.equal(gate.available(), false); assert.equal(gate.consume(token, identity), false);
});
for (const changed of [{ userId: 3 }, { farmId: 3 }, { userId: "2" }]) test("single-use: identity mismatch " + JSON.stringify(changed), () => {
  const gate = createTrialBudget(config), token = signChallenge(gate.challenge());
  assert.equal(gate.consume(token, { ...identity, ...changed }), false);
  assert.equal(gate.available(), true);
});
test("single-use: missing, malformed or tampered signature is rejected", () => {
  const gate = createTrialBudget(config), token = signChallenge(gate.challenge());
  for (const invalid of [undefined, "", "bad.bad", "x".repeat(2049), token.replace(/^./, "X")]) assert.equal(gate.consume(invalid, identity), false);
  const changed = signChallenge({ ...gate.challenge(), userId: 3 });
  assert.equal(gate.consume(changed, identity), false);
  assert.equal(gate.available(), true);
});
test("single-use: another signing key cannot mint a permit", () => {
  const gate = createTrialBudget(config), { privateKey: other } = generateKeyPairSync("ed25519");
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "riegar-test-permit-"));
  const token = issueSinglePermit({ challenge: gate.challenge(), privateKey: other, ledgerDirectory: dir, expectedTrialId: config.trialId });
  assert.equal(gate.consume(token, identity), false);
});
test("single-use: durable operator ledger rejects reissuance, including after restart", () => {
  const gate = createTrialBudget(config), dir = fs.mkdtempSync(path.join(os.tmpdir(), "riegar-test-permit-")), ledgerFile = path.join(dir, config.trialId + ".jsonl");
  const args = { privateKey, ledgerDirectory: dir, expectedTrialId: config.trialId };
  const token = issueSinglePermit({ ...args, challenge: gate.challenge() });
  const contents = fs.readFileSync(ledgerFile, "utf8");
  assert.ok(!contents.includes(token));
  assert.throws(() => issueSinglePermit({ ...args, challenge: gate.challenge() }), { code: "EEXIST" });
  assert.throws(() => issueSinglePermit({ ...args, challenge: createTrialBudget(config).challenge() }), { code: "EEXIST" });
  assert.equal(fs.readFileSync(ledgerFile, "utf8"), contents);
});
test("single-use: partial/reserved ledger is never overwritten", () => {
  const gate = createTrialBudget(config), dir = fs.mkdtempSync(path.join(os.tmpdir(), "riegar-test-permit-")), ledgerFile = path.join(dir, config.trialId + ".jsonl");
  fs.writeFileSync(ledgerFile, "reserved", { flag: "wx" });
  assert.throws(() => issueSinglePermit({ challenge: gate.challenge(), privateKey, ledgerDirectory: dir, expectedTrialId: config.trialId }), { code: "EEXIST" });
  assert.equal(fs.readFileSync(ledgerFile, "utf8"), "reserved");
});
test("single-use: key parser accepts only the canonical public Ed25519 key", () => {
  assert.equal(validPublicKey(encoded), true);
  for (const invalid of [undefined, "", encoded + "=", "private", "a".repeat(59)]) assert.equal(validPublicKey(invalid), false);
});
