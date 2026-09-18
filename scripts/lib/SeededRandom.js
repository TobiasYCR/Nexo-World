/**
 * PRNG determinista (mulberry32). Misma semilla, misma secuencia: regenerar los
 * assets da archivos idénticos byte a byte y no ensucia el diff.
 */
export class SeededRandom {
  #state;

  constructor(seed) {
    this.#state = seed >>> 0;
  }

  /** Semilla estable a partir de un texto (FNV-1a), para derivar una por asset. */
  static fromString(text) {
    let hash = 0x811c9dc5;
    for (let index = 0; index < text.length; index += 1) {
      hash ^= text.charCodeAt(index);
      hash = Math.imul(hash, 0x01000193);
    }
    return new SeededRandom(hash);
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

  /** Flotante en [-1, 1). */
  signed() {
    return this.next() * 2 - 1;
  }
}
