import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { GameConfig } from '../src/game/GameConfig.js';
import { BlockIds } from '../src/utils/Constants.js';
import { startTestApi } from './support/apiServer.js';
import { defaultWorld, findNatural } from './support/progression.js';

const POINTS = GameConfig.progression.POINTS;
const servers = [];
after(() => Promise.all(servers.map((server) => server.close())));

async function api(options) {
  const server = await startTestApi(options);
  servers.push(server);
  return server;
}

async function register(server, name = 'Tobias') {
  const { status, body } = await server.call('POST', '/players', { body: { name } });
  assert.equal(status, 201);
  return body;
}

function stateWith({ explored = [], biomes = [], mined = {}, blocksBuilt = 0 } = {}) {
  return { version: 1, explored, biomes, mined, blocksBuilt };
}

function submit(server, token, { revision = 1, state = stateWith(), mode = 'survival', world = defaultWorld().worldKey } = {}) {
  return server.call('PUT', '/progress', { token, body: { mode, world, revision, state } });
}

test('registrar un invitado devuelve id y token, y valida el nombre', async () => {
  const server = await api();
  const player = await register(server, '  Tobías  Caballero ');
  assert.match(player.playerId, /^[0-9a-f-]{36}$/);
  assert.ok(player.token.length >= 40);
  assert.equal(player.name, 'Tobías Caballero');

  for (const name of ['ab', 'x'.repeat(30), '<script>', null]) {
    const { status, body } = await server.call('POST', '/players', { body: { name } });
    assert.equal(status, 422, String(name));
    assert.equal(body.error, 'invalid-name');
  }
});

test('el servidor recalcula la puntuación e ignora la que mande el cliente', async () => {
  const server = await api();
  const { token } = await register(server);
  const { status, body } = await server.call('PUT', '/progress', {
    token,
    body: { mode: 'survival', world: defaultWorld().worldKey, revision: 1, score: 999999, state: stateWith({ explored: [0, 1, 2], blocksBuilt: 4 }) }
  });
  assert.equal(status, 200);
  assert.equal(body.score, 3 * POINTS.EXPLORATION_CELL + 4 * POINTS.BLOCK_BUILT);
  assert.equal(body.rank, 1);
});

test('progreso guardado se recupera con el mismo token', async () => {
  const server = await api();
  const { token } = await register(server);
  const world = defaultWorld().worldKey;
  const empty = await server.call('GET', `/progress?mode=survival&world=${world}`, { token });
  assert.deepEqual([empty.status, empty.body.progress], [200, null], 'sin progreso todavía no es un error');

  await submit(server, token, { state: stateWith({ explored: [4] }) });
  const { status, body } = await server.call('GET', `/progress?mode=survival&world=${world}`, { token });
  assert.equal(status, 200);
  assert.deepEqual(body.progress.state.explored, [4]);
  assert.equal(body.progress.revision, 1);
  assert.equal(body.progress.score, POINTS.EXPLORATION_CELL);
});

test('sin token o con un token falso no se puede leer ni escribir', async () => {
  const server = await api();
  assert.equal((await submit(server, null)).status, 401);
  assert.equal((await submit(server, 'x'.repeat(43))).status, 401);
  assert.equal((await server.call('GET', `/progress?mode=survival&world=${defaultWorld().worldKey}`)).status, 401);
});

test('se rechazan minerales, biomas y celdas que no existen en el mundo', async () => {
  const server = await api();
  const { token } = await register(server);
  const { terrain } = defaultWorld();
  const [coal] = findNatural(terrain, BlockIds.COAL_ORE);
  const coalIndex = terrain.indexOf(coal.x, coal.y, coal.z);

  for (const state of [
    stateWith({ mined: { [BlockIds.DIAMOND_ORE]: [coalIndex] } }),
    stateWith({ biomes: [42] }),
    stateWith({ explored: [10_000] }),
    { version: 1, explored: 'todo' }
  ]) {
    const { status, body } = await submit(server, token, { state });
    assert.equal(status, 422, JSON.stringify(state));
    assert.equal(body.error, 'invalid-progress');
  }
  assert.equal((await submit(server, token, { state: stateWith({ mined: { [BlockIds.COAL_ORE]: [coalIndex] } }) })).body.score, POINTS.ORES[BlockIds.COAL_ORE]);
});

test('modos y mundos desconocidos se rechazan', async () => {
  const server = await api();
  const { token } = await register(server);
  assert.equal((await submit(server, token, { mode: 'hardcore' })).body.error, 'invalid-mode');
  assert.equal((await submit(server, token, { world: 's1-v1-32x24x32' })).body.error, 'unsupported-world', 'otra versión del generador');
  assert.equal((await submit(server, token, { world: 's1-v2-4096x24x32' })).body.error, 'unsupported-world', 'demasiado grande');
});

test('una revisión vieja o un estado que pierde progreso no pisa lo guardado', async () => {
  const server = await api();
  const { token } = await register(server);
  await submit(server, token, { revision: 2, state: stateWith({ explored: [0, 1] }) });

  const old = await submit(server, token, { revision: 2, state: stateWith({ explored: [0, 1, 2] }) });
  assert.equal(old.status, 409);
  assert.equal(old.body.error, 'stale-revision');
  assert.equal(old.body.current.revision, 2, 'devuelve lo guardado para que el cliente lo una');

  const regression = await submit(server, token, { revision: 3, state: stateWith({ explored: [0] }) });
  assert.equal(regression.status, 409);

  const ok = await submit(server, token, { revision: 3, state: stateWith({ explored: [0, 1, 2] }) });
  assert.equal(ok.status, 200);
  assert.equal(ok.body.revision, 3);
});

test('no se aceptan más puntos que los alcanzables en el tiempo transcurrido', async () => {
  const server = await api();
  const { token } = await register(server);
  const config = GameConfig.progression;
  const blocksBuilt = config.RATE_BURST_POINTS + 100;

  const tooFast = await submit(server, token, { state: stateWith({ blocksBuilt }) });
  assert.equal(tooFast.status, 429);
  assert.equal(tooFast.body.error, 'rate-limited');
  assert.ok(tooFast.body.retryAfterSeconds > 0);

  server.clock.advanceMinutes(1);
  assert.equal((await submit(server, token, { state: stateWith({ blocksBuilt }) })).status, 200);
});

test('la clasificación ordena, limita, desempata y separa modos', async () => {
  const server = await api();
  const ana = await register(server, 'Ana');
  const beto = await register(server, 'Beto');
  const caro = await register(server, 'Caro');
  const sinPuntos = await register(server, 'Dani');

  await submit(server, ana.token, { state: stateWith({ explored: [0, 1] }) });
  server.clock.advanceMinutes(1);
  await submit(server, beto.token, { state: stateWith({ explored: [0, 1, 2, 3] }) });
  server.clock.advanceMinutes(1);
  await submit(server, caro.token, { state: stateWith({ explored: [5, 6] }) });
  await submit(server, caro.token, { mode: 'creative', state: stateWith({ blocksBuilt: 200 }) });

  const board = await server.call('GET', '/leaderboard?mode=survival&limit=10');
  assert.equal(board.status, 200);
  assert.deepEqual(board.body.entries.map(({ position, name }) => `${position}.${name}`), ['1.Beto', '2.Ana', '3.Caro'],
    'Ana y Caro empatan; Ana llegó antes');
  assert.equal((await server.call('GET', '/leaderboard?mode=survival&limit=1')).body.entries.length, 1);
  assert.deepEqual((await server.call('GET', '/leaderboard?mode=creative')).body.entries.map(({ name }) => name), ['Caro']);

  const own = await server.call('GET', `/leaderboard/players/${ana.playerId}?mode=survival`);
  assert.deepEqual([own.body.position, own.body.score], [2, 2 * POINTS.EXPLORATION_CELL]);
  const empty = await server.call('GET', `/leaderboard/players/${sinPuntos.playerId}?mode=survival`);
  assert.deepEqual([empty.status, empty.body.position, empty.body.score], [200, null, 0]);
  const missing = await server.call('GET', '/leaderboard/players/00000000-0000-4000-8000-000000000000?mode=survival');
  assert.deepEqual([missing.status, missing.body.error], [404, 'player-not-found']);
  assert.equal((await server.call('GET', '/leaderboard/players/no-es-un-id?mode=survival')).status, 404);
  assert.equal((await server.call('GET', '/leaderboard?mode=survival&limit=0')).status, 400);
});

test('una tabla sin registros responde vacía', async () => {
  const server = await api();
  const { status, body } = await server.call('GET', '/leaderboard?mode=survival');
  assert.equal(status, 200);
  assert.deepEqual(body.entries, []);
});

test('la clasificación se actualiza con nuevas puntuaciones', async () => {
  const server = await api();
  const ana = await register(server, 'Ana');
  const beto = await register(server, 'Beto');
  await submit(server, ana.token, { state: stateWith({ explored: [0, 1, 2] }) });
  await submit(server, beto.token, { state: stateWith({ explored: [0] }) });
  server.clock.advanceMinutes(1);
  const climb = await submit(server, beto.token, { revision: 2, state: stateWith({ explored: [0, 1, 2, 3] }) });
  assert.equal(climb.body.rank, 1);
  assert.deepEqual((await server.call('GET', '/leaderboard?mode=survival')).body.entries.map(({ name }) => name), ['Beto', 'Ana']);
});

test('una falla de almacenamiento devuelve un error controlado y no corrompe datos', async () => {
  const server = await api();
  const { token } = await register(server);
  await submit(server, token, { state: stateWith({ explored: [0] }) });

  server.repository.failNextWrite = true;
  const failed = await submit(server, token, { revision: 2, state: stateWith({ explored: [0, 1] }) });
  assert.equal(failed.status, 503);
  assert.equal(failed.body.error, 'storage-error');
  assert.equal(failed.body.detail, undefined, 'no expone detalles internos');

  const { body } = await server.call('GET', `/progress?mode=survival&world=${defaultWorld().worldKey}`, { token });
  assert.equal(body.progress.revision, 1);
  assert.equal((await submit(server, token, { revision: 2, state: stateWith({ explored: [0, 1] }) })).status, 200, 'el reintento funciona');
});

test('pedidos mal formados reciben errores claros', async () => {
  const server = await api();
  const response = await fetch(`${server.origin}/api/players`, { method: 'POST', body: '{no es json' });
  assert.equal(response.status, 400);
  assert.equal((await response.json()).error, 'invalid-request');
  assert.equal((await server.call('GET', '/no-existe')).status, 404);
  assert.deepEqual((await server.call('GET', '/health')).body, { ok: true });
  const preflight = await fetch(`${server.origin}/api/progress`, { method: 'OPTIONS' });
  assert.equal(preflight.status, 204);
  assert.match(preflight.headers.get('access-control-allow-headers'), /Authorization/);
});
