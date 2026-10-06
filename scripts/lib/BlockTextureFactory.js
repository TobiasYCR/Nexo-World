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
    bark: [[72, 47, 27], [96, 61, 34], [122, 78, 44], [148, 96, 55]],
    leaves: [[36, 88, 34], [47, 110, 41], [62, 135, 49], [82, 158, 61]],
    sand: [[208, 186, 128], [218, 198, 140], [227, 208, 152], [235, 219, 168]],
    glass: [[134, 190, 210], [168, 220, 235], [205, 242, 248]]
  });

  /** @returns {Map<string, PixelCanvas>} nombre de archivo -> lienzo */
  static createAll() {
    return new Map([
      ['grass_top.png', BlockTextureFactory.grassTop()],
      ['grass_side.png', BlockTextureFactory.grassSide()],
      ['dirt.png', BlockTextureFactory.dirt()],
      ['stone.png', BlockTextureFactory.stone()],
      ['log_top.png', BlockTextureFactory.logTop()],
      ['log_side.png', BlockTextureFactory.logSide()],
      ['leaves.png', BlockTextureFactory.leaves()],
      ['planks.png', BlockTextureFactory.planks()],
      ['sand.png', BlockTextureFactory.sand()],
      ['cobblestone.png', BlockTextureFactory.cobblestone()],
      ['glass.png', BlockTextureFactory.glass()]
    ]);
  }

  static grassTop() {
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

  static grassSide() {
    const random = SeededRandom.fromString('grass_side');
    const canvas = BlockTextureFactory.dirt();
    const grassPalette = BlockTextureFactory.PALETTES.grass;
    for (let x = 0; x < BlockTextureFactory.SIZE; x += 1) {
      const lip = 6 + random.int(2);
      for (let y = 0; y < lip; y += 1) {
        const color = grassPalette[Math.min(grassPalette.length - 1, 1 + random.int(3))];
        canvas.set(x, y, color);
      }
      canvas.shade(x, lip, 0.78);
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

  static planks() {
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

  static logSide() {
    const random = SeededRandom.fromString('log_side');
    const palette = BlockTextureFactory.PALETTES.bark;
    const canvas = BlockTextureFactory.#noiseFill(random, palette, 3, 0.28);
    for (let x = 2; x < BlockTextureFactory.SIZE; x += 4) {
      for (let y = 0; y < BlockTextureFactory.SIZE; y += 1) {
        canvas.set(x, y, [58, 37, 22]);
        if (y % 5 === 0) canvas.set(x + 1, y, [158, 105, 61]);
      }
    }
    return canvas;
  }

  static logTop() {
    const random = SeededRandom.fromString('log_top');
    const canvas = new PixelCanvas(BlockTextureFactory.SIZE, BlockTextureFactory.SIZE);
    const center = (BlockTextureFactory.SIZE - 1) / 2;
    canvas.forEach((x, y) => {
      const distance = Math.hypot(x - center, y - center);
      const ring = Math.floor(distance / 2);
      const base = distance > 7
        ? [88, 54, 30]
        : ring % 2 === 0
          ? [232, 186, 92]
          : [180, 112, 48];
      const jitter = 0.9 + random.next() * 0.18;
      canvas.set(x, y, base.map((channel) => Math.round(channel * jitter)));
    });
    return canvas;
  }

  static leaves() {
    const random = SeededRandom.fromString('leaves');
    const canvas = BlockTextureFactory.#noiseFill(random, BlockTextureFactory.PALETTES.leaves, 4, 0.42);
    for (let hole = 0; hole < 18; hole += 1) {
      canvas.set(random.int(BlockTextureFactory.SIZE), random.int(BlockTextureFactory.SIZE), [24, 74, 28], 185);
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

  static cobblestone() {
    const random = SeededRandom.fromString('cobblestone');
    const canvas = BlockTextureFactory.#noiseFill(random, BlockTextureFactory.PALETTES.stone, 4, 0.32);
    for (let y = 0; y < BlockTextureFactory.SIZE; y += 4) {
      for (let x = 0; x < BlockTextureFactory.SIZE; x += 1) canvas.set(x, y, [82, 82, 88]);
    }
    for (let x = 0; x < BlockTextureFactory.SIZE; x += 5) {
      const offset = random.int(4);
      for (let y = offset; y < BlockTextureFactory.SIZE; y += 1) canvas.set(x, y, [92, 92, 98]);
    }
    return canvas;
  }

  static glass() {
    const canvas = new PixelCanvas(BlockTextureFactory.SIZE, BlockTextureFactory.SIZE);
    canvas.forEach((x, y) => {
      const edge = x === 0 || y === 0 || x === BlockTextureFactory.SIZE - 1 || y === BlockTextureFactory.SIZE - 1;
      canvas.set(x, y, edge ? BlockTextureFactory.PALETTES.glass[1] : BlockTextureFactory.PALETTES.glass[0], edge ? 165 : 72);
    });
    for (let i = 2; i < 8; i += 1) canvas.set(i, i, BlockTextureFactory.PALETTES.glass[2], 210);
    for (let i = 9; i < 14; i += 1) canvas.set(i, i - 3, BlockTextureFactory.PALETTES.glass[2], 190);
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
