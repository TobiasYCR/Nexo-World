import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { installDomStub, uninstallDomStub, createP5Stub } from './support/domStub.js';
import { BlockIds } from '../src/utils/Constants.js';
import { WorldSeed } from '../src/world/WorldSeed.js';
import { GameModeRules } from '../src/game/GameModeRules.js';
import { GameConfig } from '../src/game/GameConfig.js';
import { SaveManager } from '../src/persistence/SaveManager.js';
import { IntentBus } from '../src/ui/IntentBus.js';

let dom;
let p;
let Game;
let GameUiBridge;

beforeEach(async () => {
  dom = installDomStub();
  // SaveManager usa globalThis.localStorage, que el doble de DOM no define.
  globalThis.localStorage = globalThis.window.localStorage;
  p = createP5Stub();
  ({ Game } = await import('../src/game/Game.js'));
  ({ GameUiBridge } = await import('../src/ui/GameUiBridge.js'));
});

afterEach(() => {
  delete globalThis.localStorage;
  uninstallDomStub();
});

async function startGame() {
  const game = new Game(p);
  await game.start(dom.canvas);
  return game;
}

/** Firma corta del terreno: alturas de una diagonal. */
function terrainSignature(game) {
  const heights = [];
  for (let i = 0; i < game.world.width; i += 3) heights.push(game.world.getSurfaceHeight(i, i));
  return heights.join(',');
}

function frames(game, count, keys = []) {
  for (const code of keys) dom.window.dispatch('keydown', { code });
  for (let i = 0; i < count; i += 1) game.update(1 / 60);
  for (const code of keys) dom.window.dispatch('keyup', { code });
}

test('WorldSeed: números tal cual, texto siempre igual, vacío al azar', () => {
  assert.equal(WorldSeed.from('12345'), 12345);
  assert.equal(WorldSeed.from(7), 7);
  assert.equal(WorldSeed.from('-1'), 0xffffffff);
  assert.equal(WorldSeed.from('casa'), WorldSeed.from('casa'));
  assert.notEqual(WorldSeed.from('casa'), WorldSeed.from('Casa'));
  assert.equal(WorldSeed.from('', () => 0.5), 0x80000000);
  assert.equal(WorldSeed.from(undefined, () => 0), 0);
});

test('GameModeRules: supervivencia y creativo, y rechaza modos inventados', () => {
  const survival = new GameModeRules('survival');
  const creative = new GameModeRules('creative');
  assert.deepEqual([survival.infiniteBlocks, survival.canFly, survival.takesDamage], [false, false, true]);
  assert.deepEqual([creative.infiniteBlocks, creative.canFly, creative.takesDamage], [true, true, false]);
  assert.equal(GameModeRules.isValid('hardcore'), false);
  assert.throws(() => new GameModeRules('hardcore'), RangeError);
});

test('newWorld genera con la semilla pedida y cambia el modo', async () => {
  const game = await startGame();
  const original = terrainSignature(game);

  const first = game.newWorld({ name: 'Prueba', seed: 'nexo', mode: 'creative' });
  assert.equal(first.ok, true);
  assert.equal(first.seed, WorldSeed.from('nexo'));
  assert.deepEqual(game.session, { name: 'Prueba', seed: WorldSeed.from('nexo'), mode: 'creative' });
  assert.equal(game.progression.mode, 'creative');
  assert.equal(game.worldGenerator.seed, WorldSeed.from('nexo'));
  const nexo = terrainSignature(game);
  assert.notEqual(nexo, original);

  game.newWorld({ seed: 'otra', mode: 'survival' });
  game.newWorld({ seed: 'nexo', mode: 'survival' });
  assert.equal(terrainSignature(game), nexo, 'la misma semilla da el mismo terreno');

  assert.equal(game.newWorld({ mode: 'hardcore' }).ok, false);
  assert.equal(game.session.mode, 'survival', 'un modo inválido no cambia nada');
});

test('en creativo los bloques no se gastan, no hay daño y se vuela con F', async () => {
  const game = await startGame();
  game.newWorld({ seed: 1, mode: 'creative' });
  assert.equal(game.blockInteraction.infiniteBlocks, true);
  assert.ok(game.hotbar.slots.filter((slot) => !slot.isEmpty).length > 5, 'hotbar con todos los bloques');

  // Colocar no descuenta.
  const slot = game.hotbar.getSlot(0);
  const before = slot.count;
  const eye = game.player.eyePosition;
  const eyeBlock = game.world.worldToBlock(eye.x, eye.y, eye.z);
  game.world.setBlockId(eyeBlock.x, eyeBlock.y, eyeBlock.z - 1, BlockIds.AIR);
  game.world.setBlockId(eyeBlock.x, eyeBlock.y, eyeBlock.z - 2, BlockIds.STONE);
  dom.canvas.requestPointerLock();
  game.hotbar.select(0);
  dom.canvas.dispatch('mousedown', { button: 2 });
  game.update(1 / 60);
  assert.equal(game.world.getBlockId(eyeBlock.x, eyeBlock.y, eyeBlock.z - 1), slot.blockType.id);
  assert.equal(game.hotbar.getSlot(0).count, before);

  // Sin daño por caída.
  game.playerHealth.reset();
  game.player.teleportTo(game.player.position.x, game.player.position.y + 400, game.player.position.z);
  frames(game, 240);
  assert.equal(game.playerHealth.current, game.playerHealth.max);

  // F activa el vuelo; Espacio sube y la gravedad no lo baja.
  frames(game, 1, ['KeyF']);
  assert.equal(game.player.isFlying, true);
  const groundY = game.player.position.y;
  frames(game, 30, ['Space']);
  assert.ok(game.player.position.y > groundY + 20, 'sube con Espacio');
  const flyingY = game.player.position.y;
  frames(game, 30);
  assert.ok(Math.abs(game.player.position.y - flyingY) < 0.001, 'quieto en el aire');
  // No se puede volar sin límite fuera del mundo.
  frames(game, 600, ['Space']);
  const ceiling = (game.world.height + GameConfig.player.FLY_CEILING_ABOVE_WORLD) * game.world.blockSize;
  assert.ok(game.player.position.y <= ceiling + 0.001, `subió hasta ${game.player.position.y}`);
  assert.ok(game.player.position.y > ceiling - game.world.blockSize);
  frames(game, 1, ['KeyF']);
  assert.equal(game.player.isFlying, false);
});

test('en supervivencia F no vuela y la caída lastima', async () => {
  const game = await startGame();
  game.newWorld({ seed: 1, mode: 'survival' });
  frames(game, 1, ['KeyF']);
  assert.equal(game.player.isFlying, false);
  game.player.teleportTo(game.player.position.x, game.player.position.y + 400, game.player.position.z);
  frames(game, 240);
  assert.ok(game.playerHealth.current < game.playerHealth.max);
});

test('guardar y cargar conserva semilla, modo y el plano en curso', async () => {
  const game = await startGame();
  game.newWorld({ name: 'Casa', seed: 'casa', mode: 'creative' });
  const started = game.buildChallenge.start('wood-house');
  assert.equal(started.ok, true, started.message);
  const { position, blockId } = started.snapshot.nextBlock;
  game.world.setBlockId(position.x, position.y, position.z, blockId);
  game.buildChallenge.refresh();
  const signature = terrainSignature(game);
  assert.equal(game.saveGame('Casa').ok, true);

  game.newWorld({ seed: 'otra', mode: 'survival' });
  assert.equal(game.buildChallenge.snapshot(), null);

  const loaded = game.loadGame('Casa');
  assert.equal(loaded.ok, true);
  assert.deepEqual(game.session, { name: 'Casa', seed: WorldSeed.from('casa'), mode: 'creative' });
  assert.equal(game.progression.mode, 'creative');
  assert.equal(game.blockInteraction.infiniteBlocks, true);
  assert.equal(terrainSignature(game), signature);
  const restored = game.buildChallenge.snapshot();
  assert.equal(restored.blueprintId, 'wood-house');
  assert.equal(restored.placed, 1, 'el progreso sale de los bloques guardados');
});

test('un guardado sin datos de partida (formato anterior) se sigue cargando', async () => {
  const game = await startGame();
  const manager = new SaveManager();
  assert.equal(manager.save('viejo', game.world, game.player).ok, true);
  const raw = JSON.parse(globalThis.localStorage.getItem(`${SaveManager.STORAGE_PREFIX}viejo`));
  delete raw.meta;
  globalThis.localStorage.setItem(`${SaveManager.STORAGE_PREFIX}viejo`, JSON.stringify(raw));

  const session = game.session;
  const result = game.loadGame('viejo');
  assert.equal(result.ok, true);
  assert.equal(result.meta, null);
  assert.equal(game.session.seed, session.seed);
  assert.equal(game.session.mode, session.mode);
});

test('crear mundo desde la interfaz usa nombre, semilla y modo, y lo guarda', async () => {
  const game = await startGame();
  const bridge = new GameUiBridge(game, game.hud, game.hud.intentBus);
  assert.ok(bridge);
  game.hud.intentBus.emit(IntentBus.Events.CREATE_WORLD, { name: 'Mi isla', seed: '2024', gameMode: 'creative' });
  game.hud.intentBus.emit(IntentBus.Events.SAVE_GAME, { slot: 'Mi isla' });
  assert.deepEqual(game.session, { name: 'Mi isla', seed: 2024, mode: 'creative' });
  assert.equal(new SaveManager().exists('Mi isla'), true);
});

test('las reglas de modo salen de la configuración', () => {
  assert.equal(new GameModeRules('creative').breakSeconds, GameConfig.modes.creative.BREAK_SECONDS);
});

test('si el mundo no se puede crear, el puente devuelve el motivo y no se guarda', async () => {
  const game = await startGame();
  new GameUiBridge(game, game.hud, game.hud.intentBus);
  const request = { name: 'Roto', seed: '1', gameMode: 'hardcore', result: null };
  game.hud.intentBus.emit(IntentBus.Events.CREATE_WORLD, request);
  assert.equal(request.result.ok, false);
  assert.equal(new SaveManager().exists('Roto'), false);
});

test('un plano terminado no se retoma al cargar la partida', async () => {
  const game = await startGame();
  game.newWorld({ name: 'Hecha', seed: 'hecha', mode: 'creative' });
  let snapshot = game.buildChallenge.start('stone-tower').snapshot;
  const state = game.buildChallenge.exportState();
  while (snapshot?.nextBlock) {
    const { position, blockId } = snapshot.nextBlock;
    game.world.setBlockId(position.x, position.y, position.z, blockId);
    snapshot = game.buildChallenge.refresh();
  }
  assert.equal(game.buildChallenge.isActive, false);
  assert.equal(game.buildChallenge.restoreState(state).reason, 'alreadyCompleted');
  assert.equal(game.buildChallenge.isActive, false);
});
