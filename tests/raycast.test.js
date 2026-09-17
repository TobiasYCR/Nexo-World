import { test } from 'node:test';
import assert from 'node:assert/strict';
import { World } from '../src/world/World.js';
import { Raycast } from '../src/physics/Raycast.js';
import { createDefaultBlockRegistry } from '../src/blocks/BlockRegistry.js';
import { GameConfig } from '../src/game/GameConfig.js';
import { BlockIds } from '../src/utils/Constants.js';

function buildWorld(spec) {
  const world = new World(createDefaultBlockRegistry(), GameConfig);
  for (const [x, y, z, id] of spec) world.setBlockId(x, y, z, id);
  return world;
}

test('cast golpea el bloque sólido más cercano con su cara adyacente', () => {
  const world = buildWorld([[1, 0, 0, BlockIds.STONE]]);
  const raycast = new Raycast(world);

  const hit = raycast.cast({ x: 0, y: 10, z: 15 }, { x: 1, y: 0, z: 0 }, 300);

  assert.ok(hit, 'debería haber impacto');
  assert.deepEqual(
    { x: hit.block.x, y: hit.block.y, z: hit.block.z },
    { x: 1, y: 0, z: 0 }
  );
  assert.deepEqual(hit.face, { x: -1, y: 0, z: 0 });
  assert.equal(hit.distance, GameConfig.world.BLOCK_SIZE);
  assert.deepEqual(hit.adjacentPosition, { x: 0, y: 0, z: 0 });
});

test('la dirección se normaliza: la magnitud no altera el resultado', () => {
  const world = buildWorld([[1, 0, 0, BlockIds.STONE]]);
  const raycast = new Raycast(world);

  const normalized = raycast.cast({ x: 0, y: 10, z: 15 }, { x: 1, y: 0, z: 0 }, 300);
  const scaled = raycast.cast({ x: 0, y: 10, z: 15 }, { x: 3, y: 0, z: 0 }, 300);
  const tiny = raycast.cast({ x: 0, y: 10, z: 15 }, { x: 0.001, y: 0, z: 0 }, 300);

  assert.ok(normalized && scaled && tiny);
  assert.equal(scaled.distance, normalized.distance);
  assert.equal(tiny.distance, normalized.distance);
  assert.deepEqual(scaled.face, normalized.face);
  assert.equal(scaled.block.x, normalized.block.x);
});

test('un vector nulo no genera impacto', () => {
  const world = buildWorld([[1, 0, 0, BlockIds.STONE]]);
  const raycast = new Raycast(world);
  assert.equal(raycast.cast({ x: 0, y: 10, z: 15 }, { x: 0, y: 0, z: 0 }, 300), null);
});

test('el alcance máximo corta rayos que no llegan a un bloque', () => {
  const world = buildWorld([[1, 0, 0, BlockIds.STONE]]);
  const raycast = new Raycast(world);

  assert.notEqual(raycast.cast({ x: 0, y: 10, z: 15 }, { x: 1, y: 0, z: 0 }, 100), null);
  assert.equal(raycast.cast({ x: 0, y: 10, z: 15 }, { x: 1, y: 0, z: 0 }, 10), null);
});

test('origen dentro de un bloque: impacto sin cara válida', () => {
  const world = buildWorld([[1, 0, 1, BlockIds.STONE]]);
  const raycast = new Raycast(world);

  const hit = raycast.cast({ x: 21, y: 10, z: 21 }, { x: 1, y: 0, z: 0 }, 300);

  assert.ok(hit, 'roza un bloque: debe haber impacto');
  assert.equal(hit.block.x, 1);
  assert.equal(hit.block.z, 1);
  assert.equal(hit.distance, 0);
  assert.equal(hit.face, null, 'dentro del bloque no hay cara adyacente');
  assert.equal(hit.adjacentPosition, null);
});