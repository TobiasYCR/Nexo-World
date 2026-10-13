import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { installDomStub, uninstallDomStub, createP5Stub } from './support/domStub.js';
import { PlayerHealth, DamageCauses } from '../src/player/PlayerHealth.js';
import { GameEvents, GameEventTypes } from '../src/game/GameEvents.js';
import { GameConfig } from '../src/game/GameConfig.js';

const SURVIVAL = GameConfig.survival;
const FRAME = 1 / 60;

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
  // Primer frame: el jugador se apoya sobre la superficie del spawn.
  game.update(FRAME);
  return game;
}

/** Registra los eventos de supervivencia emitidos por el juego. */
function recordSurvivalEvents(game) {
  const log = [];
  for (const type of [GameEventTypes.PLAYER_DAMAGED, GameEventTypes.PLAYER_DIED, GameEventTypes.PLAYER_RESPAWNED, GameEventTypes.PLAYER_LANDED]) {
    game.events.on(type, (payload) => log.push({ type, ...payload }));
  }
  return log;
}

/** Suelta al jugador desde `blocks` bloques sobre su posición y simula hasta que aterriza. */
function dropFrom(game, blocks) {
  const { x, y, z } = game.player.position;
  game.player.teleportTo(x, y + blocks * game.world.blockSize, z);
  game.update(FRAME);
  for (let frame = 0; frame < 1200 && !game.player.isOnGround; frame += 1) game.update(FRAME);
  assert.equal(game.player.isOnGround, true, 'el jugador debería aterrizar');
}

test('fallDamageFor: sin daño hasta el umbral y creciente por encima', () => {
  assert.equal(PlayerHealth.fallDamageFor(0, SURVIVAL), 0);
  assert.equal(PlayerHealth.fallDamageFor(SURVIVAL.FALL_DAMAGE_THRESHOLD, SURVIVAL), 0);
  assert.equal(PlayerHealth.fallDamageFor(SURVIVAL.FALL_DAMAGE_THRESHOLD + 1, SURVIVAL), 1);
  assert.ok(PlayerHealth.fallDamageFor(500, SURVIVAL) > PlayerHealth.fallDamageFor(300, SURVIVAL));
  assert.equal(PlayerHealth.fallDamageFor(Number.NaN, SURVIVAL), 0);
});

test('PlayerHealth expone salud actual y máxima, resta vida y emite playerDamaged', () => {
  const events = new GameEvents();
  const damaged = [];
  events.on(GameEventTypes.PLAYER_DAMAGED, (payload) => damaged.push(payload));
  const health = new PlayerHealth(SURVIVAL, events);

  assert.equal(health.current, SURVIVAL.MAX_HEALTH);
  assert.equal(health.max, SURVIVAL.MAX_HEALTH);
  assert.equal(health.damage(4, DamageCauses.FALL), 4);
  assert.equal(health.current, SURVIVAL.MAX_HEALTH - 4);
  assert.deepEqual(damaged, [{ amount: 4, cause: DamageCauses.FALL, health: SURVIVAL.MAX_HEALTH - 4, maxHealth: SURVIVAL.MAX_HEALTH }]);
  assert.equal(health.damage(0, DamageCauses.FALL), 0, 'daño nulo no emite eventos');
  assert.equal(damaged.length, 1);
});

test('la muerte se emite una sola vez y reset la rehabilita', () => {
  const events = new GameEvents();
  const died = [];
  events.on(GameEventTypes.PLAYER_DIED, (payload) => died.push(payload));
  const health = new PlayerHealth(SURVIVAL, events);

  assert.equal(health.damage(SURVIVAL.MAX_HEALTH + 50, DamageCauses.FALL), SURVIVAL.MAX_HEALTH, 'el daño se acota a la vida restante');
  assert.equal(health.isDead, true);
  assert.equal(health.kill(DamageCauses.VOID), false);
  assert.equal(health.damage(3, DamageCauses.FALL), 0);
  assert.deepEqual(died, [{ cause: DamageCauses.FALL }]);

  health.reset();
  assert.equal(health.isDead, false);
  assert.equal(health.current, SURVIVAL.MAX_HEALTH);
  assert.equal(health.kill(DamageCauses.VOID), true);
  assert.equal(died.length, 2);
});

test('una caída pequeña no hace daño', async () => {
  const game = await startGame();
  const log = recordSurvivalEvents(game);
  dropFrom(game, 2);

  assert.equal(game.playerHealth.current, game.playerHealth.max);
  assert.equal(log.filter(({ type }) => type === GameEventTypes.PLAYER_DAMAGED).length, 0);
  const landing = log.find(({ type }) => type === GameEventTypes.PLAYER_LANDED);
  assert.ok(landing.impactSpeed > 0 && landing.impactSpeed < SURVIVAL.FALL_DAMAGE_THRESHOLD);
});

test('una caída alta reduce la salud según la velocidad de impacto', async () => {
  const game = await startGame();
  const log = recordSurvivalEvents(game);
  dropFrom(game, 20);

  const landing = log.find(({ type }) => type === GameEventTypes.PLAYER_LANDED);
  const damage = log.filter(({ type }) => type === GameEventTypes.PLAYER_DAMAGED);
  const expected = PlayerHealth.fallDamageFor(landing.impactSpeed, SURVIVAL);
  assert.ok(landing.impactSpeed > SURVIVAL.FALL_DAMAGE_THRESHOLD);
  assert.equal(damage.length, 1);
  assert.equal(damage[0].amount, expected);
  assert.equal(damage[0].cause, DamageCauses.FALL);
  assert.equal(game.playerHealth.current, game.playerHealth.max - expected);
  assert.ok(game.playerHealth.current > 0, 'veinte bloques no deberían matar con la vida completa');
});

test('caer más alto hace más daño', async () => {
  const game = await startGame();
  dropFrom(game, 10);
  const afterTen = game.playerHealth.max - game.playerHealth.current;
  game.playerHealth.reset();
  dropFrom(game, 25);
  const afterTwentyFive = game.playerHealth.max - game.playerHealth.current;
  assert.ok(afterTen > 0);
  assert.ok(afterTwentyFive > afterTen);
});

test('al perder toda la salud el jugador muere y reaparece en el spawn con vida completa', async () => {
  const game = await startGame();
  const spawn = { ...game.player.position };
  const log = recordSurvivalEvents(game);
  game.playerHealth.damage(game.playerHealth.max - 1, DamageCauses.FALL);

  game.player.teleportTo(spawn.x + 40, spawn.y, spawn.z + 40);
  dropFrom(game, 20);

  const types = log.map(({ type }) => type).filter((type) => type !== GameEventTypes.PLAYER_LANDED);
  assert.deepEqual(types, [GameEventTypes.PLAYER_DAMAGED, GameEventTypes.PLAYER_DAMAGED, GameEventTypes.PLAYER_DIED, GameEventTypes.PLAYER_RESPAWNED]);
  assert.equal(game.playerHealth.isDead, false);
  assert.equal(game.playerHealth.current, game.playerHealth.max);
  assert.equal(game.player.position.x, spawn.x);
  assert.equal(game.player.position.z, spawn.z);
  assert.equal(game.camera.position.y, game.player.eyePosition.y);

  const respawned = log.find(({ type }) => type === GameEventTypes.PLAYER_RESPAWNED);
  assert.equal(respawned.health, game.playerHealth.max);
});

test('caer al vacío mata una sola vez, reaparece y no repite eventos', async () => {
  const game = await startGame();
  const log = recordSurvivalEvents(game);
  game.player.teleportTo(game.player.position.x, game.config.player.VOID_Y - 10, game.player.position.z);

  for (let frame = 0; frame < 120; frame += 1) game.update(FRAME);

  const count = (type) => log.filter((entry) => entry.type === type).length;
  assert.equal(count(GameEventTypes.PLAYER_DIED), 1);
  assert.equal(count(GameEventTypes.PLAYER_RESPAWNED), 1);
  assert.equal(count(GameEventTypes.PLAYER_DAMAGED), 1);
  assert.equal(log.find((entry) => entry.type === GameEventTypes.PLAYER_DIED).cause, DamageCauses.VOID);
  assert.equal(game.playerHealth.current, game.playerHealth.max, 'reaparecer no debe causar daño por caída');
  const feet = game.world.worldToBlock(game.player.position.x, game.player.position.y, game.player.position.z);
  assert.equal(game.world.isSolid(feet.x, feet.y - 1, feet.z), true);
});

test('en pausa no avanza la caída ni la salud', async () => {
  const game = await startGame();
  const log = recordSurvivalEvents(game);
  const { x, y, z } = game.player.position;
  game.player.teleportTo(x, y + 25 * game.world.blockSize, z);
  game.pause();

  const frozenY = game.player.position.y;
  for (let frame = 0; frame < 240; frame += 1) game.update(FRAME);
  assert.equal(game.player.position.y, frozenY);
  assert.equal(game.playerHealth.current, game.playerHealth.max);
  assert.deepEqual(log, []);

  game.player.teleportTo(x, game.config.player.VOID_Y - 10, z);
  game.update(FRAME);
  assert.equal(log.length, 0, 'ni siquiera el vacío actúa en pausa');
});
