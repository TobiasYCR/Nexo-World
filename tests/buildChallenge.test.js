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
    SITE_PLAYER_CLEARANCE: 0,
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
  for (const blueprint of registry.values()) {
    assert.ok(blueprint.blocks.length <= GameConfig.education.MAX_BLUEPRINT_BLOCKS, blueprint.id);
  }
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

test('rechaza un plano fuera del mundo', () => {
  const { challenge } = harness();
  challenge.player.teleportTo(10, 20, 10);
  const outside = challenge.start('single');
  assert.equal(outside.ok, false);
  assert.equal(outside.reason, 'outOfBounds');
});

/** Mundo de prueba con piso de pasto a la altura dada. */
function grassFloor(world, height = 1) {
  for (let x = 0; x < world.width; x += 1) {
    for (let z = 0; z < world.depth; z += 1) {
      for (let y = 0; y < height; y += 1) world.setBlockId(x, y, z, y === height - 1 ? BlockIds.GRASS : BlockIds.DIRT);
    }
  }
}

function footprint(snapshot) {
  return snapshot.blocks.map(({ x, z }) => `${x},${z}`);
}

test('un plano no se apoya sobre un árbol: se corre al suelo despejado más cercano', () => {
  const { challenge, camera, world } = harness();
  grassFloor(world);
  camera.yaw = 0;
  // Árbol justo donde caería la línea (7,7 y 8,7).
  for (let y = 1; y < 4; y += 1) world.setBlockId(7, y, 7, BlockIds.LOG);
  world.setBlockId(8, 4, 7, BlockIds.LEAVES);

  const started = challenge.start('line');
  assert.equal(started.ok, true);
  const cells = footprint(started.snapshot);
  assert.ok(!cells.includes('7,7') && !cells.includes('8,7'), cells.join('|'));
  assert.ok(started.snapshot.blocks.every(({ y }) => y === 1), 'sobre el pasto, no sobre las hojas');
});

test('un plano prefiere el suelo sin desnivel y nunca un escalón de más de uno', () => {
  const { challenge, camera, world } = harness();
  grassFloor(world);
  camera.yaw = 0;
  // Escalón de un bloque bajo el lugar preferido: hay suelo llano al lado.
  world.setBlockId(8, 1, 7, BlockIds.GRASS);
  const started = challenge.start('line');
  assert.equal(started.ok, true);
  const cells = started.snapshot.blocks.map(({ x, z }) => [x, z]);
  const heights = cells.map(([x, z]) => world.getSurfaceHeight(x, z));
  assert.equal(new Set(heights).size, 1, `alturas ${heights}`);

  // Terreno en escalera: cada columna un bloque más alta que la anterior.
  for (let x = 0; x < world.width; x += 1) {
    for (let z = 0; z < world.depth; z += 1) {
      for (let y = 1; y < world.height; y += 1) {
        world.setBlockId(x, y, z, y <= (x % 2) * 3 ? BlockIds.STONE : BlockIds.AIR);
      }
    }
  }
  const steep = challenge.start('line');
  assert.equal(steep.ok, false);
  assert.equal(steep.reason, 'noFlatSite');
});

test('el plano no encierra al jugador', () => {
  const { challenge, camera, world, player } = harness();
  grassFloor(world);
  camera.yaw = 0;
  const finder = challenge.siteFinder;
  const playerBlock = world.worldToBlock(player.position.x, player.position.y, player.position.z);
  const anchor = finder.find(world, playerBlock, { x: 3, y: 3, z: 3 }, playerBlock);
  assert.ok(anchor);
  const covers = playerBlock.x >= anchor.x && playerBlock.x < anchor.x + 3 &&
    playerBlock.z >= anchor.z && playerBlock.z < anchor.z + 3;
  assert.equal(covers, false);
});

test('la casa del juego se ubica en llano dentro de un mundo generado', async () => {
  const { WorldGenerator } = await import('../src/world/WorldGenerator.js');
  const { createDefaultBlueprintRegistry: registryOf } = await import('../src/education/BlueprintRegistry.js');
  const blockRegistry = createDefaultBlockRegistry();
  let placed = 0;
  for (const seed of [1, 7, 42, 2024, 20260904]) {
    const world = new World(blockRegistry, GameConfig);
    new WorldGenerator(GameConfig, { seed }).generate(world);
    const size = GameConfig.world.BLOCK_SIZE;
    const x = Math.floor(world.width / 2);
    const z = Math.floor(world.depth / 2);
    const player = new Player({ ...GameConfig.player, SPAWN: { x: x * size + size / 2, y: world.getSurfaceHeight(x, z) * size, z: z * size + size / 2 } });
    const challenge = new BuildChallenge({
      world,
      player,
      camera: new FirstPersonCamera(GameConfig.camera),
      blueprintRegistry: registryOf(blockRegistry, GameConfig.education),
      blockRegistry,
      config: GameConfig.education
    });
    const started = challenge.start('wood-house');
    if (!started.ok) {
      assert.equal(started.reason, 'noFlatSite');
      continue;
    }
    placed += 1;
    const floor = started.snapshot.blocks.filter(({ y }) => y === started.snapshot.anchor.y);
    for (const { x: bx, z: bz } of floor) {
      const ground = world.getBlockId(bx, world.getSurfaceHeight(bx, bz) - 1, bz);
      assert.ok(![BlockIds.LOG, BlockIds.LEAVES].includes(ground), `semilla ${seed}: suelo ${ground}`);
      assert.ok(started.snapshot.anchor.y - world.getSurfaceHeight(bx, bz) <= GameConfig.education.SITE_MAX_UNEVENNESS);
    }
    assert.equal(started.snapshot.wrong, 0, `semilla ${seed}: nada ocupa el lugar del plano`);
  }
  assert.ok(placed >= 4, `solo se ubicó en ${placed} de 5 mundos`);
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

test('la casa tiene piso, columnas, paredes con puerta y ventanas, y techo a dos aguas', () => {
  const blockRegistry = createDefaultBlockRegistry();
  const house = createDefaultBlueprintRegistry(blockRegistry, GameConfig.education).get('wood-house');
  const at = (x, y, z) => house.blocks.find((block) => block.x === x && block.y === y && block.z === z)?.blockId ?? BlockIds.AIR;
  assert.deepEqual(house.size, { x: 7, y: 8, z: 6 });
  assert.equal(at(3, 0, 3), BlockIds.COBBLESTONE, 'piso');
  for (const [x, z] of [[0, 0], [6, 0], [0, 5], [6, 5]]) assert.equal(at(x, 1, z), BlockIds.LOG, 'columna');
  assert.equal(at(3, 1, 0), BlockIds.AIR, 'puerta');
  assert.equal(at(3, 2, 0), BlockIds.AIR, 'puerta');
  assert.equal(at(1, 2, 0), BlockIds.GLASS, 'ventana');
  assert.equal(at(3, 2, 3), BlockIds.AIR, 'adentro está vacío');
  assert.equal(at(3, 7, 2), BlockIds.LOG, 'cumbrera');
  assert.equal(at(0, 5, 2), BlockIds.AIR, 'el techo se angosta hacia arriba');
});

test('la casa pide los bloques por partes: un material por etapa, sin ir y venir', () => {
  const blockRegistry = createDefaultBlockRegistry();
  const world = new World(blockRegistry, GameConfig);
  for (let x = 0; x < world.width; x += 1) for (let z = 0; z < world.depth; z += 1) world.setBlockId(x, 0, z, BlockIds.GRASS);
  const size = GameConfig.world.BLOCK_SIZE;
  const center = Math.floor(world.width / 2) * size + size / 2;
  const player = new Player({ ...GameConfig.player, SPAWN: { x: center, y: size, z: center } });
  const challenge = new BuildChallenge({
    world,
    player,
    camera: new FirstPersonCamera(GameConfig.camera),
    blueprintRegistry: createDefaultBlueprintRegistry(blockRegistry, GameConfig.education),
    blockRegistry,
    config: GameConfig.education
  });
  let snapshot = challenge.start('wood-house').snapshot;
  const asked = [];
  while (snapshot.nextBlock) {
    const { position, blockId } = snapshot.nextBlock;
    asked.push(blockId);
    const supported = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]]
      .some(([dx, dy, dz]) => world.getBlockId(position.x + dx, position.y + dy, position.z + dz) !== BlockIds.AIR);
    assert.ok(supported, `el bloque en ${position.x},${position.y},${position.z} se pide antes que su apoyo`);
    world.setBlockId(position.x, position.y, position.z, blockId);
    snapshot = challenge.refresh();
  }
  assert.equal(snapshot.completed, true);
  const runs = asked.filter((blockId, index) => index === 0 || asked[index - 1] !== blockId);
  assert.deepEqual(runs, [
    BlockIds.COBBLESTONE, BlockIds.LOG, BlockIds.PLANKS, BlockIds.GLASS, BlockIds.PLANKS, BlockIds.LOG
  ]);
  const playerBlock = world.worldToBlock(player.position.x, player.position.y, player.position.z);
  const cells = challenge.snapshot().blocks;
  assert.ok(cells.every(({ x, z }) => x !== playerBlock.x || z !== playerBlock.z), 'no encierra al jugador');
});

test('una etapa inválida se rechaza', () => {
  assert.throws(() => new Blueprint({
    id: 'bad-stage',
    name: 'Inválido',
    blocks: [{ x: 0, y: 0, z: 0, blockId: BlockIds.PLANKS, stage: -1 }]
  }, createDefaultBlockRegistry()), /etapa inválida/);
});

test('la guía ilumina y marca las celdas del bloque que se tiene en la mano', () => {
  const blockRegistry = createDefaultBlockRegistry();
  const drawn = [];
  let current = {};
  const p = createP5Stub();
  Object.assign(p, {
    fill: (...rgba) => { current.alpha = rgba[3]; },
    emissiveMaterial: (...rgb) => { current.emissive = rgb.some((value) => value > 0); },
    stroke: () => { current.stroke = true; },
    noStroke: () => { current.stroke = false; },
    model: (geometry) => { drawn.push({ gid: geometry.gid, ...current }); current = {}; }
  });
  const ghost = new BlueprintGhost({ p, blockRegistry, config: CONFIG.education });
  const cell = (x, expectedBlockId) => ({ x, y: 0, z: 0, expectedBlockId, status: 'missing' });
  ghost.update({
    blueprintId: 'mix',
    nextBlock: { position: { x: 0, y: 0, z: 0 } },
    blocks: [cell(0, BlockIds.PLANKS), cell(2, BlockIds.LOG)]
  });
  const byType = () => Object.fromEntries(drawn.map((entry) => [entry.gid.split('-').pop(), entry]));

  ghost.draw(p);
  const idle = byType();
  assert.equal(idle[BlockIds.PLANKS].alpha, idle[BlockIds.LOG].alpha, 'sin bloque en la mano, todo igual');
  assert.equal(idle[BlockIds.LOG].stroke, false);

  drawn.length = 0;
  ghost.setHeldBlock(BlockIds.LOG);
  ghost.draw(p);
  const holding = byType();
  assert.ok(holding[BlockIds.LOG].alpha > holding[BlockIds.PLANKS].alpha * 3, 'lo de la mano resalta y el resto se atenúa');
  assert.equal(holding[BlockIds.LOG].emissive, true, 'brilla aunque esté a la sombra');
  assert.equal(holding[BlockIds.LOG].stroke, true, 'con borde');
  assert.equal(holding[BlockIds.PLANKS].stroke, false);

  drawn.length = 0;
  ghost.setHeldBlock(BlockIds.GLASS);
  ghost.draw(p);
  assert.equal(byType()[BlockIds.LOG].alpha, idle[BlockIds.LOG].alpha, 'un bloque que el plano no usa no cambia nada');
});

test('la guía usa la textura de cada bloque, así tablón y tronco se distinguen', () => {
  const blockRegistry = createDefaultBlockRegistry();
  const used = [];
  let pending = {};
  const p = createP5Stub();
  Object.assign(p, {
    tint: (...rgba) => { pending.alpha = rgba[3]; },
    texture: (image) => { pending.texture = image.name; },
    fill: () => { pending.texture = null; },
    model: (geometry) => { used.push({ gid: geometry.gid, ...pending }); pending = {}; }
  });
  const textureManager = { get: (name) => ({ name }) };
  const ghost = new BlueprintGhost({ p, blockRegistry, textureManager, config: CONFIG.education });
  ghost.update({
    blueprintId: 'mix',
    nextBlock: null,
    blocks: [
      { x: 0, y: 0, z: 0, expectedBlockId: BlockIds.PLANKS, status: 'missing' },
      { x: 2, y: 0, z: 0, expectedBlockId: BlockIds.LOG, status: 'missing' },
      { x: 4, y: 0, z: 0, expectedBlockId: BlockIds.LOG, status: 'wrong' }
    ]
  });
  ghost.draw(p);
  const textures = Object.fromEntries(used.map(({ gid, texture }) => [gid.split('-').slice(-2).join('-'), texture]));
  assert.equal(textures[`missing-${BlockIds.PLANKS}`], blockRegistry.get(BlockIds.PLANKS).texture);
  assert.equal(textures[`missing-${BlockIds.LOG}`], blockRegistry.get(BlockIds.LOG).texture);
  assert.notEqual(textures[`missing-${BlockIds.PLANKS}`], textures[`missing-${BlockIds.LOG}`]);
  assert.equal(textures[`wrong-${BlockIds.LOG}`], null, 'lo incorrecto sigue en rojo liso');
  assert.ok(used.find(({ gid }) => gid.endsWith(`missing-${BlockIds.LOG}`)).alpha < 255, 'semitransparente');
});
