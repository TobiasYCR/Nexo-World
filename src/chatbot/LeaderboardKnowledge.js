import { ChatResponse } from './ChatResponse.js';
import { GameConfig } from '../game/GameConfig.js';

/**
 * Clasificación: cómo se arma la tabla y en qué puesto está el jugador.
 *
 * Las reglas de orden viven en src/progression/Leaderboard.js y en
 * docs/PROGRESION.md §1.3; los modos y los topes salen de GameConfig. La
 * posición en vivo sale de game.progression.rank. Si el servidor todavía no
 * contestó, la respuesta lo dice en vez de suponer un puesto.
 */
export class LeaderboardKnowledge {
  #config;
  #contextProvider = null;

  /**
   * @param {Object} [options]
   * @param {Object} [options.config] GameConfig completo
   * @param {(() => Object|null)|null} [options.contextProvider]
   */
  constructor({ config = GameConfig, contextProvider = null } = {}) {
    this.#config = config;
    this.setContextProvider(contextProvider);
  }

  setContextProvider(provider) {
    this.#contextProvider = typeof provider === 'function' ? provider : null;
  }

  get #context() {
    if (!this.#contextProvider) return null;
    try {
      return this.#contextProvider();
    } catch {
      return null;
    }
  }

  /**
   * @param {string} intentId
   * @param {string} [normalizedQuestion]
   * @returns {Object|null}
   */
  answer(intentId, normalizedQuestion = '') {
    if (intentId === 'game.leaderboard.how') return this.#how();
    if (intentId === 'game.leaderboard.tie') return this.#tie();
    if (intentId === 'game.status.rank') return this.#statusRank();
    return null;
  }

  #how() {
    return ChatResponse.known(
      'La tabla ordena por puntos, de mayor a menor. Cada jugador aparece una sola vez, con su ' +
        'mejor mundo. Hay una tabla para cada modo (supervivencia y creativo), así el creativo no ' +
        `da ventaja. La tabla muestra las primeras ${this.#limit()} posiciones y tu puesto sale de ` +
        'tu mejor marca.',
      ChatResponse.Topics.LEADERBOARD,
      'docs/PROGRESION.md §1.3 + GameConfig.progression'
    );
  }

  #tie() {
    return ChatResponse.known(
      'Si dos jugadores tienen los mismos puntos, queda primero el que llegó a esa marca antes. ' +
        'Si también llegaron al mismo tiempo, decide el identificador del jugador. Por eso cada ' +
        'persona tiene un puesto único: no hay dos jugadores compartiendo el mismo lugar.',
      ChatResponse.Topics.LEADERBOARD,
      'src/progression/Leaderboard.js + docs/PROGRESION.md §1.3'
    );
  }

  #statusRank() {
    const snapshot = this.#snapshot();
    if (!snapshot) {
      return ChatResponse.unknown(
        'Eso solo lo puedo responder con una partida en curso. Entrá al mundo y volvé a preguntarme.',
        ChatResponse.Topics.STATUS
      );
    }

    if (!Number.isFinite(snapshot.rank)) {
      const motivo = snapshot.status === 'offline'
        ? 'El servidor no responde, así que todavía no sé tu puesto.'
        : 'Todavía no me llegó tu puesto desde el servidor.';
      return ChatResponse.unknown(
        `${motivo} Cuando se sincronice la partida, volvé a preguntarme.`,
        ChatResponse.Topics.STATUS
      );
    }

    const modo = this.#modeLabel(snapshot.mode);
    return ChatResponse.known(
      `Estás en el puesto ${snapshot.rank} de la tabla de ${modo}.`,
      ChatResponse.Topics.STATUS,
      'game.progression.rank'
    );
  }

  #snapshot() {
    const progression = this.#context?.progression;
    if (!progression) return null;
    try {
      return progression.snapshot?.() ?? progression;
    } catch {
      return null;
    }
  }

  #modeLabel(mode) {
    if (mode === 'survival') return 'supervivencia';
    if (mode === 'creative') return 'creativo';
    return 'tu modo';
  }

  #limit() {
    return this.#config.progression?.LEADERBOARD_DEFAULT_LIMIT ?? 10;
  }
}
