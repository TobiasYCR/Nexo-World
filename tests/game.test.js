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
  assert.equal(p.calls.camera, 2, 'el overlay de la mano aplica su cámara fija');
  assert.ok(p.calls.box > 0, 'el renderer debería emitir geometría');
  assert.ok(p.calls.box >= game.renderer.stats.renderedBlocks + 1, 'la mano añade geometría al mundo');
  assert.equal(p.calls.clearDepth, 1);
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

test('la hotbar inicia con pilas de los bloques starter y deja ranuras libres para lo recolectado', async () => {
  const game = await startGame();
  game.update(1 / 60);
  const starterTypes = game.blockRegistry.starterTypes();

  assert.deepEqual(starterTypes.map((type) => type.name), ['Grass', 'Dirt', 'Stone', 'Planks', 'Glass']);
  assert.ok(starterTypes.length < game.hotbar.size, 'debe quedar lugar para minerales y otros drops');
  for (let index = 0; index < starterTypes.length; index += 1) {
    const slot = game.hotbar.getSlot(index);
    assert.equal(slot.blockType, starterTypes[index]);
    assert.equal(slot.count, game.config.inventory.STARTER_BLOCK_COUNT);
    assert.equal(game.hud.hotbarView.barElement.children[index].children[2].textContent, '64');
  }
  for (let index = starterTypes.length; index < game.hotbar.size; index += 1) {
    assert.equal(game.hotbar.getSlot(index).isEmpty, true);
    assert.equal(game.hud.hotbarView.barElement.children[index].children[1].hidden, true);
  }
});

test('la cantidad de la hotbar visible se actualiza después de colocar un bloque', async () => {
  const game = await startGame();
  game.update(1 / 60);
  const target = plantBlockInView(game);
  const adjacent = { x: target.x, y: target.y, z: target.z + 1 };
  const grassType = game.blockRegistry.get(BlockIds.GRASS);
  const grassIndex = hotbarIndexOf(game, grassType);
  game.hotbar.select(grassIndex);

  dom.canvas.requestPointerLock();
  dom.canvas.dispatch('mousedown', { button: 2 });
  game.update(1 / 60);

  assert.equal(game.hotbar.getSlot(grassIndex).count, game.config.inventory.STARTER_BLOCK_COUNT - 1);
  assert.equal(game.hud.hotbarView.barElement.children[grassIndex].children[2].textContent, '63');
  assert.equal(game.world.getBlockId(adjacent.x, adjacent.y, adjacent.z), grassType.id);
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

/** Ranura de la hotbar que contiene el tipo de bloque, o -1. */
function hotbarIndexOf(game, blockType) {
  return game.hotbar.slots.findIndex((slot) => slot.blockType === blockType);
}

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
  const frameDelta = 1 / 60;
  const maxBreakFrames = Math.ceil(
    (game.blockRegistry.get(BlockIds.STONE).hardness *
      game.config.viewmodel.breakOverlay.BREAK_DURATION_PER_HARDNESS) /
      frameDelta
  ) + 10;
  for (
    let frame = 0;
    frame < maxBreakFrames && game.world.getBlockId(target.x, target.y, target.z) === BlockIds.STONE;
    frame += 1
  ) {
    game.update(1 / 60);
  }

  assert.equal(game.world.getBlockId(target.x, target.y, target.z), BlockIds.AIR);
  assert.ok(game.hotbar.countOf(game.blockRegistry.get(BlockIds.COBBLESTONE)) >= 1, 'piedra dropea piedra partida');
  assert.ok(game.blockParticles.activeCount > 0, 'romper crea partículas visuales');
  dom.window.dispatch('mouseup', { button: 0 });
  game.update(1 / 60);
  assert.ok(game.handRenderer.swingAmount > 0, 'romper dispara el swing');
});

test('el progreso de rotura se refleja y se reinicia al soltar', async () => {
  const game = await startGame();
  const target = plantBlockInView(game);
  dom.canvas.requestPointerLock();
  dom.canvas.dispatch('mousedown', { button: 0 });
  game.update(0.1);

  assert.equal(game.renderer.overlays.size, 5, 'el efecto de subida de nivel se registra como overlay adicional');
  assert.deepEqual(
    { x: game.blockHighlight.targetedBlock.x, y: game.blockHighlight.targetedBlock.y, z: game.blockHighlight.targetedBlock.z },
    target
  );
  assert.deepEqual(
    { x: game.breakOverlay.breakingBlock.x, y: game.breakOverlay.breakingBlock.y, z: game.breakOverlay.breakingBlock.z },
    target
  );
  assert.equal(
    game.breakOverlay.stage,
    Math.floor((0.1 / (game.blockRegistry.get(BlockIds.STONE).hardness * game.config.viewmodel.breakOverlay.BREAK_DURATION_PER_HARDNESS)) * 10)
  );

  dom.window.dispatch('mouseup', { button: 0 });
  game.update(1 / 60);
  assert.equal(game.breakOverlay.stage, -1, 'al soltar el botón desaparece la grieta');
});

test('la rueda cambia cíclicamente el slot activo del hotbar', async () => {
  const game = await startGame();
  dom.canvas.dispatch('wheel', { deltaY: 1 });
  game.update(1 / 60);
  assert.equal(game.hotbar.selectedIndex, 1);
});

test('colocar con clic derecho agrega el bloque en la celda adyacente', async () => {
  const game = await startGame();
  const target = plantBlockInView(game);
  // La cara golpeada mira hacia +Z: la celda adyacente q=15 es aire.
  const stoneSlot = hotbarIndexOf(game, game.blockRegistry.get(BlockIds.STONE));
  game.hotbar.select(stoneSlot);

  dom.canvas.requestPointerLock();
  dom.canvas.dispatch('mousedown', { button: 2 });
  game.update(1 / 60);

  const adjacent = { x: target.x, y: target.y, z: target.z + 1 };
  assert.equal(game.world.getBlockId(adjacent.x, adjacent.y, adjacent.z), BlockIds.STONE);
  assert.equal(game.world.getBlockId(target.x, target.y, target.z), BlockIds.STONE, 'el bloque apuntado no se ve afectado');
  game.update(1 / 60);
  assert.ok(game.handRenderer.swingAmount > 0, 'colocar dispara el swing');
});

test('pause/resume detienen la simulacion y exponen isPaused', async () => {
  const game = await startGame();
  dom.canvas.requestPointerLock();
  dom.window.dispatch('keydown', { code: 'KeyW' });
  game.pause();

  const pausedZ = game.player.position.z;
  game.update(0.2);
  assert.equal(game.isPaused, true);
  assert.equal(game.player.position.z, pausedZ);

  game.resume();
  game.update(0.2);
  assert.equal(game.isPaused, false);
  assert.notEqual(game.player.position.z, pausedZ);
});

test('caer por debajo de VOID_Y reaparece al jugador en la superficie del spawn', async () => {
  const game = await startGame();
  game.player.teleportTo(game.player.position.x, game.config.player.VOID_Y - 10, game.player.position.z);
  game.update(1 / 60);

  const feet = game.world.worldToBlock(game.player.position.x, game.player.position.y, game.player.position.z);
  assert.equal(game.world.isSolid(feet.x, feet.y - 1, feet.z), true);
  assert.equal(game.camera.position.y, game.player.eyePosition.y);
});

test('Game emite eventos de rotura, progreso y colocacion', async () => {
  const game = await startGame();
  const events = [];
  game.events.on('breakProgress', ({ progress }) => events.push(['progress', progress]));
  game.events.on('blockBroken', ({ blockType }) => events.push(['broken', blockType.id]));
  game.events.on('blockPlaced', ({ blockType }) => events.push(['placed', blockType.id]));

  const target = plantBlockInView(game);
  dom.canvas.requestPointerLock();
  dom.canvas.dispatch('mousedown', { button: 0 });
  for (let frame = 0; frame < 60 && game.world.getBlockId(target.x, target.y, target.z) !== BlockIds.AIR; frame += 1) {
    game.update(1 / 60);
  }
  dom.window.dispatch('mouseup', { button: 0 });

  const cobbleSlot = hotbarIndexOf(game, game.blockRegistry.get(BlockIds.COBBLESTONE));
  assert.ok(cobbleSlot >= 0, 'la piedra partida recolectada ocupa una ranura libre');
  game.hotbar.select(cobbleSlot);
  plantBlockInView(game);
  dom.canvas.dispatch('mousedown', { button: 2 });
  game.update(1 / 60);

  assert.ok(events.some(([type, progress]) => type === 'progress' && progress > 0));
  assert.ok(events.some(([type, id]) => type === 'broken' && id === BlockIds.STONE));
  assert.ok(events.some(([type, id]) => type === 'placed' && id === BlockIds.COBBLESTONE));
});

test('saveGame/loadGame devuelven SaveResult y sincronizan camara', async () => {
  const storage = new Map();
  globalThis.localStorage = {
    getItem: (key) => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, value),
    removeItem: (key) => storage.delete(key)
  };

  try {
    const game = await startGame();
    const originalX = game.player.position.x;
    const saved = game.saveGame('slot-a');
    assert.equal(saved.ok, true);

    game.player.teleportTo(originalX + 40, game.player.position.y + 20, game.player.position.z);
    const loaded = game.loadGame('slot-a');
    assert.equal(loaded.ok, true);
    assert.equal(game.player.position.x, originalX);
    assert.equal(game.camera.position.y, game.player.eyePosition.y);
  } finally {
    delete globalThis.localStorage;
  }
});
