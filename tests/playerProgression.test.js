import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { PlayerProgression, SyncStatus } from '../src/progression/PlayerProgression.js';
import { ProgressionApiClient } from '../src/progression/ProgressionApiClient.js';
import { ProgressionLocalStore } from '../src/progression/ProgressionLocalStore.js';
import { GameEvents, GameEventTypes } from '../src/game/GameEvents.js';
import { GameConfig } from '../src/game/GameConfig.js';
import { BlockIds } from '../src/utils/Constants.js';
import { createDefaultBlockRegistry } from '../src/blocks/BlockRegistry.js';
import { startTestApi } from './support/apiServer.js';
import { defaultWorld, findNatural } from './support/progression.js';

const CONFIG = GameConfig.progression;
const POINTS = CONFIG.POINTS;
const registry = createDefaultBlockRegistry();
const servers = [];
after(() => Promise.all(servers.map((server) => server.close())));

/** Storage en memoria con la interfaz de localStorage. */
class MemoryStorage {
  #items = new Map();
  getItem(key) { return this.#items.has(key) ? this.#items.get(key) : null; }
  setItem(key, value) { this.#items.set(key, String(value)); }
  removeItem(key) { this.#items.delete(key); }
}

function client({ server = null, storage = new MemoryStorage(), mode = 'survival', name = 'Tobias' } = {}) {
  const events = new GameEvents();
  const log = [];
  for (const type of [GameEventTypes.SCORE_CHANGED, GameEventTypes.PROGRESS_SYNCED, GameEventTypes.PROGRESS_SYNC_FAILED]) {
    events.on(type, (payload) => log.push({ type, ...payload }));
  }
  const progression = new PlayerProgression({
    config: CONFIG,
    apiClient: new ProgressionApiClient(CONFIG, server ? server.fetchFn : null),
    store: new ProgressionLocalStore(storage),
    events,
    mode,
    playerName: name
  });
  return { progression, events, log, storage };
}

async function startedClient(options) {
  const parts = client(options);
  const { terrain, worldKey } = defaultWorld();
  await parts.progression.start(terrain, worldKey);
  return parts;
}

async function api() {
  const server = await startTestApi();
  servers.push(server);
  return server;
}

function mineOre(events, blockId = BlockIds.COAL_ORE, which = 0) {
  const position = findNatural(defaultWorld().terrain, blockId, which + 1)[which];
  events.emit(GameEventTypes.BLOCK_BROKEN, { position, blockType: registry.get(blockId) });
  return position;
}

test('sin servidor el progreso igual se registra, se guarda localmente y se informa offline', async () => {
  const { progression, events, log, storage } = await startedClient();
  assert.equal(progression.status, SyncStatus.OFFLINE);
  progression.update(0.016, 1, 1);
  mineOre(events);

  const expected = POINTS.EXPLORATION_CELL + POINTS.BIOME_DISCOVERED + POINTS.ORES[BlockIds.COAL_ORE];
  assert.equal(progression.score, expected);
  assert.equal(progression.verifiedScore, null);
  assert.deepEqual(log.filter(({ type }) => type === GameEventTypes.SCORE_CHANGED).map(({ reason }) => reason), ['exploration', 'biome', 'ore']);
  assert.ok(log.some(({ type, reason }) => type === GameEventTypes.PROGRESS_SYNC_FAILED && reason === 'offline'));

  // Volver a entrar: el progreso local se recupera y el mismo mineral no vuelve a sumar.
  const again = await startedClient({ storage });
  assert.equal(again.progression.score, expected);
  mineOre(again.events);
  assert.equal(again.progression.score, expected);
});

test('con servidor registra al invitado, sincroniza y expone puntuación verificada y posición', async () => {
  const server = await api();
  const { progression, events, log } = await startedClient({ server });
  assert.ok(progression.playerId);

  progression.update(0.016, 1, 1);
  mineOre(events, BlockIds.IRON_ORE);
  const result = await progression.flush();
  assert.equal(result.ok, true);
  assert.equal(progression.status, SyncStatus.SYNCED);
  assert.equal(progression.verifiedScore, progression.score);
  assert.equal(progression.rank, 1);
  assert.ok(log.some(({ type }) => type === GameEventTypes.PROGRESS_SYNCED));

  const snapshot = progression.snapshot();
  assert.equal(snapshot.playerName, 'Tobias');
  assert.equal(snapshot.breakdown.total, snapshot.score);
  assert.equal(Object.isFrozen(snapshot), true);
});

test('la sincronización automática respeta el intervalo configurado', async () => {
  const server = await api();
  const { progression, events } = await startedClient({ server });
  mineOre(events);
  progression.update(CONFIG.SYNC_INTERVAL_SECONDS / 2, 1, 1);
  assert.equal(progression.verifiedScore, null, 'todavía no pasó el intervalo');
  progression.update(CONFIG.SYNC_INTERVAL_SECONDS / 2, 1, 1);
  await progression.flush();
  assert.equal(progression.verifiedScore, progression.score);
});

test('el progreso se recupera del servidor en otro navegador con la misma identidad', async () => {
  const server = await api();
  const first = await startedClient({ server });
  first.progression.update(0.016, 1, 1);
  const position = mineOre(first.events, BlockIds.GOLD_ORE);
  await first.progression.flush();

  const otherBrowser = new MemoryStorage();
  new ProgressionLocalStore(otherBrowser).saveIdentity(new ProgressionLocalStore(first.storage).loadIdentity());
  const second = await startedClient({ server, storage: otherBrowser });
  assert.equal(second.progression.score, first.progression.score);
  assert.equal(second.progression.verifiedScore, first.progression.verifiedScore);

  second.events.emit(GameEventTypes.BLOCK_BROKEN, { position, blockType: registry.get(BlockIds.GOLD_ORE) });
  assert.equal(second.progression.score, first.progression.score, 'el mineral recuperado no vuelve a pagar');
});

test('dos sesiones del mismo jugador se unen sin perder ni duplicar progreso', async () => {
  const server = await api();
  const first = await startedClient({ server });
  const identity = new ProgressionLocalStore(first.storage).loadIdentity();
  const otherStorage = new MemoryStorage();
  new ProgressionLocalStore(otherStorage).saveIdentity(identity);
  const second = await startedClient({ server, storage: otherStorage });

  mineOre(first.events, BlockIds.COAL_ORE, 0);
  mineOre(second.events, BlockIds.COAL_ORE, 1);
  assert.equal((await first.progression.flush()).ok, true);
  assert.equal((await second.progression.flush()).ok, true, 'el rechazo por revisión se resuelve uniendo y reenviando');
  assert.equal(second.progression.verifiedScore, 2 * POINTS.ORES[BlockIds.COAL_ORE]);
});

test('una falla de almacenamiento del servidor no pierde el progreso y se reintenta', async () => {
  const server = await api();
  const { progression, events } = await startedClient({ server });
  mineOre(events);
  server.repository.failNextWrite = true;

  const failed = await progression.flush();
  assert.equal(failed.reason, 'storage-error');
  assert.notEqual(progression.status, SyncStatus.SYNCED);
  assert.equal(progression.score, POINTS.ORES[BlockIds.COAL_ORE], 'la puntuación local sigue');

  assert.equal((await progression.flush()).ok, true);
  assert.equal(progression.verifiedScore, POINTS.ORES[BlockIds.COAL_ORE]);
});

test('si el servidor ya no reconoce la identidad se registra una nueva', async () => {
  const server = await api();
  const storage = new MemoryStorage();
  new ProgressionLocalStore(storage).saveIdentity({ playerId: '00000000-0000-4000-8000-000000000001', token: 'x'.repeat(43), name: 'Viejo' });
  const { progression } = await startedClient({ server, storage });
  assert.notEqual(progression.playerId, '00000000-0000-4000-8000-000000000001');
  assert.equal(progression.status === SyncStatus.OFFLINE, false);
});

test('la clasificación y la posición personal se consultan por el contrato público', async () => {
  const server = await api();
  const ana = await startedClient({ server, name: 'Ana' });
  mineOre(ana.events, BlockIds.DIAMOND_ORE);
  await ana.progression.flush();
  const beto = await startedClient({ server, name: 'Beto' });
  mineOre(beto.events, BlockIds.COAL_ORE);
  await beto.progression.flush();

  const board = await beto.progression.getLeaderboard(5);
  assert.equal(board.ok, true);
  assert.deepEqual(board.entries.map(({ name }) => name), ['Ana', 'Beto']);
  const standing = await beto.progression.refreshStanding();
  assert.deepEqual([standing.position, beto.progression.rank], [2, 2]);
  assert.equal((await beto.progression.getLeaderboard(9999)).entries.length, 2, 'el límite se acota');
});

test('el modo creativo tiene su propia clasificación', async () => {
  const server = await api();
  const creative = await startedClient({ server, mode: 'creative', name: 'Creativa' });
  for (let x = 0; x < 50; x += 1) creative.events.emit(GameEventTypes.BLOCK_PLACED, { position: { x, y: 22, z: 2 }, blockType: registry.get(BlockIds.PLANKS) });
  await creative.progression.flush();
  const survival = await startedClient({ server, name: 'Sobreviviente' });
  mineOre(survival.events);
  await survival.progression.flush();

  assert.deepEqual((await survival.progression.getLeaderboard()).entries.map(({ name }) => name), ['Sobreviviente']);
  assert.deepEqual((await creative.progression.getLeaderboard()).entries.map(({ name }) => name), ['Creativa']);
  assert.throws(() => client({ mode: 'hardcore' }), RangeError);
});
