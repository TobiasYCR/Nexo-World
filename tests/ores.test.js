import { test } from 'node:test';
import assert from 'node:assert/strict';
import { OreGenerator } from '../src/world/OreGenerator.js';
import { createDefaultBlockRegistry } from '../src/blocks/BlockRegistry.js';
import { GameConfig } from '../src/game/GameConfig.js';
import { BlockIds } from '../src/utils/Constants.js';
import { TARGET_SIZE, targetWorld } from './support/generation.js';

const { width, height, depth } = TARGET_SIZE;
const ORE_NAMES = Object.keys(GameConfig.ores);

function plan(seed = 99) {
  return new OreGenerator(GameConfig.ores, seed, 1).plan(width, height, depth);
}

/** Posiciones (y) de cada mineral colocado en el mundo objetivo. */
function oreHeights(world) {
  const heights = new Map(ORE_NAMES.map((name) => [GameConfig.ores[name].BLOCK, []]));
  world.forEachSolidBlock((x, y, z, blockId) => heights.get(blockId)?.push(y));
  return heights;
}

const average = (values) => values.reduce((sum, value) => sum + value, 0) / values.length;

test('cada mineral configurado existe en el registro y declara su drop', () => {
  const registry = createDefaultBlockRegistry();
  for (const name of ORE_NAMES) {
    const ore = registry.get(GameConfig.ores[name].BLOCK);
    assert.ok(ore.drops.length > 0, name);
    for (const dropId of ore.drops) assert.ok(registry.has(dropId), `${name}: drop ${dropId}`);
  }
  assert.deepEqual(ORE_NAMES, ['COAL', 'IRON', 'GOLD', 'DIAMOND']);
});

test('la planificación de vetas es determinista y depende de la semilla', () => {
  const first = plan(10);
  const second = plan(10);
  const other = plan(11);
  assert.deepEqual(first.map, second.map);
  assert.deepEqual(first.stats, second.stats);
  let differences = 0;
  for (let index = 0; index < first.map.length; index += 1) if (first.map[index] !== other.map[index]) differences += 1;
  assert.ok(differences > 1000);
});

test('se planifica exactamente la cantidad de vetas configurada por chunk', () => {
  const { stats } = plan();
  for (const name of ORE_NAMES) {
    const ore = GameConfig.ores[name];
    const expected = OreGenerator.veinCount(ore.VEINS_PER_CHUNK, width, depth);
    assert.equal(stats[name].veins, expected, name);
    assert.ok(stats[name].cells <= expected * ore.MAX_SIZE, `${name}: más celdas que el máximo posible`);
    assert.ok(stats[name].cells >= expected, `${name}: cada veta aporta al menos un bloque`);
  }
  assert.equal(OreGenerator.veinCount(0.6, 128, 128), 38);
});

test('las vetas planificadas respetan el rango de altura de cada mineral', () => {
  const generator = new OreGenerator(GameConfig.ores, 99, 1);
  const { map } = generator.plan(width, height, depth);
  const ranges = new Map(ORE_NAMES.map((name) => [GameConfig.ores[name].BLOCK, generator.rangeFor(name, height)]));
  for (let index = 0; index < map.length; index += 1) {
    if (map[index] === 0) continue;
    const y = Math.floor(index / (width * depth));
    const { minY, maxY } = ranges.get(map[index]);
    assert.ok(y >= minY && y <= maxY, `mineral ${map[index]} en y=${y}`);
  }
});

test('los minerales del mundo aparecen en su rango y ordenados por profundidad', () => {
  const { world } = targetWorld();
  const generator = new OreGenerator(GameConfig.ores, 0, 1);
  const heights = oreHeights(world);

  for (const name of ORE_NAMES) {
    const ys = heights.get(GameConfig.ores[name].BLOCK);
    const { minY, maxY } = generator.rangeFor(name, world.height);
    assert.ok(ys.length > 0, `${name}: no aparece en el mundo`);
    assert.ok(ys.every((y) => y >= minY && y <= maxY), `${name}: fuera de [${minY}, ${maxY}]`);
  }

  const [coal, iron, gold, diamond] = ORE_NAMES.map((name) => heights.get(GameConfig.ores[name].BLOCK));
  assert.ok(coal.length > iron.length && iron.length > gold.length && gold.length > diamond.length,
    `frecuencias: carbón ${coal.length}, hierro ${iron.length}, oro ${gold.length}, diamante ${diamond.length}`);
  assert.ok(average(coal) > average(iron) && average(iron) > average(gold) && average(gold) > average(diamond),
    'los minerales más valiosos aparecen más profundo');
  assert.ok(Math.max(...diamond) <= Math.round(GameConfig.ores.DIAMOND.MAX_Y * world.height / GameConfig.worldGeneration.REFERENCE_HEIGHT),
    'el diamante queda cerca de las capas inferiores');
});

test('las vetas forman grupos conectados por cara', () => {
  const { map } = plan(7);
  const neighbours = [1, -1, width, -width, width * depth, -width * depth];
  for (const name of ORE_NAMES) {
    const ore = GameConfig.ores[name];
    if (ore.MAX_SIZE < 2) continue;
    let cells = 0;
    let grouped = 0;
    for (let index = 0; index < map.length; index += 1) {
      if (map[index] !== ore.BLOCK) continue;
      cells += 1;
      if (neighbours.some((offset) => map[index + offset] === ore.BLOCK)) grouped += 1;
    }
    assert.ok(grouped / cells > 0.85, `${name}: solo ${grouped}/${cells} bloques tienen un vecino del mismo mineral`);
  }
});

test('los minerales solo reemplazan roca huésped: nunca quedan en el aire ni sobre la superficie', () => {
  const { world, generator } = targetWorld();
  const { heights } = generator.planSurface(world);
  const oreIds = new Set(ORE_NAMES.map((name) => GameConfig.ores[name].BLOCK));
  world.forEachSolidBlock((x, y, z, blockId) => {
    if (!oreIds.has(blockId)) return;
    assert.ok(y <= heights[z * world.width + x], `mineral flotando en ${x},${y},${z}`);
  });
  assert.equal(world.blockRegistry.get(BlockIds.STONE).oreHost, true);
});

test('un mineral cuyo rango no entra en un mundo bajo no genera vetas', () => {
  const generator = new OreGenerator({ DEEP: { BLOCK: BlockIds.COAL_ORE, MIN_Y: 30, MAX_Y: 40, VEINS_PER_CHUNK: 5, MIN_SIZE: 2, MAX_SIZE: 4 } }, 1, 1);
  const { map, stats } = generator.plan(32, 16, 32);
  assert.deepEqual(stats.DEEP, { veins: 0, cells: 0 });
  assert.ok(map.every((id) => id === 0));
});
