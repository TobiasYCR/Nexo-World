import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SpawnFinder } from '../src/world/SpawnFinder.js';
import { World } from '../src/world/World.js';
import { WorldGenerator } from '../src/world/WorldGenerator.js';
import { createDefaultBlockRegistry } from '../src/blocks/BlockRegistry.js';
import { BlockIds } from '../src/utils/Constants.js';
import { GameConfig } from '../src/game/GameConfig.js';

function flatWorld() {
  const world = new World(createDefaultBlockRegistry(), GameConfig);
  for (let x = 0; x < world.width; x += 1) {
    for (let z = 0; z < world.depth; z += 1) world.setBlockId(x, 0, z, BlockIds.GRASS);
  }
  return world;
}

test('en terreno libre aparece en el centro pedido', () => {
  const world = flatWorld();
  assert.deepEqual(new SpawnFinder().find(world, 10, 10), { x: 10, y: 1, z: 10 });
});

test('no aparece sobre la copa ni el tronco de un árbol: busca el suelo más cercano', () => {
  const world = flatWorld();
  for (let dx = -1; dx <= 1; dx += 1) {
    for (let dz = -1; dz <= 1; dz += 1) world.setBlockId(10 + dx, 4, 10 + dz, BlockIds.LEAVES);
  }
  for (let y = 1; y <= 3; y += 1) world.setBlockId(10, y, 10, BlockIds.LOG);
  const spot = new SpawnFinder().find(world, 10, 10);
  assert.equal(spot.y, 1);
  assert.equal(Math.max(Math.abs(spot.x - 10), Math.abs(spot.z - 10)), 2, 'el anillo siguiente a la copa');
  assert.equal(world.getBlockId(spot.x, spot.y - 1, spot.z), BlockIds.GRASS);
});

test('en ninguna de varias semillas generadas aparece arriba de un árbol', () => {
  for (const seed of [1, 7, 42, 2024, 20260904, 123456]) {
    const world = new World(createDefaultBlockRegistry(), GameConfig);
    new WorldGenerator(GameConfig, { seed }).generate(world);
    const spot = new SpawnFinder(2).find(world, Math.floor(world.width / 2), Math.floor(world.depth / 2));
    const below = world.getBlockId(spot.x, spot.y - 1, spot.z);
    assert.ok(below !== BlockIds.LEAVES && below !== BlockIds.LOG, `semilla ${seed}`);
  }
});

test('sin suelo cerca vuelve a la superficie del centro', () => {
  const world = new World(createDefaultBlockRegistry(), GameConfig);
  assert.deepEqual(new SpawnFinder(2, 3).find(world, 5, 5), { x: 5, y: 0, z: 5 });
});
