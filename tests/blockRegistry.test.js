import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createDefaultBlockRegistry, BlockRegistry } from '../src/blocks/BlockRegistry.js';
import { BlockIds } from '../src/utils/Constants.js';

test('el registro por defecto contiene los tipos base del mundo', () => {
  const registry = createDefaultBlockRegistry();
  assert.deepEqual(
    registry.values().map((type) => type.name),
    [
      'Air', 'Grass', 'Dirt', 'Stone', 'Log', 'Leaves', 'Planks', 'Sand', 'Cobblestone', 'Glass',
      'Sandstone', 'Bedrock', 'CoalOre', 'IronOre', 'GoldOre', 'DiamondOre'
    ]
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
  assert.equal(registry.placeableTypes().length, 15);
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
    'glass.png',
    'sandstone.png',
    'bedrock.png',
    'coal_ore.png',
    'iron_ore.png',
    'gold_ore.png',
    'diamond_ore.png'
  ]);
});

test('la roca madre es irrompible por propiedad y no dropea nada', () => {
  const bedrock = createDefaultBlockRegistry().get(BlockIds.BEDROCK);
  assert.equal(bedrock.isBreakable, false);
  assert.equal(bedrock.breakable, false);
  assert.equal(bedrock.isOpaque, true);
  assert.deepEqual([...bedrock.drops], []);
});

test('los minerales declaran dureza creciente y su propio bloque como drop', () => {
  const registry = createDefaultBlockRegistry();
  const stone = registry.get(BlockIds.STONE);
  const [coal, iron, gold, diamond] = [BlockIds.COAL_ORE, BlockIds.IRON_ORE, BlockIds.GOLD_ORE, BlockIds.DIAMOND_ORE]
    .map((id) => registry.get(id));

  assert.ok(coal.hardness > stone.hardness, 'carbón: resistencia moderada, algo más que la piedra');
  assert.ok(iron.hardness > coal.hardness, 'hierro: resistencia media');
  assert.ok(gold.hardness > iron.hardness, 'oro: resistencia alta');
  assert.ok(diamond.hardness >= gold.hardness, 'diamante: resistencia alta');
  for (const ore of [coal, iron, gold, diamond]) {
    assert.equal(ore.isBreakable, true, ore.name);
    assert.equal(ore.isOpaque, true, ore.name);
    assert.deepEqual([...ore.drops], [ore.id], ore.name);
    assert.ok(registry.has(ore.drops[0]), `${ore.name}: el drop existe en el registro`);
  }
});

test('isOpaque e isBreakable se pueden declarar y equivalen a transparent/breakable', () => {
  const registry = new BlockRegistry();
  const pane = registry.register({ id: 1, name: 'Pane', isOpaque: false, isBreakable: false });
  const brick = registry.register({ id: 2, name: 'Brick' });
  assert.equal(pane.isOpaque, false);
  assert.equal(pane.transparent, true);
  assert.equal(pane.isBreakable, false);
  assert.equal(brick.isOpaque, true);
  assert.equal(brick.isBreakable, true);
});

test('propertyTable refleja las propiedades declaradas sin comparar ids', () => {
  const registry = createDefaultBlockRegistry();
  const carvable = registry.propertyTable('carvable');
  const oreHost = registry.propertyTable('oreHost');
  for (const type of registry.values()) {
    assert.equal(carvable[type.id], type.carvable ? 1 : 0, type.name);
    assert.equal(oreHost[type.id], type.oreHost ? 1 : 0, type.name);
  }
  assert.equal(carvable[BlockIds.BEDROCK], 0, 'las cuevas no atraviesan la roca madre');
  assert.equal(carvable[BlockIds.LOG], 0, 'las cuevas no tocan estructuras como árboles');
  assert.equal(carvable[BlockIds.PLANKS], 0);
});

test('starterTypes devuelve solo los bloques marcados como starter', () => {
  const registry = createDefaultBlockRegistry();
  assert.deepEqual(registry.starterTypes().map((type) => type.name), ['Grass', 'Dirt', 'Stone', 'Planks', 'Glass']);
});
