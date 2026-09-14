/**
 * Ruido de valor con interpolación suave y semilla propia.
 * Se implementa acá en vez de usar el ruido de p5 para que la generación del
 * mundo sea determinista, testeable en Node y ajena al ciclo de vida del sketch.
 *
 * El hash usa aritmética de 32 bits con Math.imul para que el producto de
 * coordenadas con la semilla no pierda bits bajos con semillas grandes.
 */
export class NoiseGenerator {
  #seed;

  constructor(seed = 0) {
    this.#seed = seed >>> 0;
  }

  get seed() {
    return this.#seed;
  }

  /** Hash entero -> [0, 1). Rápido y suficientemente uniforme para terreno. */
  #hash2D(x, y) {
    let h = (Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(this.#seed, 2654435761)) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    h = h ^ (h >>> 16);
    return (h >>> 0) / 4294967296;
  }

  static #smoothstep(t) {
    return t * t * (3 - 2 * t);
  }

  /** Ruido 2D continuo en [0, 1). */
  noise2D(x, y) {
    const x0 = Math.floor(x);
    const y0 = Math.floor(y);
    const tx = NoiseGenerator.#smoothstep(x - x0);
    const ty = NoiseGenerator.#smoothstep(y - y0);

    const topLeft = this.#hash2D(x0, y0);
    const topRight = this.#hash2D(x0 + 1, y0);
    const bottomLeft = this.#hash2D(x0, y0 + 1);
    const bottomRight = this.#hash2D(x0 + 1, y0 + 1);

    const top = topLeft + (topRight - topLeft) * tx;
    const bottom = bottomLeft + (bottomRight - bottomLeft) * tx;
    return top + (bottom - top) * ty;
  }

  /** Suma de octavas: da relieve más natural sin costo relevante. */
  fractalNoise2D(x, y, octaves = 3, persistence = 0.5) {
    let amplitude = 1;
    let frequency = 1;
    let total = 0;
    let maxAmplitude = 0;

    for (let octave = 0; octave < octaves; octave += 1) {
      total += this.noise2D(x * frequency, y * frequency) * amplitude;
      maxAmplitude += amplitude;
      amplitude *= persistence;
      frequency *= 2;
    }

    return total / maxAmplitude;
  }
}
