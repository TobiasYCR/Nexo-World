/**
 * Compresión por tramos (run-length) para los bloques de un chunk.
 *
 * Los chunks se recorren por capas horizontales, así que el aire de arriba y la
 * piedra de abajo forman tramos largos del mismo id. Cada tramo se guarda como
 * dos bytes: [largo 1..255, id]. Un chunk típico queda en una fracción de su
 * tamaño original.
 */
export class RunLengthCodec {
  static MAX_RUN = 255;

  /** @param {Uint8Array} bytes */
  static encode(bytes) {
    const out = new Uint8Array(bytes.length * 2);
    let length = 0;
    let index = 0;
    while (index < bytes.length) {
      const value = bytes[index];
      let run = 1;
      while (run < RunLengthCodec.MAX_RUN && index + run < bytes.length && bytes[index + run] === value) run += 1;
      out[length] = run;
      out[length + 1] = value;
      length += 2;
      index += run;
    }
    return out.slice(0, length);
  }

  /**
   * @param {Uint8Array} encoded
   * @param {number} expectedLength largo que debe tener el resultado
   * @returns {Uint8Array|null} null si los datos no forman exactamente expectedLength bytes
   */
  static decode(encoded, expectedLength) {
    if (!(encoded instanceof Uint8Array) || encoded.length % 2 !== 0) return null;
    const out = new Uint8Array(expectedLength);
    let length = 0;
    for (let index = 0; index < encoded.length; index += 2) {
      const run = encoded[index];
      if (run === 0 || length + run > expectedLength) return null;
      out.fill(encoded[index + 1], length, length + run);
      length += run;
    }
    return length === expectedLength ? out : null;
  }
}
