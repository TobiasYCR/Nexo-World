import { test } from 'node:test';
import assert from 'node:assert/strict';
import { World } from '../src/world/World.js';
import { Chunk } from '../src/world/Chunk.js';
import { createDefaultBlockRegistry } from '../src/blocks/BlockRegistry.js';
import { GameConfig } from '../src/game/GameConfig.js';
import { BlockIds } from '../src/utils/Constants.js';

function buildWorld() {
  return new World(createDefaultBlockRegistry(), GameConfig);
}

test('escribir un id distinto ensucia el chunk y markClean lo aclara', () => {
  const world = buildWorld();
  world.setBlockId(5, 3, 5, BlockIds.STONE);

  const [chunk] = world.chunks;
  assert.equal(chunk.isDirty, true);

  chunk.markClean();
  assert.equal(chunk.isDirty, false);

  world.setBlockId(5, 3, 5, BlockIds.DIRT);
  assert.equal(chunk.isDirty, true);
});

test('escribir el mismo id no ensucia de nuevo', () => {
  const world = buildWorld();
  world.setBlockId(5, 3, 5, BlockIds.STONE);
  const [chunk] = world.chunks;
  chunk.markClean();

  world.setBlockId(5, 3, 5, BlockIds.STONE);
  assert.equal(chunk.isDirty, false);
});

test('sobrescribir con el mismo id no materializa un chunk vacío', () => {
  const world = buildWorld();
  assert.equal(world.chunkCount, 0);

  world.setBlockId(5, 3, 5, BlockIds.AIR); // ya era aire: nada que hacer
  assert.equal(world.chunkCount, 0);
});

test('modificar un bloque en el borde ensucia también al chunk vecino', () => {
  const world = buildWorld();
  world.setBlockId(15, 3, 5, BlockIds.STONE); // chunk (0, 0)
  world.setBlockId(16, 3, 5, BlockIds.DIRT); // chunk (1, 0)
  assert.equal(world.chunkCount, 2);

  for (const chunk of world.chunks) chunk.markClean();
  assert.equal(world.dirtyChunks().length, 0);

  world.setBlockId(15, 3, 5, BlockIds.DIRT); // x=15 es el borde este del chunk (0,0)
  const dirtyKeys = world.dirtyChunks().map((chunk) => chunk.key);
  assert.ok(dirtyKeys.includes(Chunk.keyOf(0, 0)), 'se ensució el chunk propio');
  assert.ok(dirtyKeys.includes(Chunk.keyOf(1, 0)), 'se ensució también el vecino');
});

test('un bloque interior solo ensucia su propio chunk', () => {
  const world = buildWorld();
  world.setBlockId(8, 3, 8, BlockIds.STONE); // chunk (0, 0)
  world.setBlockId(24, 3, 8, BlockIds.DIRT); // chunk (1, 0)
  for (const chunk of world.chunks) chunk.markClean();

  world.setBlockId(8, 3, 8, BlockIds.DIRT);
  const dirtyKeys = world.dirtyChunks().map((chunk) => chunk.key);
  assert.deepEqual(dirtyKeys, [Chunk.keyOf(0, 0)]);
});

test('marcar limpias las suciedades hace que dirtyChunks se vacíe', () => {
  const world = buildWorld();
  world.setBlockId(3, 0, 3, BlockIds.STONE);
  assert.equal(world.dirtyChunks().length, 1);

  for (const chunk of world.dirtyChunks()) chunk.markClean();
  assert.equal(world.dirtyChunks().length, 0);

  world.setBlockId(4, 0, 4, BlockIds.STONE);
  assert.equal(world.dirtyChunks().length, 1);
});