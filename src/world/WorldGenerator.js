import { NoiseGenerator } from './NoiseGenerator.js';
import { TreeFeature } from './TreeFeature.js';
import { BiomeMap } from './BiomeMap.js';
import { CaveGenerator } from './CaveGenerator.js';
import { OreGenerator } from './OreGenerator.js';
import { createDefaultBiomeRegistry } from './BiomeRegistry.js';
import { BlockIds } from '../utils/Constants.js';
import { GameConfig } from '../game/GameConfig.js';

/**
 * Traduce semilla + configuración en un mundo. Separado de World para que la
 * estrategia de generación cambie sin tocar el almacenamiento.
 *
 * Orden de generación (fijo; cambiarlo cambia el mundo y exige subir VERSION):
 *   1. Biomas y alturas    BiomeMap      mapa 2D de bioma y altura por columna
 *   2. Terreno base        este archivo  piedra desde y=0 hasta la superficie
 *   3. Cuevas              CaveGenerator excava terreno natural bajo la superficie
 *   4. Minerales           OreGenerator  vetas planificadas, solo sobre roca huésped
 *   5. Capas y roca madre  este archivo  superficie del bioma y fondo irrompible
 *   6. Vegetación          TreeFeature   árboles sobre superficies que los admiten
 *
 * Las fases 2 a 5 se resuelven columna por columna en un buffer: cada bloque se
 * escribe en el mundo una sola vez y las cuevas quedan preservadas porque las
 * capas solo cubren el primer tramo sólido visto desde arriba. Los árboles van
 * al final porque necesitan la superficie definitiva de cada columna.
 */
export class WorldGenerator {
  /** Subir cuando un cambio de algoritmo altere el mundo para la misma semilla y configuración. */
  static VERSION = 2;

  /**
   * @param {object} [config] GameConfig. Las secciones que falten se toman de
   *   GameConfig; por compatibilidad también acepta solo la sección world.
   * @param {{seed?: number, biomeRegistry?: import('./BiomeRegistry.js').BiomeRegistry}} [options]
   */
  constructor(config = GameConfig, options = {}) {
    this.config = config.world ? { ...GameConfig, ...config } : { ...GameConfig, world: config };
    this.seed = (options.seed ?? this.config.world.SEED) >>> 0;
    this.biomeRegistry = options.biomeRegistry ?? createDefaultBiomeRegistry(this.config.biomes);
    this.treeFeature = new TreeFeature(this.config.world);
    this.treeNoise = new NoiseGenerator(NoiseGenerator.deriveSeed(this.seed, 'trees'));
    this.clusterNoise = new NoiseGenerator(NoiseGenerator.deriveSeed(this.seed, 'trees:cluster'));
    this.bedrockNoise = new NoiseGenerator(NoiseGenerator.deriveSeed(this.seed, 'bedrock'));
    /** Métricas de la última generación (tiempos por fase, conteos). */
    this.stats = null;
  }

  /** Lo que identifica de forma única al mundo generado junto con la configuración. */
  get signature() {
    return { seed: this.seed, version: WorldGenerator.VERSION };
  }

  /** Factor entre la altura real del mundo y la de referencia de la configuración. */
  heightScaleFor(world) {
    return world.height / this.config.worldGeneration.REFERENCE_HEIGHT;
  }

  /** Mapa de biomas del mundo, para inspección y tests. */
  createBiomeMap(world) {
    return new BiomeMap(this.biomeRegistry, this.config.worldGeneration, this.seed, this.heightScaleFor(world));
  }

  /**
   * Fase 1 sola: bioma y altura de superficie (antes de cuevas) por columna,
   * exactamente como los usa generate(). No escribe en el mundo.
   * @returns {{biomeIds: Uint8Array, heights: Int16Array}} indexados por z * width + x
   */
  planSurface(world) {
    const settings = this.#settingsFor(world);
    return this.createBiomeMap(world).build(world.width, world.depth, settings.minSurface, settings.maxSurface);
  }

  generate(world) {
    const startedAt = performance.now();
    const settings = this.#settingsFor(world);
    const phases = {};

    let phaseStart = performance.now();
    const { biomeIds, heights } = this.createBiomeMap(world)
      .build(world.width, world.depth, settings.minSurface, settings.maxSurface);
    phases.biomes = performance.now() - phaseStart;

    phaseStart = performance.now();
    const caves = new CaveGenerator(this.config.caves, this.seed, settings.heightScale);
    const ores = new OreGenerator(this.config.ores, this.seed, settings.heightScale).plan(world.width, world.height, world.depth);
    phases.orePlanning = performance.now() - phaseStart;

    phaseStart = performance.now();
    const terrain = this.#generateTerrain(world, settings, biomeIds, heights, caves, ores.map);
    phases.terrain = performance.now() - phaseStart;

    phaseStart = performance.now();
    const trees = this.#generateTrees(world, settings, biomeIds, terrain);
    phases.vegetation = performance.now() - phaseStart;

    this.stats = {
      ...this.signature,
      totalMs: performance.now() - startedAt,
      phases,
      blocksWritten: terrain.blocksWritten,
      cavesCarved: terrain.carved,
      trees,
      ores: ores.stats,
      biomeColumns: this.#countBiomes(biomeIds)
    };
    return world;
  }

  /** Valores dependientes del mundo concreto, resueltos una vez por generación. */
  #settingsFor(world) {
    const generation = this.config.worldGeneration;
    const heightScale = this.heightScaleFor(world);
    const registry = world.blockRegistry;
    const bedrockLayers = Math.max(1, Math.round(generation.BEDROCK_LAYERS * heightScale));
    return {
      heightScale,
      bedrockLayers,
      minSurface: bedrockLayers + 1,
      maxSurface: world.height - 1 - Math.max(1, Math.round(generation.SKY_MARGIN * heightScale)),
      carvable: registry.propertyTable('carvable'),
      oreHost: registry.propertyTable('oreHost'),
      sustainsTrees: registry.propertyTable('sustainsTrees'),
      biomesById: new Map(this.biomeRegistry.values().map((biome) => [biome.id, biome]))
    };
  }

  /** Fases 2 a 5, columna por columna. */
  #generateTerrain(world, settings, biomeIds, heights, caves, oreMap) {
    const { width, depth } = world;
    const column = new Uint8Array(world.height);
    const topSolid = new Int16Array(width * depth);
    const topBlock = new Uint8Array(width * depth);
    let blocksWritten = 0;
    let carved = 0;

    for (let z = 0; z < depth; z += 1) {
      for (let x = 0; x < width; x += 1) {
        const index = z * width + x;
        const surfaceY = heights[index];
        const biome = settings.biomesById.get(biomeIds[index]);

        column.fill(BlockIds.AIR);
        column.fill(BlockIds.STONE, 0, surfaceY + 1);
        carved += caves.carveColumn(column, x, z, surfaceY, settings.carvable);
        WorldGenerator.#applyOres(column, oreMap, x, z, width, depth, surfaceY, settings.oreHost);
        const top = this.#applySurfaceLayers(column, biome, surfaceY, this.#slopeAt(heights, x, z, width, depth), settings);
        this.#applyBedrock(column, x, z, settings.bedrockLayers);

        for (let y = 0; y <= surfaceY; y += 1) {
          if (column[y] === BlockIds.AIR) continue;
          world.setBlockId(x, y, z, column[y]);
          blocksWritten += 1;
        }
        topSolid[index] = top;
        topBlock[index] = top >= 0 ? column[top] : BlockIds.AIR;
      }
    }
    return { blocksWritten, carved, topSolid, topBlock };
  }

  static #applyOres(column, oreMap, x, z, width, depth, surfaceY, oreHost) {
    const layerSize = width * depth;
    const offset = z * width + x;
    for (let y = 0; y <= surfaceY; y += 1) {
      const ore = oreMap[y * layerSize + offset];
      if (ore !== 0 && oreHost[column[y]]) column[y] = ore;
    }
  }

  /**
   * Cubre el primer tramo sólido visto desde arriba con las capas del bioma.
   * En laderas empinadas o sobre stoneAltitude la roca queda expuesta.
   * @returns {number} y del bloque sólido más alto, o -1 si la columna quedó vacía
   */
  #applySurfaceLayers(column, biome, surfaceY, slope, settings) {
    let top = surfaceY;
    while (top >= 0 && column[top] === BlockIds.AIR) top -= 1;
    if (top < 0) return -1;

    const scale = settings.heightScale;
    const rockyByAltitude = biome.stoneAltitude !== null && surfaceY >= Math.round(biome.stoneAltitude * scale);
    const rockyBySlope = biome.steepSlope !== null && slope >= Math.max(1, Math.round(biome.steepSlope * scale));
    if (rockyByAltitude || rockyBySlope) return top;

    const layers = biome.surfaceDepth + biome.subsurfaceDepth;
    for (let depth = 0, y = top; depth < layers && y >= 0; depth += 1, y -= 1) {
      if (!settings.carvable[column[y]]) break;
      column[y] = depth < biome.surfaceDepth ? biome.surfaceBlock : biome.subsurfaceBlock;
    }
    return top;
  }

  /** y=0 siempre es roca madre; las capas siguientes lo son con probabilidad decreciente. */
  #applyBedrock(column, x, z, layers) {
    column[0] = BlockIds.BEDROCK;
    for (let y = 1; y < layers; y += 1) {
      if (this.bedrockNoise.random2D(x * column.length + y, z) < 1 - y / layers) column[y] = BlockIds.BEDROCK;
    }
  }

  /** Mayor desnivel con las cuatro columnas vecinas. */
  #slopeAt(heights, x, z, width, depth) {
    const height = heights[z * width + x];
    let slope = 0;
    if (x > 0) slope = Math.max(slope, Math.abs(height - heights[z * width + x - 1]));
    if (x < width - 1) slope = Math.max(slope, Math.abs(height - heights[z * width + x + 1]));
    if (z > 0) slope = Math.max(slope, Math.abs(height - heights[(z - 1) * width + x]));
    if (z < depth - 1) slope = Math.max(slope, Math.abs(height - heights[(z + 1) * width + x]));
    return slope;
  }

  /** Fase 6. Devuelve la cantidad de árboles colocados. */
  #generateTrees(world, settings, biomeIds, terrain) {
    const { width, depth } = world;
    const trunks = new Uint8Array(width * depth);
    const clusterScale = this.config.worldGeneration.TREE_CLUSTER_SCALE;
    let placed = 0;

    for (let z = 0; z < depth; z += 1) {
      for (let x = 0; x < width; x += 1) {
        const index = z * width + x;
        const biome = settings.biomesById.get(biomeIds[index]);
        if (biome.treeDensity <= 0) continue;
        if (biome.treeClustering > 0 && this.clusterNoise.noise2D(x * clusterScale, z * clusterScale) < biome.treeClustering * 0.55) {
          continue;
        }
        if (this.treeNoise.random2D(x, z) >= biome.treeDensity) continue;

        const top = terrain.topSolid[index];
        if (top < 0 || !settings.sustainsTrees[terrain.topBlock[index]]) continue;
        if (!WorldGenerator.#hasRoomForTrunk(trunks, x, z, width, depth, biome.treeSpacing)) continue;

        if (!this.treeFeature.place(world, x, top + 1, z, this.#treeHeightAt(x, z))) continue;
        trunks[index] = 1;
        placed += 1;
      }
    }
    return placed;
  }

  #treeHeightAt(x, z) {
    const min = this.config.world.TREE_MIN_HEIGHT;
    const max = this.config.world.TREE_MAX_HEIGHT;
    const span = Math.max(0, max - min);
    return min + Math.floor(this.treeNoise.random2D(x + 7919, z - 104729) * (span + 1));
  }

  static #hasRoomForTrunk(trunks, x, z, width, depth, spacing) {
    const reach = Math.ceil(spacing) - 1;
    for (let dz = -reach; dz <= reach; dz += 1) {
      const nz = z + dz;
      if (nz < 0 || nz >= depth) continue;
      for (let dx = -reach; dx <= reach; dx += 1) {
        const nx = x + dx;
        if (nx < 0 || nx >= width) continue;
        if (trunks[nz * width + nx] && dx * dx + dz * dz < spacing * spacing) return false;
      }
    }
    return true;
  }

  #countBiomes(biomeIds) {
    const counts = {};
    for (const biome of this.biomeRegistry.values()) counts[biome.name] = 0;
    for (const id of biomeIds) counts[this.biomeRegistry.get(id).name] += 1;
    return counts;
  }
}
