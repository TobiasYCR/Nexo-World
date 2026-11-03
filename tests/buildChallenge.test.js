import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Blueprint } from '../src/education/Blueprint.js';
import { BlueprintRegistry, createDefaultBlueprintRegistry } from '../src/education/BlueprintRegistry.js';
import { BuildChallenge } from '../src/education/BuildChallenge.js';
import { BlueprintGhost } from '../src/viewmodel/BlueprintGhost.js';
import { ChallengeCompleteEffect } from '../src/viewmodel/ChallengeCompleteEffect.js';
import { BlockIds } from '../src/utils/Constants.js';
import { createDefaultBlockRegistry } from '../src/blocks/BlockRegistry.js';
import { World } from '../src/world/World.js';
import { Player } from '../src/player/Player.js';
import { FirstPersonCamera } from '../src/camera/FirstPersonCamera.js';
import { GameEvents, GameEventTypes } from '../src/game/GameEvents.js';
import { GameConfig } from '../src/game/GameConfig.js';
import { createP5Stub } from './support/domStub.js';

const CONFIG = {
  ...GameConfig,
  world: {
    ...GameConfig.world,
    WORLD_WIDTH: 16,
    WORLD_HEIGHT: 12,
    WORLD_DEPTH: 16
  },
  education: {
    ...GameConfig.education,
    PLACEMENT_DISTANCE_BLOCKS: 1,
    MAX_BLUEPRINT_BLOCKS: 32
  }
};

function harness() {
  const blockRegistry = createDefaultBlockRegistry();
  const world = new World(blockRegistry, CONFIG);
  const player = new Player({ ...CONFIG.player, SPAWN: { x: 8 * 20 + 10, y: 20, z: 8 * 20 + 10 } });
  const camera = new FirstPersonCamera(CONFIG.camera);
  const events = new GameEvents();
  const blueprintRegistry = new BlueprintRegistry(blockRegistry, CONFIG.education.MAX_BLUEPRINT_BLOCKS);
  blueprintRegistry.register({
    id: 'line',
    name: 'Línea',
    description: 'Dos bloques en línea.',
    blocks: [
      { x: 0, y: 0, z: 0, blockId: BlockIds.PLANKS },
      { x: 1, y: 0, z: 0, blockId: BlockIds.PLANKS }
    ]
  });
  blueprintRegistry.register({
    id: 'single',
    name: 'Bloque único',
    description: 'Un bloque.',
    blocks: [{ x: 0, y: 0, z: 0, blockId: BlockIds.PLANKS }]
  });
  const challenge = new BuildChallenge({
    world,
    player,
    camera,
    blueprintRegistry,
    blockRegistry,
    events,
    config: CONFIG.education
  });
  return { blockRegistry, world, player, camera, events, blueprintRegistry, challenge };
}

function positionOf(snapshot, index = 0) {
  const block = snapshot.blocks[index];
  return { x: block.x, y: block.y, z: block.z };
}

test('los planos validan tipos inexistentes y posiciones repetidas', () => {
  const registry = createDefaultBlockRegistry();
  assert.throws(() => new Blueprint({
    id: 'bad-type',
    name: 'Inválido',
    blocks: [{ x: 0, y: 0, z: 0, blockId: 999 }]
  }, registry), /tipo de bloque inexistente/);
  assert.throws(() => new Blueprint({
    id: 'duplicate',
    name: 'Repetido',
    blocks: [
      { x: 0, y: 0, z: 0, blockId: BlockIds.PLANKS },
      { x: 0, y: 0, z: 0, blockId: BlockIds.STONE }
    ]
  }, registry), /posición repetida/);
});

test('el registro por defecto expone tres planos válidos', () => {
  const blockRegistry = createDefaultBlockRegistry();
  const registry = createDefaultBlueprintRegistry(blockRegistry, GameConfig.education);
  const summaries = registry.summaries();
  assert.deepEqual(summaries.map(({ id }) => id), ['wood-house', 'stone-tower', 'river-bridge']);
  assert.ok(registry.get('wood-house').blocks.length < registry.get('stone-tower').blocks.length);
  assert.ok(registry.get('stone-tower').blocks.length < registry.get('river-bridge').blocks.length);
});

test('la ubicación rota el plano en las cuatro direcciones', () => {
  const { challenge, camera } = harness();
  const rotations = [];
  for (let rotation = 0; rotation < 4; rotation += 1) {
    camera.yaw = rotation * Math.PI / 2;
    const result = challenge.start('line');
    assert.equal(result.ok, true);
    rotations.push(result.snapshot.blocks.map(({ x, z }) => `${x},${z}`));
  }
  assert.deepEqual(rotations.map((positions) => {
    const [firstX, firstZ] = positions[0].split(',').map(Number);
    const [secondX, secondZ] = positions[1].split(',').map(Number);
    return firstX !== secondX;
  }), [true, false, true, false]);
  assert.deepEqual(rotations.map((positions) => positions.join('|')), [
    '7,7|8,7',
    '9,7|9,8',
    '7,9|8,9',
    '7,7|7,8'
  ]);
});

test('rechaza un plano fuera del mundo y uno que choca con un bloque irrompible', () => {
  const { challenge, camera, world } = harness();
  challenge.player.teleportTo(10, 20, 10);
  const outside = challenge.start('single');
  assert.equal(outside.ok, false);
  assert.equal(outside.reason, 'outOfBounds');

  challenge.player.teleportTo(8 * 20 + 10, 20, 8 * 20 + 10);
  camera.yaw = 0;
  const expected = { x: 7, y: 0, z: 7 };
  world.setBlockId(expected.x, expected.y, expected.z, BlockIds.BEDROCK);
  const blocked = challenge.start('line');
  assert.equal(blocked.ok, false);
  assert.equal(blocked.reason, 'unbreakableCollision');
});

test('verifica correctos, incorrectos, roturas y bloques ajenos al plano', () => {
  const { challenge, world, events } = harness();
  const started = challenge.start('single');
  assert.equal(started.ok, true);
  const position = positionOf(started.snapshot);
  let completed = 0;
  events.on(GameEventTypes.BUILD_CHALLENGE_COMPLETED, () => { completed += 1; });

  world.setBlockId(position.x, position.y, position.z, BlockIds.STONE);
  events.emit(GameEventTypes.BLOCK_PLACED, { position });
  assert.equal(challenge.snapshot().wrong, 1);
  assert.equal(challenge.snapshot().completed, false);

  world.setBlockId(position.x, position.y, position.z, BlockIds.AIR);
  events.emit(GameEventTypes.BLOCK_BROKEN, { position });
  assert.equal(challenge.snapshot().placed, 0);

  world.setBlockId(1, 1, 1, BlockIds.STONE);
  events.emit(GameEventTypes.BLOCK_PLACED, { position: { x: 1, y: 1, z: 1 } });
  assert.equal(challenge.snapshot().placed, 0);

  world.setBlockId(position.x, position.y, position.z, BlockIds.PLANKS);
  events.emit(GameEventTypes.BLOCK_PLACED, { position });
  events.emit(GameEventTypes.BLOCK_PLACED, { position });
  assert.equal(challenge.snapshot().completed, true);
  assert.equal(completed, 1);
});

test('un bloque incorrecto impide completar hasta corregirlo', () => {
  const { challenge, world, events } = harness();
  const started = challenge.start('line');
  const first = positionOf(started.snapshot, 0);
  const second = positionOf(started.snapshot, 1);

  world.setBlockId(first.x, first.y, first.z, BlockIds.PLANKS);
  events.emit(GameEventTypes.BLOCK_PLACED, { position: first });
  world.setBlockId(second.x, second.y, second.z, BlockIds.STONE);
  events.emit(GameEventTypes.BLOCK_PLACED, { position: second });
  assert.equal(challenge.snapshot().placed, 1);
  assert.equal(challenge.snapshot().wrong, 1);
  assert.equal(challenge.snapshot().completed, false);

  world.setBlockId(second.x, second.y, second.z, BlockIds.PLANKS);
  events.emit(GameEventTypes.BLOCK_PLACED, { position: second });
  assert.equal(challenge.snapshot().completed, true);
});

test('iniciar otro desafío reemplaza al activo y emite cancelación', () => {
  const { challenge, events } = harness();
  let cancelled = 0;
  events.on(GameEventTypes.BUILD_CHALLENGE_CANCELLED, () => { cancelled += 1; });
  assert.equal(challenge.start('single').ok, true);
  assert.equal(challenge.start('line').ok, true);
  assert.equal(cancelled, 1);
  assert.equal(challenge.snapshot().blueprintId, 'line');
});

test('la guía rehace geometría solo cuando cambia el desafío y puede ocultarse', () => {
  const p = createP5Stub();
  const blockRegistry = createDefaultBlockRegistry();
  const ghost = new BlueprintGhost({ p, blockRegistry, config: CONFIG.education });
  const snapshot = {
    blueprintId: 'single',
    nextBlock: { position: { x: 1, y: 0, z: 1 } },
    blocks: [{ x: 1, y: 0, z: 1, expectedBlockId: BlockIds.PLANKS, status: 'missing' }]
  };
  assert.equal(ghost.update(snapshot), true);
  assert.equal(ghost.buildCount, 1);
  ghost.advance(0.2);
  assert.equal(ghost.update(snapshot), false);
  assert.equal(ghost.buildCount, 1);
  ghost.draw(p);
  assert.ok(p.calls.model > 0);
  ghost.setVisible(false);
  const modelsBefore = p.calls.model;
  ghost.draw(p);
  assert.equal(p.calls.model, modelsBefore);
});

test('el efecto de finalización respeta la configuración', () => {
  const p = createP5Stub();
  const enabled = new ChallengeCompleteEffect({ ...CONFIG.education, SHOW_COMPLETE_EFFECT: true });
  assert.equal(enabled.trigger(), true);
  enabled.draw(p);
  assert.ok(p.calls.box > 0);
  enabled.update(CONFIG.education.COMPLETE_EFFECT_DURATION);
  assert.equal(enabled.isActive, false);

  const disabled = new ChallengeCompleteEffect({ ...CONFIG.education, SHOW_COMPLETE_EFFECT: false });
  assert.equal(disabled.trigger(), false);
});
