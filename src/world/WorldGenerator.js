import { NoiseGenerator } from './NoiseGenerator.js';
import { BlockIds } from '../utils/Constants.js';
import { GameConfig } from '../game/GameConfig.js';

/**
 * Traduce ruido en capas de terreno y las escribe en un World.
 * Separado de World para que la estrategia de generación pueda cambiarse
 * (cuevas, biomas, estructuras) sin tocar el almacenamiento.
 */
export class WorldGenerator {
  constructor(config = GameConfig.world) {
    this.config = config;
    this.noise = new NoiseGenerator(config.SEED);
  }

  /** Altura de terreno, en bloques, para una columna del mundo. */
  columnHeight(x, z) {
    const sample = this.noise.fractalNoise2D(x * this.config.NOISE_SCALE, z * this.config.NOISE_SCALE);
    const height = this.config.BASE_TERRAIN_HEIGHT + Math.round(sample * this.config.TERRAIN_AMPLITUDE);
    return Math.max(1, height);
  }

  generate(world) {
    for (let z = 0; z < world.depth; z += 1) {
      for (let x = 0; x < world.width; x += 1) {
        this.#generateColumn(world, x, z);
      }
    }
    return world;
  }

  #generateColumn(world, x, z) {
    const surfaceY = Math.min(this.columnHeight(x, z), world.height - 1);

    for (let y = 0; y <= surfaceY; y += 1) {
      world.setBlockId(x, y, z, this.#blockIdForDepth(surfaceY - y));
    }
  }

  /** Capas: césped en la superficie, tierra debajo, piedra en profundidad. */
  #blockIdForDepth(depthFromSurface) {
    if (depthFromSurface === 0) return BlockIds.GRASS;
    if (depthFromSurface <= 3) return BlockIds.DIRT;
    return BlockIds.STONE;
  }
}
