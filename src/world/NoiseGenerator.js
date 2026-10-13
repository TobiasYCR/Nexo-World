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
  #seedHash;

  constructor(seed = 0) {
    this.#seed = seed >>> 0;
    this.#seedHash = Math.imul(this.#seed, 2654435761);
  }

  get seed() {
    return this.#seed;
  }

  /**
   * Deriva una semilla independiente para un subsistema (cuevas, minerales...).
   * Cambiar la semilla base cambia todas las derivadas.
   * @param {number} seed semilla base
   * @param {string} salt nombre estable del subsistema
   */
  static deriveSeed(seed, salt) {
    let hash = (seed >>> 0) ^ 0x811c9dc5;
    for (let index = 0; index < salt.length; index += 1) {
      hash ^= salt.charCodeAt(index);
      hash = Math.imul(hash, 0x01000193);
    }
    hash ^= hash >>> 15;
    hash = Math.imul(hash, 0x2c1b3c6d);
    return (hash ^ (hash >>> 12)) >>> 0;
  }

  /** Hash entero -> [0, 1). Rápido y suficientemente uniforme para terreno. */
  #hash2D(x, y) {
    let h = (Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ this.#seedHash) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    h = h ^ (h >>> 16);
    return (h >>> 0) / 4294967296;
  }

  #hash3D(x, y, z) {
    let h = (Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(z, 1442695041) ^ this.#seedHash) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    h = h ^ (h >>> 16);
    return (h >>> 0) / 4294967296;
  }

  static #smoothstep(t) {
    return t * t * (3 - 2 * t);
  }

  /** Valor pseudoaleatorio estable por celda entera, en [0, 1). */
  random2D(x, y) {
    return this.#hash2D(x, y);
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

  /** Ruido 3D continuo en [0, 1). Base de las cuevas. */
  noise3D(x, y, z) {
    const x0 = Math.floor(x);
    const y0 = Math.floor(y);
    const z0 = Math.floor(z);
    const tx = NoiseGenerator.#smoothstep(x - x0);
    const ty = NoiseGenerator.#smoothstep(y - y0);
    const tz = NoiseGenerator.#smoothstep(z - z0);

    const c000 = this.#hash3D(x0, y0, z0);
    const c100 = this.#hash3D(x0 + 1, y0, z0);
    const c010 = this.#hash3D(x0, y0 + 1, z0);
    const c110 = this.#hash3D(x0 + 1, y0 + 1, z0);
    const c001 = this.#hash3D(x0, y0, z0 + 1);
    const c101 = this.#hash3D(x0 + 1, y0, z0 + 1);
    const c011 = this.#hash3D(x0, y0 + 1, z0 + 1);
    const c111 = this.#hash3D(x0 + 1, y0 + 1, z0 + 1);

    const x00 = c000 + (c100 - c000) * tx;
    const x10 = c010 + (c110 - c010) * tx;
    const x01 = c001 + (c101 - c001) * tx;
    const x11 = c011 + (c111 - c011) * tx;
    const y0Plane = x00 + (x10 - x00) * ty;
    const y1Plane = x01 + (x11 - x01) * ty;
    return y0Plane + (y1Plane - y0Plane) * tz;
  }

  /**
   * Muestrea noise3D(fx, y * fy, fz) para toda una columna vertical y escribe
   * el resultado en out[y]. Equivale a llamar noise3D por celda (misma
   * aritmética, mismo resultado bit a bit), pero los hashes de los vértices se
   * recalculan solo al cruzar una celda de la grilla del ruido en Y.
   * @param {number} fx coordenada X ya escalada por la frecuencia
   * @param {number} fz coordenada Z ya escalada por la frecuencia
   * @param {number} fy frecuencia en Y
   * @param {number} yFrom primera altura (incluida)
   * @param {number} yTo última altura (incluida)
   * @param {Float64Array} out destino indexado por y
   */
  noise3DColumn(fx, fz, fy, yFrom, yTo, out) {
    const x0 = Math.floor(fx);
    const z0 = Math.floor(fz);
    const tx = NoiseGenerator.#smoothstep(fx - x0);
    const tz = NoiseGenerator.#smoothstep(fz - z0);
    let cachedY0 = NaN;
    let x00 = 0;
    let x10 = 0;
    let x01 = 0;
    let x11 = 0;

    for (let y = yFrom; y <= yTo; y += 1) {
      const fyValue = y * fy;
      const y0 = Math.floor(fyValue);
      if (y0 !== cachedY0) {
        cachedY0 = y0;
        const c000 = this.#hash3D(x0, y0, z0);
        const c100 = this.#hash3D(x0 + 1, y0, z0);
        const c010 = this.#hash3D(x0, y0 + 1, z0);
        const c110 = this.#hash3D(x0 + 1, y0 + 1, z0);
        const c001 = this.#hash3D(x0, y0, z0 + 1);
        const c101 = this.#hash3D(x0 + 1, y0, z0 + 1);
        const c011 = this.#hash3D(x0, y0 + 1, z0 + 1);
        const c111 = this.#hash3D(x0 + 1, y0 + 1, z0 + 1);
        x00 = c000 + (c100 - c000) * tx;
        x10 = c010 + (c110 - c010) * tx;
        x01 = c001 + (c101 - c001) * tx;
        x11 = c011 + (c111 - c011) * tx;
      }
      const ty = NoiseGenerator.#smoothstep(fyValue - y0);
      const y0Plane = x00 + (x10 - x00) * ty;
      const y1Plane = x01 + (x11 - x01) * ty;
      out[y] = y0Plane + (y1Plane - y0Plane) * tz;
    }
    return out;
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
