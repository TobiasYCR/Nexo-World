import { PixelCanvas } from './PixelCanvas.js';
import { SeededRandom } from './SeededRandom.js';

/**
 * Diez etapas de grieta 16x16, para superponer sobre el bloque que se está
 * rompiendo (ver BreakOverlay). Cada etapa es determinista: misma semilla
 * derivada del número de etapa, siempre el mismo resultado byte a byte.
 *
 * El lienzo arranca totalmente transparente (PixelCanvas inicializa su buffer
 * en cero, y alpha 0 es el cuarto canal); las grietas son caminatas aleatorias
 * oscuras que se acumulan en cantidad y opacidad a medida que sube la etapa.
 */
export class CrackTextureFactory {
  static SIZE = 16;
  static STAGE_COUNT = 10;
  static CRACK_COLOR = [12, 10, 9];

  /** @returns {Map<string, PixelCanvas>} nombre de archivo -> lienzo */
  static createAll() {
    const files = new Map();
    for (let stage = 0; stage < CrackTextureFactory.STAGE_COUNT; stage += 1) {
      files.set(`crack_${stage}.png`, CrackTextureFactory.stage(stage));
    }
    return files;
  }

  /**
   * @param {number} stage etapa 0 (recién empezada) a 9 (a punto de romperse)
   */
  static stage(stage) {
    const size = CrackTextureFactory.SIZE;
    const canvas = new PixelCanvas(size, size);
    const random = SeededRandom.fromString(`crack-${stage}`);

    const crackCount = 2 + stage;
    const baseAlpha = 70 + stage * 17;

    for (let crack = 0; crack < crackCount; crack += 1) {
      CrackTextureFactory.#drawCrack(canvas, random, size, 4 + random.int(3) + stage, baseAlpha);
    }
    return canvas;
  }

  /** Caminata aleatoria oscura, con alguna rama corta, envolviendo en los bordes. */
  static #drawCrack(canvas, random, size, steps, baseAlpha) {
    let x = random.int(size);
    let y = random.int(size);

    for (let step = 0; step < steps; step += 1) {
      const alpha = Math.min(255, baseAlpha + random.int(30));
      canvas.set(x, y, CrackTextureFactory.CRACK_COLOR, alpha);

      if (random.next() < 0.3) {
        const branchX = CrackTextureFactory.#wrap(x + (random.next() < 0.5 ? -1 : 1), size);
        canvas.set(branchX, y, CrackTextureFactory.CRACK_COLOR, Math.min(255, alpha * 0.6));
      }

      x = CrackTextureFactory.#wrap(x + random.int(3) - 1, size);
      y = CrackTextureFactory.#wrap(y + (random.next() < 0.6 ? 1 : random.int(3) - 1), size);
    }
  }

  static #wrap(value, size) {
    return ((value % size) + size) % size;
  }
}
