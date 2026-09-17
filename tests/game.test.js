import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { installDomStub, uninstallDomStub, createP5Stub } from './support/domStub.js';
import { GameStates } from '../src/game/GameState.js';
import { InputActions, BlockIds } from '../src/utils/Constants.js';

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

/** Planta piedra en la celda que apunta la mirada inicial (hacia -Z). */
function plantBlockInView(game) {
  const eye = game.player.eyePosition;
  const eyeBlock = game.world.worldToBlock(eye.x, eye.y, eye.z);
  // Limpia el camino del rayo para que el primer sólido sea el bloque plantado.
  game.world.setBlockId(eyeBlock.x, eyeBlock.y, eyeBlock.z - 1, BlockIds.AIR);
  const target = { x: eyeBlock.x, y: eyeBlock.y, z: eyeBlock.z - 2 };
  game.world.setBlockId(target.x, target.y, target.z, BlockIds.STONE);
  return target;
}

test('el movimiento W es relativo a la orientación de la cámara', async () => {
  const game = await startGame();
  dom.canvas.requestPointerLock();

  // Mirando a -Z (yaw 0), W debe empujar hacia -Z.
  dom.window.dispatch('keydown', { code: 'KeyW' });
  const startZ = game.player.position.z;
  game.update(0.1);
  assert.ok(game.player.position.z < startZ, 'W avanza hacia donde mira la cámara');

  // Giro de 180° sobre el eje vertical: W debe invertir el sentido en el mundo.
  const halfTurn = Math.PI / game.playerController.camera.config.MOUSE_SENSITIVITY;
  game.playerController.camera.rotate(halfTurn, 0);
  const turnZ = game.player.position.z;
  game.update(0.1);
  assert.ok(game.player.position.z > turnZ, 'tras girar 180°, W avanza en sentido opuesto');
});

test('el primer clic sin puntero capturado no rompe bloques', async () => {
  const game = await startGame();
  const target = plantBlockInView(game);

  dom.canvas.dispatch('mousedown', { button: 0 });
  game.update(1 / 60);
  assert.equal(game.world.getBlockId(target.x, target.y, target.z), BlockIds.STONE, 'el clic de captura no debe romper');
});

test('romper requiere y respeta el puntero capturado', async () => {
  const game = await startGame();
  const target = plantBlockInView(game);

  dom.canvas.requestPointerLock();
  dom.canvas.dispatch('mousedown', { button: 0 });
  game.update(1 / 60);

  assert.equal(game.world.getBlockId(target.x, target.y, target.z), BlockIds.AIR);
  assert.ok(game.hotbar.countOf(game.blockRegistry.get(BlockIds.STONE)) >= 1, 'el bloque roto entra al hotbar');
});

test('colocar con clic derecho agrega el bloque en la celda adyacente', async () => {
  const game = await startGame();
  const target = plantBlockInView(game);
  // La cara golpeada mira hacia +Z: la celda adyacente q=15 es aire.
  const stoneSlot = game.blockRegistry.placeableTypes().indexOf(game.blockRegistry.get(BlockIds.STONE));
  game.hotbar.select(stoneSlot);

  dom.canvas.requestPointerLock();
  dom.canvas.dispatch('mousedown', { button: 2 });
  game.update(1 / 60);

  const adjacent = { x: target.x, y: target.y, z: target.z + 1 };
  assert.equal(game.world.getBlockId(adjacent.x, adjacent.y, adjacent.z), BlockIds.STONE);
  assert.equal(game.world.getBlockId(target.x, target.y, target.z), BlockIds.STONE, 'el bloque apuntado no se ve afectado');
});
