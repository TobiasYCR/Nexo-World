import { deflateSync } from 'node:zlib';

/**
 * Codificador PNG RGBA de 8 bits sin dependencias. Suficiente para texturas
 * chicas; no implementa filtros de fila (usa el filtro 0 en todas).
 */
export class PngEncoder {
  static #SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  static #CRC_TABLE = PngEncoder.#buildCrcTable();

  /** @param {import('./PixelCanvas.js').PixelCanvas} canvas */
  static encode(canvas) {
    const { width, height, pixels } = canvas;

    const header = Buffer.alloc(13);
    header.writeUInt32BE(width, 0);
    header.writeUInt32BE(height, 4);
    header[8] = 8; // bits por canal
    header[9] = 6; // RGBA
    header[10] = 0;
    header[11] = 0;
    header[12] = 0;

    const rowLength = width * 4;
    const raw = Buffer.alloc((rowLength + 1) * height);
    for (let y = 0; y < height; y += 1) {
      raw[y * (rowLength + 1)] = 0;
      Buffer.from(pixels.buffer, pixels.byteOffset + y * rowLength, rowLength).copy(raw, y * (rowLength + 1) + 1);
    }

    return Buffer.concat([
      PngEncoder.#SIGNATURE,
      PngEncoder.#chunk('IHDR', header),
      PngEncoder.#chunk('IDAT', deflateSync(raw, { level: 9 })),
      PngEncoder.#chunk('IEND', Buffer.alloc(0))
    ]);
  }

  static #chunk(type, data) {
    const typeBuffer = Buffer.from(type, 'ascii');
    const length = Buffer.alloc(4);
    length.writeUInt32BE(data.length, 0);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(PngEncoder.#crc32(Buffer.concat([typeBuffer, data])), 0);
    return Buffer.concat([length, typeBuffer, data, crc]);
  }

  static #crc32(buffer) {
    let crc = 0xffffffff;
    for (const byte of buffer) crc = PngEncoder.#CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
    return (crc ^ 0xffffffff) >>> 0;
  }

  static #buildCrcTable() {
    const table = new Uint32Array(256);
    for (let n = 0; n < 256; n += 1) {
      let c = n;
      for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      table[n] = c >>> 0;
    }
    return table;
  }
}
