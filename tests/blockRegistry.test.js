import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createDefaultBlockRegistry, BlockRegistry } from '../src/blocks/BlockRegistry.js';
import { BlockIds } from '../src/utils/Constants.js';

test('el registro por defecto contiene los tipos base del mundo', () => {
  const registry = createDefaultBlockRegistry();
  assert.deepEqual(
    registry.values().map((type) => type.name),
    ['Air', 'Grass', 'Dirt', 'Stone', 'Log', 'Leaves', 'Planks', 'Sand', 'Cobblestone', 'Glass']
  );
});

test('el aire no es sólido y los demás sí', () => {
  const registry = createDefaultBlockRegistry();
  assert.equal(registry.isSolid(BlockIds.AIR), false);
  assert.equal(registry.isSolid(BlockIds.GRASS), true);
  assert.equal(registry.isSolid(BlockIds.STONE), true);
});

test('los tipos colocables excluyen al aire', () => {
  const registry = createDefaultBlockRegistry();
  assert.equal(registry.placeableTypes().some((type) => type.id === BlockIds.AIR), false);
  assert.equal(registry.placeableTypes().length, 9);
});

test('no se permiten ids ni nombres duplicados', () => {
  const registry = new BlockRegistry();
  registry.register({ id: 10, name: 'Wood', texture: 'wood.png' });
  assert.throws(() => registry.register({ id: 10, name: 'Sand' }), /id 10/);
  assert.throws(() => registry.register({ id: 11, name: 'Wood' }), /Wood/);
});

test('un id desconocido falla de forma explícita', () => {
  const registry = createDefaultBlockRegistry();
  assert.throws(() => registry.get(99), RangeError);
});

test('textureNames devuelve solo texturas declaradas y sin repetir', () => {
  const registry = createDefaultBlockRegistry();
  assert.deepEqual(registry.textureNames(), [
    'grass_top.png',
    'grass_side.png',
    'dirt.png',
    'stone.png',
    'log_side.png',
    'log_top.png',
    'leaves.png',
    'planks.png',
    'sand.png',
    'cobblestone.png',
    'glass.png'
  ]);
});
