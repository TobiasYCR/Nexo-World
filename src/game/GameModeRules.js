import { GameConfig } from './GameConfig.js';

/**
 * Qué cambia según el modo de juego. Game lo consulta al crear o cargar un
 * mundo y lo aplica a los sistemas que corresponden; ninguno de ellos conoce
 * los nombres de los modos.
 */
export class GameModeRules {
  /**
   * @param {string} mode 'survival' o 'creative'
   * @param {object} [modesConfig] GameConfig.modes
   */
  constructor(mode, modesConfig = GameConfig.modes) {
    const rules = modesConfig[mode];
    if (!rules) throw new RangeError(`Modo de juego desconocido: "${mode}".`);
    this.mode = mode;
    this.label = rules.LABEL;
    this.infiniteBlocks = rules.INFINITE_BLOCKS;
    this.canFly = rules.CAN_FLY;
    this.takesDamage = rules.TAKES_DAMAGE;
    this.breakSeconds = rules.BREAK_SECONDS;
    Object.freeze(this);
  }

  static isValid(mode, modesConfig = GameConfig.modes) {
    return typeof mode === 'string' && Object.hasOwn(modesConfig, mode);
  }
}
