import { NoiseGenerator } from './NoiseGenerator.js';

/**
 * Fase 1 de la generación: decide el bioma de cada columna y su altura de
 * superficie. Trabaja solo con datos (arrays tipados); no escribe en el mundo.
 *
 * Selección: cada bioma tiene su propio campo de ruido de baja frecuencia
 * multiplicado por su peso; gana el de mayor puntaje. Las regiones salen del
 * ruido, nunca de posiciones fijas.
 *
 * Mezcla: cerca de un borde los puntajes se parecen. Todo bioma cuyo puntaje
 * esté a menos de HEIGHT_SMOOTHING del ganador aporta su altura con un peso
 * proporcional a esa cercanía, así que la altura es continua al cruzar el borde
 * y no aparecen paredes verticales entre biomas.
 */
export class BiomeMap {
  #biomes;
  #scoreNoises;
  #detailNoises;

  /**
   * @param {import('./BiomeRegistry.js').BiomeRegistry} biomeRegistry
   * @param {{BIOME_SCALE:number, HEIGHT_SMOOTHING:number}} generationConfig
   * @param {number} seed
   * @param {number} heightScale altura real / altura de referencia
   */
  constructor(biomeRegistry, generationConfig, seed, heightScale) {
    this.config = generationConfig;
    this.heightScale = heightScale;
    this.#biomes = biomeRegistry.values();
    this.#scoreNoises = this.#biomes.map((biome) => new NoiseGenerator(NoiseGenerator.deriveSeed(seed, `biome:${biome.name}`)));
    this.#detailNoises = this.#biomes.map((biome) => new NoiseGenerator(NoiseGenerator.deriveSeed(seed, `relief:${biome.name}`)));
  }

  /**
   * @param {number} width columnas en X
   * @param {number} depth columnas en Z
   * @param {number} minSurface altura mínima de superficie (en bloques reales)
   * @param {number} maxSurface altura máxima de superficie (en bloques reales)
   * @returns {{biomeIds: Uint8Array, heights: Int16Array}} indexados por z * width + x
   */
  build(width, depth, minSurface, maxSurface) {
    const columns = width * depth;
    const biomeIds = new Uint8Array(columns);
    const heights = new Int16Array(columns);
    const scores = new Float64Array(this.#biomes.length);

    for (let z = 0; z < depth; z += 1) {
      for (let x = 0; x < width; x += 1) {
        const winner = this.#scoreColumn(x, z, scores);
        const height = this.#blendedHeight(x, z, scores, scores[winner]);
        const index = z * width + x;
        biomeIds[index] = this.#biomes[winner].id;
        heights[index] = Math.max(minSurface, Math.min(maxSurface, Math.round(height)));
      }
    }
    return { biomeIds, heights };
  }

  /** Bioma ganador de una columna, sin calcular alturas. Útil para depurar y testear. */
  biomeAt(x, z) {
    const scores = new Float64Array(this.#biomes.length);
    return this.#biomes[this.#scoreColumn(x, z, scores)];
  }

  /** Llena scores y devuelve el índice del bioma con mayor puntaje. */
  #scoreColumn(x, z, scores) {
    const scale = this.config.BIOME_SCALE;
    let winner = 0;
    for (let index = 0; index < this.#biomes.length; index += 1) {
      scores[index] = this.#scoreNoises[index].fractalNoise2D(x * scale, z * scale, 2) * this.#biomes[index].weight;
      if (scores[index] > scores[winner]) winner = index;
    }
    return winner;
  }

  #blendedHeight(x, z, scores, bestScore) {
    const smoothing = this.config.HEIGHT_SMOOTHING;
    let weightedHeight = 0;
    let totalWeight = 0;
    for (let index = 0; index < this.#biomes.length; index += 1) {
      const blend = 1 - (bestScore - scores[index]) / smoothing;
      if (blend <= 0) continue;
      // Suavizado cúbico: la influencia entra y sale sin quiebres de pendiente.
      const weight = blend * blend * (3 - 2 * blend);
      weightedHeight += weight * this.#biomeHeight(index, x, z);
      totalWeight += weight;
    }
    return weightedHeight / totalWeight;
  }

  #biomeHeight(index, x, z) {
    const biome = this.#biomes[index];
    const sample = this.#detailNoises[index].fractalNoise2D(x * biome.noiseScale, z * biome.noiseScale, 3);
    return (biome.terrainHeight + biome.shapeSample(sample) * biome.terrainVariation) * this.heightScale;
  }
}
