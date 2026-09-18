/** Lienzo RGBA mínimo en memoria, con coordenadas que envuelven en los bordes. */
export class PixelCanvas {
  constructor(width, height) {
    this.width = width;
    this.height = height;
    this.pixels = new Uint8Array(width * height * 4);
  }

  #offset(x, y) {
    const wrappedX = ((x % this.width) + this.width) % this.width;
    const wrappedY = ((y % this.height) + this.height) % this.height;
    return (wrappedY * this.width + wrappedX) * 4;
  }

  /** @param {number[]} rgb [r, g, b] */
  set(x, y, [r, g, b], alpha = 255) {
    const offset = this.#offset(x, y);
    this.pixels[offset] = r;
    this.pixels[offset + 1] = g;
    this.pixels[offset + 2] = b;
    this.pixels[offset + 3] = alpha;
  }

  get(x, y) {
    const offset = this.#offset(x, y);
    return [this.pixels[offset], this.pixels[offset + 1], this.pixels[offset + 2]];
  }

  /** Oscurece o aclara un píxel existente; factor < 1 oscurece. */
  shade(x, y, factor) {
    const color = this.get(x, y).map((channel) => Math.max(0, Math.min(255, Math.round(channel * factor))));
    this.set(x, y, color);
  }

  forEach(visit) {
    for (let y = 0; y < this.height; y += 1) {
      for (let x = 0; x < this.width; x += 1) visit(x, y);
    }
  }
}
