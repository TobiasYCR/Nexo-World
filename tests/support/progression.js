import { World } from '../../src/world/World.js';
import { WorldGenerator } from '../../src/world/WorldGenerator.js';
import { NaturalTerrain } from '../../src/world/NaturalTerrain.js';
import { createDefaultBlockRegistry } from '../../src/blocks/BlockRegistry.js';
import { GameConfig } from '../../src/game/GameConfig.js';
import { WorldKey } from '../../src/progression/WorldKey.js';
import { BlockIds } from '../../src/utils/Constants.js';

let cached = null;

/** Mundo por defecto (32x24x32) generado una vez, con su foto natural y su clave. */
export function defaultWorld() {
  if (!cached) {
    const world = new World(createDefaultBlockRegistry(), GameConfig);
    const generator = new WorldGenerator(GameConfig);
    generator.generate(world);
    cached = { world, generator, terrain: NaturalTerrain.fromGeneration(world, generator), worldKey: WorldKey.fromGenerator(generator, world) };
  }
  return cached;
}

/** Primeras posiciones donde el generador puso el bloque pedido. */
export function findNatural(terrain, blockId, count = 1) {
  const found = [];
  for (let y = 0; y < terrain.height && found.length < count; y += 1) {
    for (let z = 0; z < terrain.depth && found.length < count; z += 1) {
      for (let x = 0; x < terrain.width && found.length < count; x += 1) {
        if (terrain.blockIdAt(x, y, z) === blockId) found.push({ x, y, z });
      }
    }
  }
  return found;
}

export const ORE_IDS = [BlockIds.COAL_ORE, BlockIds.IRON_ORE, BlockIds.GOLD_ORE, BlockIds.DIAMOND_ORE];
