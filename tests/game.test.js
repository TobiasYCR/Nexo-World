import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { installDomStub, uninstallDomStub, createP5Stub } from './support/domStub.js';
import { GameStates } from '../src/game/GameState.js';
import { InputActions } from '../src/utils/Constants.js';

let dom;
let p;
let Game;

beforeEach(async () => {
  dom = installDomStub();
  p = createP5Stub();
  ({ Game } = await import('../src/game/Game.js'));
});

afterEach(() => uninstallDomStub());

async function startGame() {
  const game = new Game(p);
  await game.start(dom.canvas);
  return game;
}

test('start deja el juego corriendo con el mundo generado', async () => {
  const game = await startGame();
  assert.equal(game.state.current, GameStates.RUNNING);
  assert.ok(game.world.chunkCount > 0);
});

test('el jugador aparece apoyado sobre la superficie del terreno', async () => {
  const game = await startGame();
  const feet = game.world.worldToBlock(
    game.player.position.x,
    game.player.position.y,
    game.player.position.z
  );
  assert.equal(game.world.getBlockId(feet.x, feet.y, feet.z), 0);
  assert.equal(game.world.isSolid(feet.x, feet.y - 1, feet.z), true);
});

test('un frame completo dibuja bloques sin lanzar excepciones', async () => {
  const game = await startGame();
  game.update(1 / 60);
  game.render();

  assert.equal(p.calls.background, 1);
  assert.equal(p.calls.camera, 1);
  assert.ok(p.calls.box > 0, 'el renderer debería emitir geometría');
  assert.equal(p.calls.box, game.renderer.stats.renderedBlocks);
});

test('el recorte por distancia y por oclusión reduce los bloques dibujados', async () => {
  const game = await startGame();
  game.update(1 / 60);
  game.render();

  let totalSolid = 0;
  game.world.forEachSolidBlock(() => { totalSolid += 1; });
  assert.ok(game.renderer.stats.renderedBlocks < totalSolid);
});

test('la pausa se alterna con la acción correspondiente', async () => {
  const game = await startGame();
  dom.window.dispatch('keydown', { code: 'Escape' });
  game.update(1 / 60);
  assert.equal(game.state.current, GameStates.PAUSED);
});

test('el movimiento solo se aplica mientras el juego corre', async () => {
  const game = await startGame();
  dom.canvas.requestPointerLock();
  dom.window.dispatch('keydown', { code: 'KeyW' });

  const startZ = game.player.position.z;
  game.update(0.1);
  assert.notEqual(game.player.position.z, startZ);

  game.togglePause();
  const pausedZ = game.player.position.z;
  game.update(0.1);
  assert.equal(game.player.position.z, pausedZ);
});

test('las teclas 1-9 seleccionan slots de la hotbar', async () => {
  const game = await startGame();
  dom.window.dispatch('keydown', { code: 'Digit3' });
  game.update(1 / 60);
  assert.equal(game.hotbar.selectedIndex, 2);
});

test('la cámara sigue a los ojos del jugador', async () => {
  const game = await startGame();
  game.update(1 / 60);
  assert.equal(game.camera.position.y, game.player.position.y + game.player.config.EYE_HEIGHT);
});

test('el overlay de depuración se alterna con la acción de debug', async () => {
  const game = await startGame();
  const visibleAtStart = game.hud.debugOverlay.isVisible;
  dom.window.dispatch('keydown', { code: 'F3' });
  game.update(1 / 60);
  assert.equal(game.hud.debugOverlay.isVisible, !visibleAtStart);
});

test('las acciones de un frame no persisten al siguiente', async () => {
  const game = await startGame();
  dom.window.dispatch('keydown', { code: 'F3' });
  game.update(1 / 60);
  const afterFirst = game.hud.debugOverlay.isVisible;
  game.update(1 / 60);
  assert.equal(game.hud.debugOverlay.isVisible, afterFirst);
  assert.equal(game.input.wasActionJustPressed(InputActions.TOGGLE_DEBUG), false);
});
