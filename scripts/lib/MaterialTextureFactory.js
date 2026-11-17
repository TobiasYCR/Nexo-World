import { PixelCanvas } from './PixelCanvas.js';
import { SeededRandom } from './SeededRandom.js';
import { TilingNoise } from './TilingNoise.js';

const SIZE = 16;

/**
 * Texturas de las piedras y maderas del catálogo educativo. Cada una tiene un
 * rasgo propio que la distingue a simple vista, además de su color:
 *
 * - Granito: base rosada con motas negras y blancas.
 * - Diorita: base blanca con motas negras.
 * - Andesita: gris liso de grano fino con manchones.
 * - Basalto: gris oscuro en columnas verticales.
 * - Obsidiana: negro violáceo con reflejos de vidrio en diagonal.
 * - Caliza: crema con conchas fósiles.
 * - Mármol: blanco con vetas grises.
 * - Pizarra: gris azulado en láminas horizontales.
 * - Toba: gris verdoso con poros.
 * - Piedra musgosa: piedra partida con manchas de musgo.
 * - Roca madre: bloques irregulares muy oscuros con aristas claras.
 *
 * Las maderas son tablones de cada especie: misma estructura de tablas, con la
 * paleta de su madera y un rasgo propio (nudos del pino, vetas del olivo,
 * manchas del abedul, nudos del bambú, moho de la madera podrida…).
 */
export class MaterialTextureFactory {
  /** @returns {Map<string, PixelCanvas>} nombre de archivo -> lienzo */
  static createAll() {
    return new Map([
      ['granite.png', MaterialTextureFactory.speckled('granite', [[164, 108, 96], [180, 122, 108], [196, 138, 122], [210, 154, 138]], [[52, 40, 40], [232, 224, 220]], 22)],
      ['diorite.png', MaterialTextureFactory.speckled('diorite', [[198, 198, 202], [210, 210, 214], [222, 222, 226], [236, 236, 240]], [[40, 40, 44], [92, 92, 98]], 20)],
      ['andesite.png', MaterialTextureFactory.andesite()],
      ['basalt.png', MaterialTextureFactory.basalt()],
      ['obsidian.png', MaterialTextureFactory.obsidian()],
      ['limestone.png', MaterialTextureFactory.limestone()],
      ['marble.png', MaterialTextureFactory.marble()],
      ['slate.png', MaterialTextureFactory.slate()],
      ['tuff.png', MaterialTextureFactory.tuff()],
      ['mossy_cobblestone.png', MaterialTextureFactory.mossyCobblestone()],
      ['bedrock.png', MaterialTextureFactory.bedrock()],
      ['wood_oak.png', MaterialTextureFactory.planks('oak', [[104, 70, 36], [120, 82, 42], [136, 94, 50], [152, 108, 60]], { knots: 2, seam: [70, 46, 22] })],
      ['wood_birch.png', MaterialTextureFactory.planks('birch', [[206, 190, 146], [216, 202, 160], [226, 214, 174], [236, 226, 190]], { birchSpots: true })],
      ['wood_pine.png', MaterialTextureFactory.planks('pine', [[194, 156, 96], [208, 172, 110], [220, 186, 126], [232, 200, 142]], { knots: 3, seam: [150, 112, 60] })],
      ['wood_fir.png', MaterialTextureFactory.planks('fir', [[128, 78, 52], [144, 92, 62], [158, 104, 72], [172, 118, 84]], { narrow: true })],
      ['wood_ebony.png', MaterialTextureFactory.planks('ebony', [[32, 26, 26], [44, 36, 34], [56, 46, 42], [70, 58, 52]], { seam: [18, 14, 14] })],
      ['wood_mahogany.png', MaterialTextureFactory.planks('mahogany', [[104, 42, 32], [120, 52, 40], [136, 62, 48], [152, 74, 58]], { seam: [70, 28, 22] })],
      ['wood_acacia.png', MaterialTextureFactory.planks('acacia', [[176, 88, 40], [194, 102, 50], [210, 116, 60], [224, 132, 72]])],
      ['wood_cherry.png', MaterialTextureFactory.planks('cherry', [[196, 128, 140], [210, 144, 156], [222, 160, 170], [234, 178, 186]], { seam: [150, 92, 104] })],
      ['wood_willow.png', MaterialTextureFactory.planks('willow', [[142, 150, 98], [156, 164, 110], [170, 178, 124], [184, 190, 138]])],
      ['wood_mangrove.png', MaterialTextureFactory.planks('mangrove', [[124, 46, 42], [140, 56, 50], [156, 66, 58], [170, 80, 70]], { narrow: true })],
      ['wood_bamboo.png', MaterialTextureFactory.bamboo()],
      ['wood_palm.png', MaterialTextureFactory.palm()],
      ['wood_olive.png', MaterialTextureFactory.planks('olive', [[150, 132, 86], [164, 146, 98], [178, 160, 112], [192, 174, 128]], { waves: true })],
      ['wood_rotten.png', MaterialTextureFactory.planks('rotten', [[72, 64, 52], [84, 74, 60], [96, 86, 70], [110, 98, 80]], { rot: true })]
    ]);
  }

  /** Base con ruido y motas sueltas de uno o dos colores. */
  static speckled(name, palette, specks, count) {
    const random = SeededRandom.fromString(name);
    const canvas = MaterialTextureFactory.#noise(random, palette, 4, 0.4);
    for (let index = 0; index < count; index += 1) {
      const color = specks[index % specks.length];
      const x = random.int(SIZE);
      const y = random.int(SIZE);
      canvas.set(x, y, color);
      if (random.next() < 0.4) canvas.set(x + 1, y, color);
    }
    return canvas;
  }

  static andesite() {
    const random = SeededRandom.fromString('andesite');
    const canvas = MaterialTextureFactory.#noise(random, [[120, 124, 124], [132, 136, 136], [144, 148, 148], [156, 160, 160]], 3, 0.15);
    // Manchones grandes un poco más oscuros: grano fino, sin grietas.
    for (let blotch = 0; blotch < 4; blotch += 1) {
      const cx = random.int(SIZE);
      const cy = random.int(SIZE);
      for (let dy = -1; dy <= 1; dy += 1) {
        for (let dx = -2; dx <= 2; dx += 1) {
          if (random.next() < 0.7) canvas.shade(cx + dx, cy + dy, 0.9);
        }
      }
    }
    return canvas;
  }

  static basalt() {
    const random = SeededRandom.fromString('basalt');
    const canvas = MaterialTextureFactory.#noise(random, [[56, 58, 64], [66, 68, 76], [76, 78, 86], [88, 90, 98]], 3, 0.3);
    // Columnas verticales: juntas oscuras con un borde claro.
    for (const x of [0, 5, 11]) {
      for (let y = 0; y < SIZE; y += 1) {
        canvas.set(x, y, [36, 38, 42]);
        canvas.set(x + 1, y, [100, 102, 110]);
      }
    }
    for (let crack = 0; crack < 5; crack += 1) {
      const x = random.int(SIZE);
      const y = random.int(SIZE);
      canvas.set(x, y, [40, 42, 46]);
      canvas.set(x + 1, y, [40, 42, 46]);
    }
    return canvas;
  }

  static obsidian() {
    const random = SeededRandom.fromString('obsidian');
    const canvas = MaterialTextureFactory.#noise(random, [[16, 10, 26], [26, 18, 40], [38, 26, 58], [52, 36, 78]], 4, 0.35);
    // Reflejos de vidrio en diagonal, violeta claro.
    for (const start of [2, 9]) {
      for (let step = 0; step < 5; step += 1) canvas.set(start + step, 3 + step, [124, 92, 176]);
    }
    for (let glint = 0; glint < 6; glint += 1) {
      canvas.set(random.int(SIZE), random.int(SIZE), [168, 140, 220]);
    }
    return canvas;
  }

  static limestone() {
    const random = SeededRandom.fromString('limestone');
    const canvas = MaterialTextureFactory.#noise(random, [[204, 192, 162], [214, 202, 174], [224, 212, 186], [234, 224, 200]], 3, 0.3);
    // Conchas fósiles: pequeños arcos.
    for (let shell = 0; shell < 4; shell += 1) {
      const x = 1 + random.int(SIZE - 3);
      const y = 1 + random.int(SIZE - 3);
      const shade = [168, 154, 120];
      canvas.set(x, y, shade);
      canvas.set(x + 1, y - 1, shade);
      canvas.set(x + 2, y, shade);
      canvas.set(x + 1, y + 1, shade);
    }
    return canvas;
  }

  static marble() {
    const random = SeededRandom.fromString('marble');
    const canvas = MaterialTextureFactory.#noise(random, [[226, 228, 232], [234, 236, 240], [242, 244, 247], [250, 251, 252]], 2, 0.15);
    // Vetas grises: caminatas en diagonal.
    for (let vein = 0; vein < 3; vein += 1) {
      let x = random.int(SIZE);
      let y = 0;
      while (y < SIZE) {
        canvas.set(x, y, vein === 0 ? [150, 152, 160] : [184, 186, 194]);
        x = (x + (random.next() < 0.6 ? 1 : 0) + SIZE) % SIZE;
        y += 1;
      }
    }
    return canvas;
  }

  static slate() {
    const random = SeededRandom.fromString('slate');
    const canvas = MaterialTextureFactory.#noise(random, [[52, 58, 68], [60, 66, 76], [68, 74, 86], [78, 86, 98]], 4, 0.25);
    // Láminas: cada 3 filas una junta oscura con brillo arriba.
    for (let y = 2; y < SIZE; y += 3) {
      const shift = random.int(SIZE);
      for (let x = 0; x < SIZE; x += 1) {
        if ((x + shift) % 9 === 0) continue;
        canvas.set(x, y, [34, 38, 46]);
        canvas.set(x, y - 1, [92, 100, 114]);
      }
    }
    return canvas;
  }

  static tuff() {
    const random = SeededRandom.fromString('tuff');
    const canvas = MaterialTextureFactory.#noise(random, [[112, 122, 106], [124, 134, 118], [136, 146, 130], [150, 158, 142]], 4, 0.45);
    // Poros: huecos oscuros con sombra.
    for (let pore = 0; pore < 12; pore += 1) {
      const x = random.int(SIZE);
      const y = random.int(SIZE);
      canvas.set(x, y, [72, 78, 68]);
      canvas.shade(x + 1, y + 1, 0.85);
    }
    return canvas;
  }

  static mossyCobblestone() {
    const random = SeededRandom.fromString('mossy_cobblestone');
    const canvas = MaterialTextureFactory.#noise(random, [[104, 104, 110], [118, 118, 124], [132, 132, 138], [148, 148, 153]], 4, 0.32);
    for (let y = 0; y < SIZE; y += 4) {
      for (let x = 0; x < SIZE; x += 1) canvas.set(x, y, [82, 82, 88]);
    }
    for (let x = 0; x < SIZE; x += 5) {
      const offset = random.int(4);
      for (let y = offset; y < SIZE; y += 1) canvas.set(x, y, [92, 92, 98]);
    }
    // Musgo: manchas verdes que se extienden desde arriba.
    const moss = [[62, 112, 48], [78, 132, 58], [96, 150, 68]];
    for (let patch = 0; patch < 14; patch += 1) {
      let x = random.int(SIZE);
      let y = random.int(SIZE / 2);
      for (let step = 0; step < 10; step += 1) {
        canvas.set(x, y, moss[random.int(moss.length)]);
        x = (x + random.int(3) - 1 + SIZE) % SIZE;
        y = Math.min(SIZE - 1, y + random.int(2));
      }
    }
    return canvas;
  }

  /** Roca madre: bloques irregulares casi negros con aristas claras (no violeta como la obsidiana). */
  static bedrock() {
    const random = SeededRandom.fromString('bedrock_v2');
    const canvas = MaterialTextureFactory.#noise(random, [[34, 32, 30], [46, 44, 42], [60, 58, 54], [74, 72, 68]], 3, 0.25);
    for (let chunk = 0; chunk < 7; chunk += 1) {
      const x = random.int(SIZE);
      const y = random.int(SIZE);
      const width = 3 + random.int(3);
      for (let dx = 0; dx < width; dx += 1) {
        canvas.set(x + dx, y, [118, 114, 106]);
        canvas.set(x + dx, y + 1, [22, 20, 18]);
      }
      canvas.set(x, y + 2, [22, 20, 18]);
    }
    return canvas;
  }

  /**
   * Tablones de una especie.
   * @param {string} name semilla del diseño
   * @param {number[][]} palette cuatro tonos, de oscuro a claro
   * @param {Object} [options]
   * @param {number[]} [options.seam] color de las juntas
   * @param {boolean} [options.narrow] tablas de 2 píxeles en vez de 4
   * @param {number} [options.knots] cantidad de nudos
   * @param {boolean} [options.birchSpots] manchas negras horizontales
   * @param {boolean} [options.waves] vetas onduladas
   * @param {boolean} [options.rot] manchas de moho verdinegro
   */
  static planks(name, palette, { seam = null, narrow = false, knots = 0, birchSpots = false, waves = false, rot = false } = {}) {
    const random = SeededRandom.fromString(`wood_${name}`);
    const plankHeight = narrow ? 2 : 4;
    const seamColor = seam ?? palette[0].map((channel) => Math.round(channel * 0.7));
    const grain = new TilingNoise(random, 2, 16);
    const canvas = new PixelCanvas(SIZE, SIZE);

    for (let plank = 0; plank < SIZE / plankHeight; plank += 1) {
      const tone = random.int(2);
      const seamX = random.int(SIZE);
      for (let row = 0; row < plankHeight; row += 1) {
        const y = plank * plankHeight + row;
        for (let x = 0; x < SIZE; x += 1) {
          const wave = waves ? Math.sin((x + y * 2) / 2.5) * 0.35 : 0;
          const value = Math.max(0, Math.min(0.999, grain.sample(x / SIZE, y / SIZE) + wave));
          const level = Math.min(palette.length - 1, tone + Math.floor(value * 2.99));
          canvas.set(x, y, palette[level]);
        }
        canvas.set(seamX, y, seamColor);
      }
      for (let x = 0; x < SIZE; x += 1) canvas.set(x, plank * plankHeight + plankHeight - 1, seamColor);
    }

    for (let knot = 0; knot < knots; knot += 1) {
      const x = 1 + random.int(SIZE - 2);
      const y = 1 + random.int(SIZE - 3);
      canvas.set(x, y, seamColor);
      canvas.set(x + 1, y, palette[0]);
      canvas.set(x, y + 1, palette[0]);
    }
    if (birchSpots) {
      for (let spot = 0; spot < 7; spot += 1) {
        const x = random.int(SIZE);
        const y = random.int(SIZE);
        canvas.set(x, y, [40, 36, 32]);
        canvas.set(x + 1, y, [40, 36, 32]);
      }
    }
    if (rot) {
      const mold = [[46, 58, 40], [58, 72, 48], [36, 40, 32]];
      for (let patch = 0; patch < 9; patch += 1) {
        const x = random.int(SIZE);
        const y = random.int(SIZE);
        canvas.set(x, y, mold[patch % mold.length]);
        canvas.set(x, y + 1, mold[(patch + 1) % mold.length]);
      }
    }
    return canvas;
  }

  /** Bambú: cañas verticales con nudos horizontales. */
  static bamboo() {
    const random = SeededRandom.fromString('wood_bamboo');
    const palette = [[166, 160, 70], [184, 176, 84], [200, 190, 98], [214, 204, 116]];
    const canvas = new PixelCanvas(SIZE, SIZE);
    canvas.forEach((x, y) => {
      const cane = x % 4;
      const level = cane === 0 ? 0 : cane === 1 ? 3 : 2 - (random.next() < 0.3 ? 1 : 0);
      canvas.set(x, y, palette[level]);
    });
    for (let column = 0; column < 4; column += 1) {
      const nodeY = (column * 5 + 2) % SIZE;
      for (let dx = 1; dx < 4; dx += 1) {
        canvas.set(column * 4 + dx, nodeY, [128, 120, 52]);
        canvas.set(column * 4 + dx, (nodeY + 8) % SIZE, [128, 120, 52]);
      }
    }
    return canvas;
  }

  /** Palmera: fibras en diagonal, sin juntas de tabla. */
  static palm() {
    const random = SeededRandom.fromString('wood_palm');
    const palette = [[150, 112, 68], [166, 126, 78], [182, 140, 90], [196, 154, 104]];
    const canvas = new PixelCanvas(SIZE, SIZE);
    canvas.forEach((x, y) => {
      const fiber = (x + y) % 4;
      const level = fiber === 0 ? 0 : Math.min(3, 1 + random.int(3));
      canvas.set(x, y, palette[level]);
    });
    return canvas;
  }

  static #noise(random, palette, cells, jitter) {
    const noise = new TilingNoise(random, cells);
    const canvas = new PixelCanvas(SIZE, SIZE);
    canvas.forEach((x, y) => {
      const value = noise.sample(x / SIZE, y / SIZE) * (1 - jitter) + random.next() * jitter;
      const level = Math.min(palette.length - 1, Math.floor(value * palette.length));
      canvas.set(x, y, palette[level]);
    });
    return canvas;
  }
}
