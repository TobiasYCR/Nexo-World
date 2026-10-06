import { NoiseGenerator } from './NoiseGenerator.js';
import { TreeFeature } from './TreeFeature.js';
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
    this.treeNoise = new NoiseGenerator((config.SEED + 0x9e3779b9) >>> 0);
    this.treeFeature = new TreeFeature(config);
  }

  /** Altura de terreno, en bloques, para una columna del mundo. */
  columnHeight(x, z) {
    // El ruido fractal vive en [0, 1]; se remapea a [-1, 1] para que la amplitud
    // tanto hunda como levante el terreno respecto de la base.
    const raw = this.noise.fractalNoise2D(x * this.config.NOISE_SCALE, z * this.config.NOISE_SCALE);
    const sample = raw * 2 - 1;
    const height = this.config.BASE_TERRAIN_HEIGHT + Math.round(sample * this.config.TERRAIN_AMPLITUDE);
    return Math.max(1, height);
  }

  generate(world) {
    for (let z = 0; z < world.depth; z += 1) {
      for (let x = 0; x < world.width; x += 1) {
        this.#generateColumn(world, x, z);
      }
    }
    this.#generateTrees(world);
    return world;
  }

  #generateColumn(world, x, z) {
    const surfaceY = Math.min(this.columnHeight(x, z), world.height - 1);

    const isBeach = surfaceY < this.config.SAND_LEVEL;
    for (let y = 0; y <= surfaceY; y += 1) {
      world.setBlockId(x, y, z, this.#blockIdForDepth(surfaceY - y, isBeach));
    }
  }

  /** Capas: césped en la superficie, tierra debajo, piedra en profundidad. */
  #blockIdForDepth(depthFromSurface, isBeach) {
    if (isBeach && depthFromSurface <= 2) return BlockIds.SAND;
    if (depthFromSurface === 0) return BlockIds.GRASS;
    if (depthFromSurface <= 3) return BlockIds.DIRT;
    return BlockIds.STONE;
  }

  #generateTrees(world) {
    const trees = [];
    const margin = TreeFeature.CANOPY_RADIUS + 1;
    for (let z = margin; z < world.depth - margin; z += 1) {
      for (let x = margin; x < world.width - margin; x += 1) {
        if (!this.#shouldTryTree(x, z)) continue;
        if (!this.#isFarEnoughFromTrees(x, z, trees)) continue;
        const surfaceY = world.getSurfaceHeight(x, z);
        const trunkHeight = this.#treeHeightAt(x, z);
        if (!this.treeFeature.place(world, x, surfaceY, z, trunkHeight)) continue;
        trees.push({ x, z });
      }
    }
  }

  #shouldTryTree(x, z) {
    const sample = this.treeNoise.noise2D(x * 0.43, z * 0.43);
    return sample < this.config.TREE_DENSITY;
  }

  #treeHeightAt(x, z) {
    const min = this.config.TREE_MIN_HEIGHT;
    const max = this.config.TREE_MAX_HEIGHT;
    const span = Math.max(0, max - min);
    return min + Math.floor(this.treeNoise.noise2D(x + 17.31, z - 9.73) * (span + 1));
  }

  #isFarEnoughFromTrees(x, z, trees) {
    const minDistance = this.config.TREE_MIN_DISTANCE;
    return trees.every((tree) => Math.hypot(tree.x - x, tree.z - z) >= minDistance);
  }
}
