import { test } from 'node:test';
import assert from 'node:assert/strict';
import { World } from '../src/world/World.js';
import { WorldGenerator } from '../src/world/WorldGenerator.js';
import { createDefaultBlockRegistry } from '../src/blocks/BlockRegistry.js';
import { GameConfig } from '../src/game/GameConfig.js';
import { BlockIds } from '../src/utils/Constants.js';

function buildWorld() {
  return new World(createDefaultBlockRegistry(), GameConfig);
}

test('un mundo vacío devuelve aire en todas partes', () => {
  const world = buildWorld();
  assert.equal(world.getBlockId(0, 0, 0), BlockIds.AIR);
});

test('setBlockId y getBlockId son consistentes entre chunks', () => {
  const world = buildWorld();
  world.setBlockId(2, 3, 4, BlockIds.STONE);
  world.setBlockId(20, 3, 25, BlockIds.DIRT);

  assert.equal(world.getBlockId(2, 3, 4), BlockIds.STONE);
  assert.equal(world.getBlockId(20, 3, 25), BlockIds.DIRT);
  assert.equal(world.chunkCount, 2);
});

test('escribir fuera de los límites no altera el mundo', () => {
  const world = buildWorld();
  assert.equal(world.setBlockId(-1, 0, 0, BlockIds.STONE), false);
  assert.equal(world.chunkCount, 0);
});

test('colocar un id no registrado falla', () => {
  const world = buildWorld();
  assert.throws(() => world.setBlockId(0, 0, 0, 200), RangeError);
});

test('la generación llena el terreno y deja aire arriba', () => {
  const world = new WorldGenerator(GameConfig.world).generate(buildWorld());

  assert.equal(world.getBlockId(0, 0, 0), BlockIds.STONE);
  assert.equal(world.getBlockId(0, world.height - 1, 0), BlockIds.AIR);

  const surface = world.getSurfaceHeight(0, 0);
  assert.ok(surface > 0 && surface < world.height);
  assert.equal(world.getBlockId(0, surface - 1, 0), BlockIds.GRASS);
});

test('un bloque enterrado se considera oculto y uno de superficie no', () => {
  const world = new WorldGenerator(GameConfig.world).generate(buildWorld());
  const surface = world.getSurfaceHeight(5, 5);

  assert.equal(world.isBlockHidden(5, surface - 1, 5), false);
  assert.equal(world.isBlockHidden(5, 1, 5), true);

  // El borde inferior del mundo se trata como aire, así que y=0 nunca está oculto.
  assert.equal(world.isBlockHidden(5, 0, 5), false);
});

test('la conversión mundo <-> bloque es coherente', () => {
  const world = buildWorld();
  const worldPosition = world.blockToWorld(3, 4, 5);
  assert.deepEqual(world.worldToBlock(worldPosition.x, worldPosition.y, worldPosition.z), { x: 3, y: 4, z: 5 });
});
