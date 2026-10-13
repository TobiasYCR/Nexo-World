/** Formas de relieve que un bioma puede pedirle al generador. */
export const TerrainShapes = Object.freeze({
  /** Ondulado: el ruido sube y baja alrededor de la altura base. */
  ROLLING: 'rolling',
  /** Crestas: el ruido solo levanta; valles amplios y picos marcados. */
  RIDGED: 'ridged'
});

/**
 * Definición inmutable de un bioma. Describe el paisaje (alturas, capas,
 * vegetación) con datos puros: no conoce el mundo, el renderer ni p5.
 *
 * Todas las alturas están en bloques sobre un mundo de altura de referencia
 * (worldGeneration.REFERENCE_HEIGHT); el generador las escala a la altura real.
 */
export class BiomeType {
  /** Cuánto se estira la distancia a la cresta antes de elevarla al cuadrado. */
  static RIDGE_STRETCH = 2.2;

  constructor({
    id,
    name,
    label = name,
    weight = 1,
    surfaceBlock,
    surfaceDepth = 1,
    subsurfaceBlock,
    subsurfaceDepth = 3,
    terrainHeight,
    terrainVariation,
    terrainShape = TerrainShapes.ROLLING,
    /** Escala del ruido de detalle: más alto, relieve más cortado. */
    noiseScale = 0.04,
    /** Probabilidad de intentar un árbol por columna. */
    treeDensity = 0,
    /** 0 = árboles uniformes, 1 = agrupados con claros entre grupos. */
    treeClustering = 0,
    /** Distancia mínima entre troncos, en bloques. */
    treeSpacing = 4,
    /** Altura desde la que la superficie queda en piedra expuesta (null = nunca). */
    stoneAltitude = null,
    /** Desnivel con columnas vecinas a partir del cual la ladera queda en piedra (null = nunca). */
    steepSlope = null
  }) {
    if (!Number.isInteger(id) || id < 0) throw new TypeError(`BiomeType "${name}": id debe ser un entero >= 0.`);
    if (!name) throw new TypeError(`BiomeType con id ${id}: name es obligatorio.`);
    if (!Number.isInteger(surfaceBlock) || !Number.isInteger(subsurfaceBlock)) {
      throw new TypeError(`BiomeType "${name}": surfaceBlock y subsurfaceBlock deben ser ids de bloque.`);
    }
    if (!Number.isFinite(terrainHeight) || !Number.isFinite(terrainVariation) || terrainVariation < 0) {
      throw new TypeError(`BiomeType "${name}": terrainHeight y terrainVariation deben ser números válidos.`);
    }
    if (!Object.values(TerrainShapes).includes(terrainShape)) {
      throw new TypeError(`BiomeType "${name}": terrainShape desconocido "${terrainShape}".`);
    }
    if (!(weight >= 0)) throw new TypeError(`BiomeType "${name}": weight debe ser >= 0.`);

    this.id = id;
    this.name = name;
    this.label = label;
    this.weight = weight;
    this.surfaceBlock = surfaceBlock;
    this.surfaceDepth = surfaceDepth;
    this.subsurfaceBlock = subsurfaceBlock;
    this.subsurfaceDepth = subsurfaceDepth;
    this.terrainHeight = terrainHeight;
    this.terrainVariation = terrainVariation;
    this.terrainShape = terrainShape;
    this.noiseScale = noiseScale;
    this.treeDensity = treeDensity;
    this.treeClustering = treeClustering;
    this.treeSpacing = treeSpacing;
    this.stoneAltitude = stoneAltitude;
    this.steepSlope = steepSlope;

    Object.freeze(this);
  }

  /**
   * Forma del relieve normalizada a [-1, 1] (ondulado) o [0, 1] (crestas, al cuadrado),
   * a partir de una muestra de ruido en [0, 1).
   */
  shapeSample(sample) {
    if (this.terrainShape === TerrainShapes.RIDGED) {
      // El ruido fractal se concentra cerca de 0.5: se estira para que haya valles reales.
      const distance = Math.min(1, Math.abs(sample * 2 - 1) * BiomeType.RIDGE_STRETCH);
      const ridge = 1 - distance;
      return ridge * ridge;
    }
    return sample * 2 - 1;
  }
}
