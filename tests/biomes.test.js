import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BiomeRegistry, BiomeIds, createDefaultBiomeRegistry } from '../src/world/BiomeRegistry.js';
import { BiomeType } from '../src/world/BiomeType.js';
import { BiomeMap } from '../src/world/BiomeMap.js';
import { GameConfig } from '../src/game/GameConfig.js';
import { BlockIds } from '../src/utils/Constants.js';
import { TARGET_SIZE, configWith, generateWorld, targetWorld } from './support/generation.js';

function buildMap(seed, generation = GameConfig.worldGeneration) {
  return new BiomeMap(createDefaultBiomeRegistry(), generation, seed, 1)
    .build(TARGET_SIZE.width, TARGET_SIZE.depth, 1, TARGET_SIZE.height - 2);
}

/** Mayor desnivel entre columnas vecinas que pertenecen a biomas distintos. */
function maxBorderStep({ biomeIds, heights }) {
  const { width, depth } = TARGET_SIZE;
  let max = 0;
  for (let z = 0; z < depth; z += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = z * width + x;
      for (const neighbour of [x + 1 < width ? index + 1 : -1, z + 1 < depth ? index + width : -1]) {
        if (neighbour < 0 || biomeIds[index] === biomeIds[neighbour]) continue;
        max = Math.max(max, Math.abs(heights[index] - heights[neighbour]));
      }
    }
  }
  return max;
}

test('el registro por defecto define llanura, bosque, desierto y montañas con sus propiedades', () => {
  const registry = createDefaultBiomeRegistry();
  assert.deepEqual(registry.values().map((biome) => biome.name), ['Plains', 'Forest', 'Desert', 'Mountains']);
  for (const biome of registry.values()) {
    for (const key of ['id', 'name', 'surfaceBlock', 'subsurfaceBlock', 'terrainHeight', 'terrainVariation', 'treeDensity']) {
      assert.ok(biome[key] !== undefined, `${biome.name}.${key}`);
    }
    assert.ok(biome.terrainHeight + biome.terrainVariation < GameConfig.worldGeneration.REFERENCE_HEIGHT, `${biome.name} entra en el mundo`);
  }

  const [plains, forest, desert, mountains] = [BiomeIds.PLAINS, BiomeIds.FOREST, BiomeIds.DESERT, BiomeIds.MOUNTAINS].map((id) => registry.get(id));
  assert.equal(desert.surfaceBlock, BlockIds.SAND);
  assert.equal(desert.subsurfaceBlock, BlockIds.SANDSTONE);
  assert.equal(desert.treeDensity, 0, 'el desierto casi no tiene vegetación');
  assert.ok(forest.treeDensity > plains.treeDensity, 'el bosque tiene más árboles que la llanura');
  assert.ok(mountains.treeDensity < plains.treeDensity, 'las montañas tienen menos árboles');
  assert.ok(mountains.terrainVariation > forest.terrainVariation && forest.terrainVariation > plains.terrainVariation);
  assert.notEqual(mountains.stoneAltitude, null, 'las montañas exponen piedra');
});

test('BiomeType valida sus datos y el registro rechaza ids repetidos', () => {
  assert.throws(() => new BiomeType({ id: 0, name: 'X', surfaceBlock: 1, subsurfaceBlock: 2, terrainHeight: 5, terrainVariation: -1 }), TypeError);
  assert.throws(() => new BiomeType({ id: 0, name: 'X', surfaceBlock: 1, subsurfaceBlock: 2, terrainHeight: 5, terrainVariation: 1, terrainShape: 'cubes' }), TypeError);
  const registry = new BiomeRegistry();
  registry.register({ id: 7, name: 'A', surfaceBlock: 1, subsurfaceBlock: 2, terrainHeight: 5, terrainVariation: 1 });
  assert.throws(() => registry.register({ id: 7, name: 'B', surfaceBlock: 1, subsurfaceBlock: 2, terrainHeight: 5, terrainVariation: 1 }));
  assert.throws(() => registry.get(99), RangeError);
});

test('la selección de biomas es determinista y cambia con la semilla', () => {
  const first = buildMap(1234);
  const second = buildMap(1234);
  assert.deepEqual(first.biomeIds, second.biomeIds);
  assert.deepEqual(first.heights, second.heights);

  const other = buildMap(98765);
  let different = 0;
  for (let index = 0; index < first.biomeIds.length; index += 1) {
    if (first.biomeIds[index] !== other.biomeIds[index]) different += 1;
  }
  assert.ok(different > first.biomeIds.length * 0.2, `solo ${different} columnas cambiaron de bioma`);
});

test('los cuatro biomas aparecen en el mundo de 128x128x48 con distintas semillas', () => {
  for (const seed of [GameConfig.world.SEED, 1, 42, 2024]) {
    const { biomeIds } = buildMap(seed);
    const present = new Set(biomeIds);
    assert.equal(present.size, 4, `semilla ${seed}: biomas presentes ${[...present].join(', ')}`);
  }
  const { generator } = targetWorld();
  for (const [name, columns] of Object.entries(generator.stats.biomeColumns)) assert.ok(columns > 0, name);
});

test('un peso 0 desactiva un bioma', () => {
  const registry = createDefaultBiomeRegistry({ ...GameConfig.biomes, DESERT_WEIGHT: 0 });
  const { biomeIds } = new BiomeMap(registry, GameConfig.worldGeneration, 42, 1).build(TARGET_SIZE.width, TARGET_SIZE.depth, 1, 46);
  assert.equal(biomeIds.includes(BiomeIds.DESERT), false);
});

test('las alturas se mezclan en los bordes de bioma sin saltos excesivos', () => {
  const blended = buildMap(GameConfig.world.SEED);
  const abrupt = buildMap(GameConfig.world.SEED, { ...GameConfig.worldGeneration, HEIGHT_SMOOTHING: 1e-9 });

  assert.ok(maxBorderStep(blended) <= 3, `salto de ${maxBorderStep(blended)} bloques en un borde`);
  assert.ok(maxBorderStep(abrupt) > maxBorderStep(blended), 'sin interpolación los bordes deberían ser más bruscos');
});

test('la superficie de cada columna corresponde a su bioma', () => {
  const { world, generator } = targetWorld();
  const { biomeIds } = generator.planSurface(world);
  const ignored = new Set([BlockIds.LOG, BlockIds.LEAVES]);
  const checked = new Map();

  for (let z = 0; z < world.depth; z += 1) {
    for (let x = 0; x < world.width; x += 1) {
      const biome = generator.biomeRegistry.get(biomeIds[z * world.width + x]);
      let y = world.height - 1;
      while (y > 0 && (world.getBlockId(x, y, z) === BlockIds.AIR || ignored.has(world.getBlockId(x, y, z)))) y -= 1;
      const top = world.getBlockId(x, y, z);
      const exposesStone = biome.stoneAltitude !== null || biome.steepSlope !== null;
      // En roca expuesta pueden asomar vetas de mineral.
      const rock = [BlockIds.STONE, BlockIds.COAL_ORE, BlockIds.IRON_ORE, BlockIds.GOLD_ORE, BlockIds.DIAMOND_ORE];
      const allowed = exposesStone ? [biome.surfaceBlock, ...rock] : [biome.surfaceBlock];
      assert.ok(allowed.includes(top), `${biome.name} en ${x},${z}: superficie ${top}`);
      checked.set(biome.name, (checked.get(biome.name) ?? 0) + 1);
    }
  }
  assert.equal(checked.size, 4);
});

test('el desierto tiene arenisca bajo la arena', () => {
  const { world } = targetWorld();
  let sandstone = 0;
  world.forEachSolidBlock((x, y, z, blockId) => {
    if (blockId !== BlockIds.SANDSTONE) return;
    sandstone += 1;
    assert.notEqual(world.getBlockId(x, y + 1, z), BlockIds.GRASS, 'la arenisca no queda bajo el césped');
  });
  assert.ok(sandstone > 0);
});

test('las montañas son el bioma más alto y exponen piedra en la superficie', () => {
  const { world, generator } = targetWorld();
  const { biomeIds, heights } = generator.planSurface(world);
  const peak = new Map();
  let exposedStone = 0;
  for (let index = 0; index < biomeIds.length; index += 1) {
    peak.set(biomeIds[index], Math.max(peak.get(biomeIds[index]) ?? 0, heights[index]));
    const x = index % world.width;
    const z = Math.floor(index / world.width);
    if (biomeIds[index] === BiomeIds.MOUNTAINS && world.getBlockId(x, heights[index], z) === BlockIds.STONE) exposedStone += 1;
  }
  const mountainPeak = peak.get(BiomeIds.MOUNTAINS);
  for (const [biomeId, height] of peak) if (biomeId !== BiomeIds.MOUNTAINS) assert.ok(mountainPeak > height, `pico ${mountainPeak} vs ${height}`);
  assert.ok(mountainPeak < world.height, 'los picos respetan la altura del mundo');
  assert.ok(exposedStone > 0, 'debería haber piedra expuesta en montañas');
});

test('el generador escala las alturas a un mundo más bajo sin salirse de sus límites', () => {
  const { world } = generateWorld(configWith({ width: 32, height: 24, depth: 32 }));
  for (let x = 0; x < world.width; x += 1) {
    for (let z = 0; z < world.depth; z += 1) {
      assert.equal(world.getBlockId(x, world.height - 1, z), BlockIds.AIR);
      assert.ok(world.getSurfaceHeight(x, z) > 1);
    }
  }
});
