import { PixelCanvas } from './PixelCanvas.js';
import { SeededRandom } from './SeededRandom.js';
import { TilingNoise } from './TilingNoise.js';

/**
 * Diseños de las texturas de bloque. Cada material combina ruido periódico
 * cuantizado a una paleta corta (pixel art, no ruido continuo) con un rasgo
 * propio que lo distingue de lejos: hojas en el césped, piedritas en la tierra,
 * grietas en la piedra, tablas en la madera y grano fino en la arena.
 */
export class BlockTextureFactory {
  static SIZE = 16;

  static PALETTES = Object.freeze({
    grass: [[52, 110, 38], [66, 132, 46], [82, 152, 56], [101, 172, 68], [128, 194, 86]],
    dirt: [[86, 58, 38], [104, 71, 46], [121, 84, 55], [138, 98, 66]],
    stone: [[104, 104, 110], [118, 118, 124], [132, 132, 138], [148, 148, 153]],
    wood: [[122, 86, 46], [141, 101, 56], [158, 116, 66], [174, 131, 78]],
    sand: [[208, 186, 128], [218, 198, 140], [227, 208, 152], [235, 219, 168]]
  });

  /** @returns {Map<string, PixelCanvas>} nombre de archivo -> lienzo */
  static createAll() {
    return new Map([
      ['grass.png', BlockTextureFactory.grass()],
      ['dirt.png', BlockTextureFactory.dirt()],
      ['stone.png', BlockTextureFactory.stone()],
      ['wood.png', BlockTextureFactory.wood()],
      ['sand.png', BlockTextureFactory.sand()]
    ]);
  }

  static grass() {
    const random = SeededRandom.fromString('grass');
    const canvas = BlockTextureFactory.#noiseFill(random, BlockTextureFactory.PALETTES.grass, 4, 0.35);
    const light = BlockTextureFactory.PALETTES.grass[4];
    // Hojas: un píxel claro con sombra debajo.
    for (let blade = 0; blade < 18; blade += 1) {
      const x = random.int(BlockTextureFactory.SIZE);
      const y = random.int(BlockTextureFactory.SIZE);
      canvas.set(x, y, light);
      canvas.shade(x, y + 1, 0.78);
    }
    return canvas;
  }

  static dirt() {
    const random = SeededRandom.fromString('dirt');
    const canvas = BlockTextureFactory.#noiseFill(random, BlockTextureFactory.PALETTES.dirt, 4, 0.4);
    for (let pebble = 0; pebble < 7; pebble += 1) {
      const x = random.int(BlockTextureFactory.SIZE);
      const y = random.int(BlockTextureFactory.SIZE);
      canvas.set(x, y, [163, 136, 104]);
      canvas.shade(x, y + 1, 0.7);
    }
    for (let speck = 0; speck < 10; speck += 1) {
      canvas.shade(random.int(BlockTextureFactory.SIZE), random.int(BlockTextureFactory.SIZE), 0.72);
    }
    return canvas;
  }

  static stone() {
    const random = SeededRandom.fromString('stone');
    const canvas = BlockTextureFactory.#noiseFill(random, BlockTextureFactory.PALETTES.stone, 4, 0.25);
    // Grietas: caminatas aleatorias oscuras con brillo en el borde superior.
    for (let crack = 0; crack < 4; crack += 1) {
      let x = random.int(BlockTextureFactory.SIZE);
      let y = random.int(BlockTextureFactory.SIZE);
      for (let step = 0; step < 5; step += 1) {
        canvas.set(x, y, [88, 88, 94]);
        canvas.set(x, y - 1, [160, 160, 165]);
        x += random.next() < 0.7 ? 1 : 0;
        y += random.int(3) - 1;
      }
    }
    return canvas;
  }

  static wood() {
    const random = SeededRandom.fromString('wood');
    const palette = BlockTextureFactory.PALETTES.wood;
    const size = BlockTextureFactory.SIZE;
    const plankHeight = 4;
    // Veta estirada en X: poca frecuencia horizontal, mucha vertical.
    const grain = new TilingNoise(random, 2, 16);
    const canvas = new PixelCanvas(size, size);

    for (let plank = 0; plank < size / plankHeight; plank += 1) {
      const tone = random.int(2);
      const seamX = random.int(size);
      for (let row = 0; row < plankHeight; row += 1) {
        const y = plank * plankHeight + row;
        for (let x = 0; x < size; x += 1) {
          const level = Math.min(palette.length - 1, tone + Math.floor(grain.sample(x / size, y / size) * 2.99));
          canvas.set(x, y, palette[level]);
        }
        canvas.set(seamX, y, [92, 64, 34]);
      }
      // Junta inferior de cada tabla.
      for (let x = 0; x < size; x += 1) canvas.set(x, plank * plankHeight + plankHeight - 1, [96, 67, 36]);
    }
    return canvas;
  }

  static sand() {
    const random = SeededRandom.fromString('sand');
    const canvas = BlockTextureFactory.#noiseFill(random, BlockTextureFactory.PALETTES.sand, 2, 0.5);
    for (let grain = 0; grain < 12; grain += 1) {
      canvas.shade(random.int(BlockTextureFactory.SIZE), random.int(BlockTextureFactory.SIZE), 0.88);
    }
    return canvas;
  }

  /**
   * Relleno base: ruido periódico + variación por píxel, cuantizado a la paleta.
   * @param {number} cells frecuencia del ruido (celdas por lado)
   * @param {number} jitter peso de la variación por píxel frente al ruido suave
   */
  static #noiseFill(random, palette, cells, jitter) {
    const size = BlockTextureFactory.SIZE;
    const noise = new TilingNoise(random, cells);
    const canvas = new PixelCanvas(size, size);
    canvas.forEach((x, y) => {
      const value = noise.sample(x / size, y / size) * (1 - jitter) + random.next() * jitter;
      const level = Math.min(palette.length - 1, Math.floor(value * palette.length));
      canvas.set(x, y, palette[level]);
    });
    return canvas;
  }
}
