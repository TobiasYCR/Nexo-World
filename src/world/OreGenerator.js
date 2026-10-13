import { NoiseGenerator } from './NoiseGenerator.js';
import { SeededRandom } from './SeededRandom.js';

/**
 * Fase de minerales. Planifica vetas sobre un mapa 3D (un id por celda) que el
 * generador aplica al recorrer cada columna, de modo que el mundo se escribe una
 * sola vez. Un mineral solo reemplaza bloques marcados como oreHost en el
 * registro, así que nunca aparece en el aire de una cueva ni en la tierra.
 *
 * Cantidad: VEINS_PER_CHUNK vetas por cada 16x16 columnas (redondeado sobre el
 * área total). Altura: uniforme en [MIN_Y, MAX_Y], escalada a la altura real.
 * Forma: caminata aleatoria con pasos sobre los ejes, que da vetas conectadas
 * por cara de entre MIN_SIZE y MAX_SIZE bloques.
 */
export class OreGenerator {
  static CHUNK_AREA = 16 * 16;

  /**
   * @param {object} config GameConfig.ores: { NOMBRE: { BLOCK, MIN_Y, MAX_Y, VEINS_PER_CHUNK, MIN_SIZE, MAX_SIZE } }
   * @param {number} seed semilla del mundo
   * @param {number} heightScale altura real / altura de referencia
   */
  constructor(config, seed, heightScale) {
    this.config = config;
    this.seed = seed;
    this.heightScale = heightScale;
  }

  static veinCount(veinsPerChunk, width, depth) {
    return Math.round((veinsPerChunk * width * depth) / OreGenerator.CHUNK_AREA);
  }

  /** Rango vertical efectivo de un mineral para un mundo de la altura dada. */
  rangeFor(name, worldHeight) {
    const ore = this.config[name];
    const minY = Math.max(0, Math.round(ore.MIN_Y * this.heightScale));
    const maxY = Math.min(worldHeight - 1, Math.round(ore.MAX_Y * this.heightScale));
    return { minY, maxY };
  }

  /**
   * @returns {{map: Uint8Array, stats: Object<string, {veins:number, cells:number}>}}
   *   map indexado por (y * depth + z) * width + x; 0 = sin mineral
   */
  plan(width, height, depth) {
    const map = new Uint8Array(width * height * depth);
    const stats = {};

    // Orden de declaración: los más raros, declarados al final, pisan a los comunes.
    for (const [name, ore] of Object.entries(this.config)) {
      const random = new SeededRandom(NoiseGenerator.deriveSeed(this.seed, `ore:${name}`));
      const { minY, maxY } = this.rangeFor(name, height);
      // En un mundo más bajo que el rango del mineral no hay dónde ubicarlo.
      const veins = maxY < minY ? 0 : OreGenerator.veinCount(ore.VEINS_PER_CHUNK, width, depth);
      let cells = 0;

      for (let vein = 0; vein < veins; vein += 1) {
        let x = random.int(width);
        let y = random.range(minY, maxY);
        let z = random.int(depth);
        const size = random.range(ore.MIN_SIZE, ore.MAX_SIZE);

        for (let step = 0; step < size; step += 1) {
          const index = (y * depth + z) * width + x;
          if (map[index] !== ore.BLOCK) cells += 1;
          map[index] = ore.BLOCK;

          const axis = random.int(3);
          const direction = random.next() < 0.5 ? -1 : 1;
          // Los pasos que saldrían del mundo o del rango del mineral se descartan.
          if (axis === 0 && x + direction >= 0 && x + direction < width) x += direction;
          else if (axis === 1 && y + direction >= minY && y + direction <= maxY) y += direction;
          else if (axis === 2 && z + direction >= 0 && z + direction < depth) z += direction;
        }
      }
      stats[name] = { veins, cells };
    }
    return { map, stats };
  }
}
