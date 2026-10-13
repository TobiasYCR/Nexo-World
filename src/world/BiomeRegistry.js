import { BiomeType, TerrainShapes } from './BiomeType.js';
import { BlockIds } from '../utils/Constants.js';
import { GameConfig } from '../game/GameConfig.js';

/** Identificadores estables de bioma. */
export const BiomeIds = Object.freeze({
  PLAINS: 0,
  FOREST: 1,
  DESERT: 2,
  MOUNTAINS: 3
});

/**
 * Catálogo de biomas. Como BlockRegistry, es el único lugar donde se declaran
 * propiedades por bioma; el generador nunca compara ids de bioma para decidir.
 * No depende del sistema gráfico.
 */
export class BiomeRegistry {
  #byId = new Map();

  register(definition) {
    const biome = definition instanceof BiomeType ? definition : new BiomeType(definition);
    if (this.#byId.has(biome.id)) throw new Error(`Ya existe un bioma con id ${biome.id}.`);
    this.#byId.set(biome.id, biome);
    return biome;
  }

  get(id) {
    const biome = this.#byId.get(id);
    if (!biome) throw new RangeError(`Bioma desconocido: id ${id}.`);
    return biome;
  }

  has(id) {
    return this.#byId.has(id);
  }

  /** Biomas en orden de registro. */
  values() {
    return [...this.#byId.values()];
  }

  get size() {
    return this.#byId.size;
  }
}

/**
 * Valores pensados para un mundo de 48 bloques de alto (REFERENCE_HEIGHT).
 * Los pesos salen de GameConfig.biomes para poder ajustar la proporción de
 * cada bioma sin tocar estas definiciones.
 */
function defaultBiomeDefinitions(weights) {
  return [
    {
      id: BiomeIds.PLAINS,
      name: 'Plains',
      label: 'Llanura',
      weight: weights.PLAINS_WEIGHT,
      surfaceBlock: BlockIds.GRASS,
      subsurfaceBlock: BlockIds.DIRT,
      subsurfaceDepth: 3,
      terrainHeight: 20,
      terrainVariation: 2,
      noiseScale: 0.03,
      treeDensity: 0.012,
      treeSpacing: 6
    },
    {
      id: BiomeIds.FOREST,
      name: 'Forest',
      label: 'Bosque',
      weight: weights.FOREST_WEIGHT,
      surfaceBlock: BlockIds.GRASS,
      subsurfaceBlock: BlockIds.DIRT,
      subsurfaceDepth: 4,
      terrainHeight: 22,
      terrainVariation: 4,
      noiseScale: 0.045,
      treeDensity: 0.16,
      treeClustering: 0.6,
      treeSpacing: 3
    },
    {
      id: BiomeIds.DESERT,
      name: 'Desert',
      label: 'Desierto',
      weight: weights.DESERT_WEIGHT,
      surfaceBlock: BlockIds.SAND,
      surfaceDepth: 3,
      subsurfaceBlock: BlockIds.SANDSTONE,
      subsurfaceDepth: 5,
      terrainHeight: 19,
      terrainVariation: 3,
      noiseScale: 0.06,
      treeDensity: 0
    },
    {
      id: BiomeIds.MOUNTAINS,
      name: 'Mountains',
      label: 'Montañas',
      weight: weights.MOUNTAINS_WEIGHT,
      surfaceBlock: BlockIds.GRASS,
      subsurfaceBlock: BlockIds.DIRT,
      subsurfaceDepth: 2,
      terrainHeight: 23,
      terrainVariation: 19,
      terrainShape: TerrainShapes.RIDGED,
      noiseScale: 0.035,
      treeDensity: 0.006,
      treeSpacing: 6,
      stoneAltitude: 32,
      steepSlope: 3
    }
  ];
}

export function createDefaultBiomeRegistry(weights = GameConfig.biomes) {
  const registry = new BiomeRegistry();
  for (const definition of defaultBiomeDefinitions(weights)) registry.register(definition);
  return registry;
}
