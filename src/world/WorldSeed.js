/**
 * Convierte lo que escribe el jugador en "Semilla" en el número que usa
 * WorldGenerator. Un número entero se usa tal cual; cualquier otro texto se
 * transforma siempre en el mismo número (FNV-1a), así "casa" genera siempre el
 * mismo mundo. Vacío: semilla al azar.
 */
export class WorldSeed {
  /**
   * @param {string|number|null|undefined} value
   * @param {() => number} [random] fuente de azar (inyectable en pruebas)
   * @returns {number} entero sin signo de 32 bits
   */
  static from(value, random = Math.random) {
    if (typeof value === 'number' && Number.isInteger(value)) return value >>> 0;
    const text = String(value ?? '').trim();
    if (text === '') return Math.floor(random() * 0x100000000) >>> 0;
    if (/^-?\d+$/.test(text)) {
      const number = Number(text);
      if (Number.isSafeInteger(number)) return number >>> 0;
    }
    let hash = 0x811c9dc5;
    for (const character of text) {
      hash ^= character.codePointAt(0);
      hash = Math.imul(hash, 0x01000193);
    }
    return hash >>> 0;
  }
}
