import { NoiseGenerator } from './NoiseGenerator.js';
import { BlockIds } from '../utils/Constants.js';

/**
 * Fase de cuevas. Combina dos técnicas de ruido 3D determinista:
 *   - Cavernas: zonas donde un ruido de baja frecuencia supera THRESHOLD.
 *     Dan salas de tamaños variados.
 *   - Túneles: la intersección de dos superficies de ruido (|n - 0.5| < r en
 *     ambos campos) forma tubos largos que conectan algunas salas entre sí.
 *
 * Solo excava bloques marcados como carvable en el registro (terreno natural):
 * nunca toca bloques colocados después, como árboles o construcciones. Se usa
 * una única vez, al crear el mundo, sobre el buffer de cada columna.
 */
export class CaveGenerator {
  #cavernNoise;
  #tunnelNoiseA;
  #tunnelNoiseB;
  #entranceNoise;
  #cavernColumn = new Float64Array(0);
  #tunnelColumnA = new Float64Array(0);
  #tunnelColumnB = new Float64Array(0);

  /**
   * @param {object} config GameConfig.caves
   * @param {number} seed semilla del mundo
   * @param {number} heightScale altura real / altura de referencia
   */
  constructor(config, seed, heightScale) {
    this.config = config;
    this.enabled = Boolean(config.ENABLED);
    this.minY = Math.max(1, Math.round(config.MIN_DEPTH * heightScale));
    this.maxY = Math.round(config.MAX_DEPTH * heightScale);
    this.surfaceMargin = Math.max(1, Math.round(config.SURFACE_MARGIN * heightScale));
    this.#cavernNoise = new NoiseGenerator(NoiseGenerator.deriveSeed(seed, 'caves:cavern'));
    this.#tunnelNoiseA = new NoiseGenerator(NoiseGenerator.deriveSeed(seed, 'caves:tunnel-a'));
    this.#tunnelNoiseB = new NoiseGenerator(NoiseGenerator.deriveSeed(seed, 'caves:tunnel-b'));
    this.#entranceNoise = new NoiseGenerator(NoiseGenerator.deriveSeed(seed, 'caves:entrance'));
  }

  /** True si la celda pertenece a una caverna o a un túnel. No mira límites ni superficie. */
  isCave(x, y, z) {
    const config = this.config;
    // Mismo orden de operaciones que carveColumn() para que ambos coincidan bit a bit.
    const cavernFrequency = config.CAVERN_FREQUENCY;
    const cavernY = y * (config.VERTICAL_SQUASH * cavernFrequency);
    if (this.#cavernNoise.noise3D(x * cavernFrequency, cavernY, z * cavernFrequency) > config.THRESHOLD) return true;

    const frequency = config.FREQUENCY;
    const tunnelY = y * (config.VERTICAL_SQUASH * frequency);
    const radius = config.TUNNEL_RADIUS;
    const a = this.#tunnelNoiseA.noise3D(x * frequency, tunnelY, z * frequency);
    if (Math.abs(a - 0.5) >= radius) return false;
    const b = this.#tunnelNoiseB.noise3D(x * frequency, tunnelY, z * frequency);
    return Math.abs(b - 0.5) < radius;
  }

  /**
   * Altura máxima que se puede excavar en la columna. Por defecto la cueva
   * respeta SURFACE_MARGIN bloques de techo; solo en zonas de entrada (ruido 2D
   * por encima de ENTRANCE_THRESHOLD) puede abrirse hacia la superficie.
   */
  ceilingFor(x, z, surfaceY) {
    const config = this.config;
    const opening = this.#entranceNoise.noise2D(x * config.ENTRANCE_SCALE, z * config.ENTRANCE_SCALE) > config.ENTRANCE_THRESHOLD;
    return Math.min(this.maxY, opening ? surfaceY : surfaceY - this.surfaceMargin);
  }

  /**
   * Excava la columna en el buffer recibido.
   * @param {Uint8Array} column ids de bloque indexados por y
   * @param {number} x
   * @param {number} z
   * @param {number} surfaceY y del bloque de superficie de la columna
   * @param {Uint8Array} carvable tabla id -> 1 si es terreno natural excavable
   * @returns {number} cantidad de bloques excavados
   */
  carveColumn(column, x, z, surfaceY, carvable) {
    if (!this.enabled) return 0;
    const top = Math.min(this.ceilingFor(x, z, surfaceY), column.length - 1);
    if (top < this.minY) return 0;
    this.#ensureColumnBuffers(column.length);

    // Mismo criterio que isCave(), pero con el ruido muestreado por columna:
    // los vértices de la grilla se reutilizan entre alturas consecutivas.
    const config = this.config;
    const cavernFrequency = config.CAVERN_FREQUENCY;
    const frequency = config.FREQUENCY;
    const cavern = this.#cavernNoise.noise3DColumn(
      x * cavernFrequency, z * cavernFrequency, config.VERTICAL_SQUASH * cavernFrequency, this.minY, top, this.#cavernColumn
    );
    const tunnelA = this.#tunnelNoiseA.noise3DColumn(
      x * frequency, z * frequency, config.VERTICAL_SQUASH * frequency, this.minY, top, this.#tunnelColumnA
    );
    const tunnelB = this.#tunnelNoiseB.noise3DColumn(
      x * frequency, z * frequency, config.VERTICAL_SQUASH * frequency, this.minY, top, this.#tunnelColumnB
    );

    const radius = config.TUNNEL_RADIUS;
    let carved = 0;
    for (let y = this.minY; y <= top; y += 1) {
      if (!carvable[column[y]]) continue;
      const isCavern = cavern[y] > config.THRESHOLD;
      const isTunnel = Math.abs(tunnelA[y] - 0.5) < radius && Math.abs(tunnelB[y] - 0.5) < radius;
      if (!isCavern && !isTunnel) continue;
      column[y] = BlockIds.AIR;
      carved += 1;
    }
    return carved;
  }

  #ensureColumnBuffers(height) {
    if (this.#cavernColumn.length >= height) return;
    this.#cavernColumn = new Float64Array(height);
    this.#tunnelColumnA = new Float64Array(height);
    this.#tunnelColumnB = new Float64Array(height);
  }

}
