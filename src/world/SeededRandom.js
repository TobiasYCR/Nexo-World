/**
 * PRNG determinista (mulberry32) para la generación del mundo. Reemplaza a
 * Math.random(): misma semilla, misma secuencia, mismo mundo.
 *
 * Es independiente de scripts/lib/SeededRandom.js a propósito: el código del
 * juego no depende de las herramientas de build de assets.
 */
export class SeededRandom {
  #state;

  constructor(seed) {
    this.#state = seed >>> 0;
  }

  /** Flotante en [0, 1). */
  next() {
    this.#state = (this.#state + 0x6d2b79f5) >>> 0;
    let t = this.#state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Entero en [0, max). */
  int(max) {
    return Math.floor(this.next() * max);
  }

  /** Entero en [min, max], ambos incluidos. */
  range(min, max) {
    return min + this.int(max - min + 1);
  }
}
