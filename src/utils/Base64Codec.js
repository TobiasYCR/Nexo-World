/**
 * Conversión Uint8Array <-> base64 que funciona igual en navegador y en Node.
 *
 * Se apoya en btoa/atob, globales en ambos entornos (Node >= 16), en vez de
 * Buffer (solo Node) o Uint8Array.toBase64 (todavía sin soporte amplio).
 */
export class Base64Codec {
  /** Tamaño de tramo para String.fromCharCode: evita desbordar la pila con arrays grandes. */
  static #CHUNK_SIZE = 0x8000;
  static #VALID_PATTERN = /^[A-Za-z0-9+/]*={0,2}$/;

  /** @param {Uint8Array} bytes */
  static encode(bytes) {
    let binary = '';
    for (let offset = 0; offset < bytes.length; offset += Base64Codec.#CHUNK_SIZE) {
      binary += String.fromCharCode(...bytes.subarray(offset, offset + Base64Codec.#CHUNK_SIZE));
    }
    return btoa(binary);
  }

  /**
   * @param {string} text
   * @returns {Uint8Array|null} null si el texto no es base64 válido
   */
  static decode(text) {
    if (typeof text !== 'string' || text.length % 4 !== 0 || !Base64Codec.#VALID_PATTERN.test(text)) {
      return null;
    }
    try {
      const binary = atob(text);
      const bytes = new Uint8Array(binary.length);
      for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
      return bytes;
    } catch {
      return null;
    }
  }
}
