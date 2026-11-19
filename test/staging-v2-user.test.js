const test = require("node:test");
const assert = require("node:assert/strict");
const { once } = require("node:events");
const jwt = require("jsonwebtoken");
const golden = require("./fixtures/irrigation-v2-golden");
const { ACTIVE_V1, ACTIVE_V2, ACTIVE_DESCRIPTOR } = require("../src/services/irrigation-simulations.versions");
const { mapCalculationToSnapshotVersioned } = require("../src/services/irrigation-simulations.versioned-mapper");
const { trialOptions, signChallenge } = require("./helpers/staging-trial-fixture.cjs");

const secret = "offline-trial-guard-key-not-a-real-secret";
const origin = "https://riegar-academico.netlify.app";
const state = { rows: [], calls: 0, inserts: 0 };
const farms = [{ id: 7, user_id: 2 }, { id: 8, user_id: 1 }];
function db(table) {
  state.calls++;
  let filters = {};
  const selected = () => (table === "fincas" ? farms : state.rows).filter(row => Object.entries(filters).every(([key, value]) =>
    key === "f.user_id" ? farms.some(farm => farm.id === row.finca_id && farm.user_id === value) : row[key.replace(/^s\./, "")] === value));
  const chain = {
    where(value) { filters = value; return chain; }, forShare() { return chain; }, join() { return chain; }, select() { return chain; }, orderBy() { return chain; },
    async first() { return selected()[0]; }, async limit(count) { return selected().slice(0, count); },
    async insert(snapshot) { state.inserts++; const id = 101; state.rows.push({ id, ...snapshot }); return [id]; },
  };
  return chain;
}
db.transaction = callback => callback(db);
const filename = require.resolve("../src/config/knex");
require.cache[filename] = { id: filename, filename, loaded: true, exports: db };
const { createApp } = require("../src/app");
const base = "/api/fincas/7/irrigation-simulations";
const capability = "/api/capabilities/irrigation";
const payload = () => ({ ...structuredClone(golden.input), name: "Ensayo offline autorizado" });

async function scenario(policy, check) {
  state.rows = []; state.calls = 0; state.inserts = 0;
  const prior = process.env.JWT_SECRET;
  process.env.JWT_SECRET = secret;
  const server = createApp({ staging: { origin, ready: async () => {}, log: () => {}, creationEnabled: true, ...trialOptions(2, 7), ...policy } }).listen(0, "127.0.0.1");
  try {
    await once(server, "listening");
    const address = "http://127.0.0.1:" + server.address().port;
    let challenge;
    const request = async (path, userId, options = {}) => {
      const response = await fetch(address + path, {
        ...options, headers: { Origin: origin, ...(userId === undefined ? {} : { Authorization: "Bearer " + jwt.sign({ userId }, secret, { expiresIn: "5m" }) }),
          ...(options.method === "POST" && userId === 2 && challenge ? { "X-Riegar-Trial-Permit": signChallenge(challenge) } : {}), ...options.headers },
      });
      if (path.startsWith(capability) && response.status === 200) challenge = (await response.clone().json()).trial;
      return response;
    };
    await check(request);
  } finally {
    await new Promise(resolve => server.close(resolve));
    if (prior === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = prior;
  }
}
const post = body => ({ method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

test("trial guard: la cuenta configurada obtiene capacidad y 201 con el motor V2 existente", async () => {
  await scenario({}, async request => {
    const declared = await request(capability, 2);
    assert.equal(declared.status, 200);
    assert.equal((await declared.json()).creationEnabled, true);
    const response = await request(base, 2, post(payload()));
    assert.equal(response.status, 201);
    const snapshot = await response.json();
    assert.equal(snapshot.simulation.id, 101);
    assert.deepEqual(snapshot.input, golden.input);
    assert.deepEqual(snapshot.output, golden.output);
    assert.equal(snapshot.model.contractVersion, ACTIVE_V2.contractVersion);
    assert.equal(state.inserts, 1);
    const calls = state.calls;
    const repeated = await request(base, 2, post(payload()));
    assert.equal(repeated.status, 403);
    assert.equal(state.calls, calls);
    assert.equal(state.inserts, 1);
    assert.equal((await (await request(capability, 2)).json()).creationEnabled, false);
  });
});

for (const userId of [1, 3, "2", null]) test(`trial guard: JWT válido de usuario ${JSON.stringify(userId)} no habilita creación`, async () => {
  await scenario({}, async request => {
    const declared = await (await request(capability + "?userId=2", userId)).json();
    assert.equal(declared.creationEnabled, false);
    assert.ok(!Object.hasOwn(declared, "creationUserId"));
    assert.ok(!Object.hasOwn(declared, "userId"));
    const response = await request("/api/fincas/8/irrigation-simulations", userId, post(payload()));
    assert.equal(response.status, 403);
    assert.equal((await response.json()).code, "SIMULATION_CREATION_DISABLED");
    assert.equal(state.calls, 0, "Rechazo anterior a consultas, cálculo o inserción");
    assert.equal(state.inserts, 0);
  });
});

for (const path of [base + "?creationUserId=2", base + "/", "/api/FINCAS/7/irrigation-simulations"]) test(`trial guard: cuerpo, cabecera y URL no sustituyen el usuario autenticado ${path}`, async () => {
  await scenario({}, async request => {
    const response = await request(path, 1, { ...post({ ...payload(), userId: 2, creationUserId: 2 }), headers: { "Content-Type": "application/json", "X-Riegar-User-Id": "2" } });
    assert.equal(response.status, 403);
    assert.equal(state.calls, 0);
  });
});

for (const creationUserId of [undefined, null, 0, -1, "2", NaN, 4294967296]) test(`trial guard: composición directa sin ID numérico válido ${String(creationUserId)} bloquea`, async () => {
  await scenario({ creationUserId }, async request => {
    assert.equal((await (await request(capability, 2)).json()).creationEnabled, false);
    assert.equal((await request(base, 2, post(payload()))).status, 403);
    assert.equal(state.calls, 0);
  });
});

test("trial guard: bandera apagada bloquea incluso a la cuenta autorizada", async () => {
  await scenario({ creationEnabled: false }, async request => {
    const declared = await (await request(capability, 2)).json();
    assert.equal(declared.creationEnabled, false);
    assert.equal(declared.contractVersion, ACTIVE_V1.contractVersion);
    assert.equal((await request(base, 2, post(payload()))).status, 403);
    assert.equal(state.calls, 0);
  });
});

test("trial guard: falta de JWT o firma ajena no autentica a la cuenta configurada", async () => {
  await scenario({}, async request => {
    assert.equal((await request(capability, undefined)).status, 401);
    assert.equal((await request(base, undefined, post(payload()))).status, 401);
    const invalid = jwt.sign({ userId: 2 }, "other-offline-key", { expiresIn: "5m" });
    assert.equal((await request(base, undefined, { ...post(payload()), headers: { Authorization: "Bearer " + invalid, "Content-Type": "application/json" } })).status, 403);
    assert.equal(state.calls, 0);
  });
});

test("trial guard: la cuenta autorizada conserva Origin obligatorio y ownership", async () => {
  await scenario({}, async request => {
    for (const Origin of ["", "https://foreign.invalid"]) {
      assert.equal((await request(base, 2, { ...post(payload()), headers: { Origin, "Content-Type": "application/json" } })).status, 403);
      assert.equal(state.calls, 0);
    }
    assert.equal((await request("/api/fincas/8/irrigation-simulations", 2, post(payload()))).status, 403);
    assert.equal((await request("/api/fincas/8/irrigation-simulations/101", 2)).status, 404);
    assert.equal(state.inserts, 0);
  });
});

test("trial guard: otros usuarios mantienen HISTORY y DETAIL propios sin permiso de creación", async () => {
  await scenario({}, async request => {
    const result = ACTIVE_V2.calculate(structuredClone(golden.input));
    const snapshot = mapCalculationToSnapshotVersioned({ fincaId: 8, name: "Histórico offline", calculationResult: result, createdAt: new Date("2026-11-18T12:00:00.000Z") }, { descriptor: ACTIVE_V2 });
    state.rows.push({ id: 202, ...snapshot });
    const history = await request("/api/fincas/8/irrigation-simulations", 1);
    assert.equal(history.status, 200);
    assert.equal((await history.json()).items[0].simulation.id, 202);
    const detail = await request("/api/fincas/8/irrigation-simulations/202", 1);
    assert.equal(detail.status, 200);
    assert.deepEqual((await detail.json()).output, golden.output);
    assert.equal((await request("/api/fincas/8/irrigation-simulations/202", 2)).status, 404);
    const calls = state.calls;
    assert.equal((await request("/api/fincas/8/irrigation-simulations", 1, post(payload()))).status, 403);
    assert.equal(state.calls, calls);
    assert.equal(state.inserts, 0);
  });
  assert.equal(ACTIVE_DESCRIPTOR, ACTIVE_V1);
});
