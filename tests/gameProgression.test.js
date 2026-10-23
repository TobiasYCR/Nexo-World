import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { installDomStub, uninstallDomStub, createP5Stub } from './support/domStub.js';
import { GameEventTypes } from '../src/game/GameEvents.js';
import { GameConfig } from '../src/game/GameConfig.js';
import { BlockIds } from '../src/utils/Constants.js';
import { WorldKey } from '../src/progression/WorldKey.js';
import { findNatural } from './support/progression.js';

let dom;
let Game;

beforeEach(async () => {
  dom = installDomStub();
  ({ Game } = await import('../src/game/Game.js'));
});

afterEach(() => uninstallDomStub());

async function startGame() {
  const game = new Game(createP5Stub());
  await game.start(dom.canvas);
  await game.progression.ready;
  return game;
}

/** Rompe un bloque del mundo por el camino real de BlockInteraction. */
function breakAt(game, position) {
  game.blockInteraction.hit = { block: { ...position } };
  return game.blockInteraction.tryBreak();
}

test('Game registra el progreso del mundo generado y lo identifica por semilla y versión', async () => {
  const game = await startGame();
  assert.equal(game.progression.worldKey, WorldKey.fromGenerator(game.worldGenerator, game.world));
  assert.equal(game.naturalTerrain.width, game.world.width);
  game.update(1 / 60);
  assert.ok(game.progression.score >= GameConfig.progression.POINTS.EXPLORATION_CELL + GameConfig.progression.POINTS.BIOME_DISCOVERED,
    'la celda y el bioma del spawn cuentan como descubiertos');
});

test('minar un mineral natural en el juego suma puntos y emite scoreChanged', async () => {
  const game = await startGame();
  const changes = [];
  game.events.on(GameEventTypes.SCORE_CHANGED, (change) => changes.push(change));
  const [diamond] = findNatural(game.naturalTerrain, BlockIds.DIAMOND_ORE);

  const before = game.progression.score;
  assert.equal(breakAt(game, diamond), true);
  assert.equal(game.progression.score - before, GameConfig.progression.POINTS.ORES[BlockIds.DIAMOND_ORE]);
  assert.deepEqual(changes.map(({ reason }) => reason), ['ore']);
  assert.ok(game.hotbar.countOf(game.blockRegistry.get(BlockIds.DIAMOND_ORE)) >= 1, 'el drop sigue funcionando');
});

test('en pausa la progresión no avanza', async () => {
  const game = await startGame();
  game.update(1 / 60);
  const score = game.progression.score;
  game.pause();
  game.player.teleportTo(game.world.width * game.world.blockSize - 10, game.player.position.y, 10);
  for (let frame = 0; frame < 30; frame += 1) game.update(1 / 60);
  assert.equal(game.progression.score, score);
});

test('sin servidor el juego sigue funcionando y la progresión queda offline', async () => {
  const game = await startGame();
  assert.equal(game.progression.status, 'offline');
  game.update(1 / 60);
  game.render();
  assert.equal(game.state.isRunning, true);
});
