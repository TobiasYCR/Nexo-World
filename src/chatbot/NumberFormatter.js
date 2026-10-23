import { GameConfig } from '../game/GameConfig.js';

/**
 * Formato de números para las respuestas del chat.
 *
 * El juego usa el punto decimal de JavaScript, pero el bot habla en español:
 * "3.5 bloques" se lee mal y "0.6 vetas" peor. Además hace falta recortar la
 * basura de punto flotante que sale de una conversión de unidades (una pulgada
 * en metros da 0.025399999187200026, no 0.0254).
 */
export class NumberFormatter {
  #precision;
  #locale;

  constructor({ config = GameConfig.chatbot, locale = 'es-AR' } = {}) {
    this.#precision = config.NUMBER_PRECISION;
    this.#locale = locale;
  }

  /**
   * @param {number} value
   * @param {number} [precision] dígitos significativos; por defecto los de GameConfig
   * @returns {string}
   */
  format(value, precision = this.#precision) {
    if (typeof value !== 'number' || !Number.isFinite(value)) return String(value);
    if (Number.isInteger(value)) return value.toLocaleString(this.#locale);

    // toPrecision corta los dígitos sobrantes; Number() vuelve a quitar los
    // ceros que agrega al final, así que 0.3 no se muestra como "0,300000".
    const rounded = Number(value.toPrecision(precision));
    return rounded.toLocaleString(this.#locale, { maximumFractionDigits: 20 });
  }
}
