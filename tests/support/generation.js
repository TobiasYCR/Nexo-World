import { World } from '../../src/world/World.js';
import { WorldGenerator } from '../../src/world/WorldGenerator.js';
import { createDefaultBlockRegistry } from '../../src/blocks/BlockRegistry.js';
import { GameConfig } from '../../src/game/GameConfig.js';

/** Mundo objetivo de la etapa: 128x128 columnas y 48 de alto. */
export const TARGET_SIZE = Object.freeze({ width: 128, height: 48, depth: 128 });

/** GameConfig con otras dimensiones de mundo y secciones de generación opcionalmente pisadas. */
export function configWith({ width, height, depth } = TARGET_SIZE, overrides = {}) {
  const config = {
    ...GameConfig,
    world: { ...GameConfig.world, WORLD_WIDTH: width, WORLD_HEIGHT: height, WORLD_DEPTH: depth }
  };
  for (const [section, values] of Object.entries(overrides)) config[section] = { ...GameConfig[section], ...values };
  return config;
}

export function generateWorld(config = configWith(), options = {}) {
  const world = new World(createDefaultBlockRegistry(), config);
  const generator = new WorldGenerator(config, options);
  generator.generate(world);
  return { world, generator, config };
}

const cache = new Map();

/** Mundo 128x128x48 generado una sola vez por semilla y por proceso de test. */
export function targetWorld(seed = GameConfig.world.SEED) {
  if (!cache.has(seed)) cache.set(seed, generateWorld(configWith(), { seed }));
  return cache.get(seed);
}

/** Copia plana de los ids del mundo, indexada por (y * depth + z) * width + x. */
export function snapshot(world) {
  const blocks = new Uint8Array(world.width * world.height * world.depth);
  for (let y = 0; y < world.height; y += 1) {
    for (let z = 0; z < world.depth; z += 1) {
      for (let x = 0; x < world.width; x += 1) {
        blocks[(y * world.depth + z) * world.width + x] = world.getBlockId(x, y, z);
      }
    }
  }
  return blocks;
}
