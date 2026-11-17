import { PixelCanvas } from './PixelCanvas.js';
import { SeededRandom } from './SeededRandom.js';
import { TilingNoise } from './TilingNoise.js';

/**
 * Textura de las nubes: 128×128 que se repite sin cortes, con nubes de bordes
 * pixelados (cada píxel es un bloque de cielo) y huecos transparentes.
 * Dos escalas de ruido: masas grandes y bordes irregulares.
 */
export class SkyTextureFactory {
  static SIZE = 128;
  /** Fracción del cielo cubierta por nubes. */
  static THRESHOLD = 0.62;

  /** @returns {Map<string, PixelCanvas>} */
  static createAll() {
    return new Map([['clouds.png', SkyTextureFactory.clouds()]]);
  }

  static clouds() {
    const random = SeededRandom.fromString('clouds');
    const size = SkyTextureFactory.SIZE;
    const large = new TilingNoise(random, 9);
    const detail = new TilingNoise(random, 23);
    const canvas = new PixelCanvas(size, size);
    canvas.forEach((x, y) => {
      const value = large.sample(x / size, y / size) * 0.75 + detail.sample(x / size, y / size) * 0.25;
      if (value < SkyTextureFactory.THRESHOLD) {
        canvas.set(x, y, [255, 255, 255], 0);
        return;
      }
      // El centro de cada nube un poco más blanco y opaco que el borde.
      const core = value > SkyTextureFactory.THRESHOLD + 0.07;
      canvas.set(x, y, core ? [250, 252, 255] : [232, 238, 246], core ? 225 : 190);
    });
    return canvas;
  }
}
