import { test, beforeEach, afterEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { installDomStub, uninstallDomStub } from './support/domStub.js';
import { startTestApi } from './support/apiServer.js';
import { defaultWorld } from './support/progression.js';
import { LeaderboardScreen } from '../src/interface/screens/LeaderboardScreen.js';
import { ProgressionUiService } from '../src/progression/ProgressionUiService.js';
import { ProgressionApiClient } from '../src/progression/ProgressionApiClient.js';
import { ProgressionResult } from '../src/progression/ProgressionResult.js';
import { ScreenType } from '../src/ui/ScreenType.js';
import { GameConfig } from '../src/game/GameConfig.js';

const CONFIG = GameConfig.progression;
const servers = [];
after(() => Promise.all(servers.map((server) => server.close())));

beforeEach(() => installDomStub());
afterEach(() => uninstallDomStub());

/** Progresión mínima: lo único que el servicio lee de PlayerProgression. */
function fakeProgression({ playerId = null, mode = 'survival', score = 0, verifiedScore = null, level = 1, rank = null } = {}) {
  return { playerId, mode, level, rank, snapshot: () => ({ score, verifiedScore }) };
}

/** Servicio de prueba que responde lo que se le indica. */
function stubService({ top, standing = ProgressionResult.ok({ position: null, score: 0 }), playerId = 'yo', mode = 'survival' }) {
  const calls = [];
  return {
    calls,
    currentMode: mode,
    currentPlayerId: playerId,
    top: async (requested) => { calls.push(requested); return top; },
    standing: async () => standing
  };
}

function rowsOf(screen) {
  return screen.rows.children.map((row) => row.children.map((cell) => cell.textContent));
}

test('muestra las posiciones y resalta la del jugador actual', async () => {
  const entries = [
    { position: 1, playerId: 'otro', name: 'Andrea', score: 120, achievedAt: 1 },
    { position: 2, playerId: 'yo', name: 'Tobias', score: 80, achievedAt: 2 }
  ];
  const service = stubService({ top: ProgressionResult.ok({ entries }), standing: ProgressionResult.ok({ position: 2, score: 80 }) });
  const screen = new LeaderboardScreen(service);
  screen.show();
  await screen.refresh();

  assert.deepEqual(rowsOf(screen), [['1', 'Andrea', '120'], ['2', 'Tobias', '80']]);
  assert.equal(screen.rows.children[1].classList.contains('is-own'), true);
  assert.equal(screen.rows.children[0].classList.contains('is-own'), false);
  assert.equal(screen.table.hidden, false);
  assert.equal(screen.statusMessage.hidden, true);
  assert.equal(screen.ownStanding.textContent, 'Tu posición: #2 con 80 puntos.');
});

test('cambia de modo con las pestañas', async () => {
  const service = stubService({ top: ProgressionResult.ok({ entries: [] }) });
  const screen = new LeaderboardScreen(service);
  screen.show();
  await screen.selectMode('creative');
  assert.equal(screen.mode, 'creative');
  assert.deepEqual(service.calls.slice(-1), ['creative']);
  assert.equal(screen.statusMessage.textContent, 'Todavía no hay puntuaciones en creativo.');
  assert.equal(screen.table.hidden, true);
  assert.match(screen.ownStanding.textContent, /Todavía no figurás/);
});

test('sin servidor lo dice en lugar de mostrar una tabla vacía', async () => {
  const service = stubService({
    top: ProgressionResult.fail(ProgressionResult.Reasons.OFFLINE),
    standing: ProgressionResult.fail(ProgressionResult.Reasons.OFFLINE)
  });
  const screen = new LeaderboardScreen(service);
  screen.show();
  await screen.refresh();
  assert.match(screen.statusMessage.textContent, /No se pudo conectar con el servidor de puntuaciones/);
  assert.equal(screen.ownStanding.textContent, '');
  assert.equal(screen.rows.children.length, 0);

  const without = new LeaderboardScreen(null);
  without.show();
  await without.refresh();
  assert.match(without.statusMessage.textContent, /no está disponible/);
});

test('una respuesta lenta de otra pestaña no pisa la actual', async () => {
  let release;
  const slow = new Promise((resolve) => { release = resolve; });
  const service = {
    currentMode: 'survival',
    currentPlayerId: null,
    top: (mode) => (mode === 'survival' ? slow : Promise.resolve(ProgressionResult.ok({ entries: [] }))),
    standing: async () => ProgressionResult.fail(ProgressionResult.Reasons.OFFLINE)
  };
  const screen = new LeaderboardScreen(service);
  const first = screen.refresh();
  await screen.selectMode('creative');
  release(ProgressionResult.ok({ entries: [{ position: 1, playerId: 'x', name: 'Viejo', score: 1 }] }));
  await first;
  assert.equal(screen.rows.children.length, 0);
  assert.equal(screen.mode, 'creative');
});

test('ScreenType incluye la clasificación', () => {
  assert.equal(ScreenType.LEADERBOARD, 'leaderboard');
});

test('ProgressionUiService lee la tabla y la posición del servidor real', async () => {
  const server = await startTestApi();
  servers.push(server);
  const register = async (name) => (await server.call('POST', '/players', { body: { name } })).body;
  const submit = (token, explored) => server.call('PUT', '/progress', {
    token,
    body: { mode: 'survival', world: defaultWorld().worldKey, revision: 1, state: { version: 1, explored, biomes: [], mined: {}, blocksBuilt: 0 } }
  });
  const andrea = await register('Andrea');
  const tobias = await register('Tobias');
  await submit(andrea.token, [0, 1, 2]);
  await submit(tobias.token, [0]);

  const service = new ProgressionUiService(fakeProgression({ playerId: tobias.playerId }), {
    config: CONFIG,
    apiClient: new ProgressionApiClient(CONFIG, server.fetchFn)
  });
  const top = await service.top('survival');
  assert.equal(top.ok, true);
  assert.deepEqual(top.entries.map((entry) => entry.name), ['Andrea', 'Tobias']);
  const standing = await service.standing('survival');
  assert.deepEqual([standing.position, standing.score], [2, CONFIG.POINTS.EXPLORATION_CELL]);
  assert.equal((await service.top('inexistente')).reason, ProgressionResult.Reasons.INVALID_MODE);

  const empty = await service.top('creative');
  assert.deepEqual(empty.entries, []);
});

test('ProgressionUiService da al perfil la puntuación oficial, el nivel y la posición', () => {
  const pending = new ProgressionUiService(fakeProgression({ score: 30, level: 2 }), { config: CONFIG, apiClient: null });
  assert.equal(pending.getPersonalScore(), 30, 'sin confirmar, la local');
  assert.equal(pending.getPlayerLevel(), 2);
  assert.equal(pending.getLeaderboardRank(), null);

  const synced = new ProgressionUiService(fakeProgression({ score: 30, verifiedScore: 25, rank: 4 }), { config: CONFIG, apiClient: null });
  assert.equal(synced.getPersonalScore(), 25);
  assert.equal(synced.getLeaderboardRank(), 4);
});
