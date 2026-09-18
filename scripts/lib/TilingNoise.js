/**
 * Ruido de valor 2D que se repite con período fijo. Al ser periódico, los
 * bordes de la textura empalman y los bloques vecinos no muestran costuras.
 */
export class TilingNoise {
  /**
   * @param {import('./SeededRandom.js').SeededRandom} random
   * @param {number} cellsX celdas de la grilla en X (período horizontal)
   * @param {number} cellsY celdas de la grilla en Y (período vertical)
   */
  constructor(random, cellsX, cellsY = cellsX) {
    this.cellsX = cellsX;
    this.cellsY = cellsY;
    this.values = Array.from({ length: cellsX * cellsY }, () => random.next());
  }

  #at(cellX, cellY) {
    const x = ((cellX % this.cellsX) + this.cellsX) % this.cellsX;
    const y = ((cellY % this.cellsY) + this.cellsY) % this.cellsY;
    return this.values[y * this.cellsX + x];
  }

  /**
   * @param {number} u coordenada normalizada [0, 1)
   * @param {number} v coordenada normalizada [0, 1)
   * @returns {number} valor en [0, 1]
   */
  sample(u, v) {
    const x = u * this.cellsX;
    const y = v * this.cellsY;
    const cellX = Math.floor(x);
    const cellY = Math.floor(y);
    const fx = TilingNoise.#smooth(x - cellX);
    const fy = TilingNoise.#smooth(y - cellY);

    const top = this.#at(cellX, cellY) * (1 - fx) + this.#at(cellX + 1, cellY) * fx;
    const bottom = this.#at(cellX, cellY + 1) * (1 - fx) + this.#at(cellX + 1, cellY + 1) * fx;
    return top * (1 - fy) + bottom * fy;
  }

  static #smooth(t) {
    return t * t * (3 - 2 * t);
  }
}
