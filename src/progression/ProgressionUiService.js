import { GameConfig } from '../game/GameConfig.js';
import { ProgressionApiClient } from './ProgressionApiClient.js';
import { ProgressionResult } from './ProgressionResult.js';

/**
 * Lo que la interfaz necesita de la progresión, sin conocer el juego ni el
 * servidor: la tabla de cualquier modo, la posición del jugador actual y los
 * números del perfil. Los puntos los calcula el servidor; acá solo se leen.
 */
export class ProgressionUiService {
  #progression;
  #api;
  #config;

  /**
   * @param {import('./PlayerProgression.js').PlayerProgression} progression
   * @param {{apiClient?: ProgressionApiClient, config?: object}} [options]
   */
  constructor(progression, { config = GameConfig.progression, apiClient = new ProgressionApiClient(config) } = {}) {
    this.#progression = progression;
    this.#api = apiClient;
    this.#config = config;
  }

  get modes() {
    return this.#config.MODES;
  }

  /** Modo de la partida actual. */
  get currentMode() {
    return this.#progression.mode;
  }

  /** Jugador con el que se guarda el progreso (invitado o cuenta), o null si todavía no conectó. */
  get currentPlayerId() {
    return this.#progression.playerId;
  }

  /**
   * Primeras posiciones de un modo.
   * @returns {Promise<object>} ProgressionResult con { mode, entries: [{position, playerId, name, score, achievedAt}] }
   */
  async top(mode, limit = this.#config.LEADERBOARD_DEFAULT_LIMIT) {
    if (!this.#config.MODES.includes(mode)) return ProgressionResult.fail(ProgressionResult.Reasons.INVALID_MODE);
    const bounded = Math.min(this.#config.LEADERBOARD_MAX_LIMIT, Math.max(1, Math.floor(limit) || 1));
    const result = await this.#api.getLeaderboard(mode, bounded);
    if (!result.ok) return result;
    return ProgressionResult.ok({ mode, entries: result.data.entries });
  }

  /**
   * Posición y mejor marca del jugador actual en un modo.
   * @returns {Promise<object>} ProgressionResult con { position, score } (position null si no figura)
   */
  async standing(mode) {
    const playerId = this.currentPlayerId;
    if (!playerId) return ProgressionResult.fail(ProgressionResult.Reasons.OFFLINE);
    const result = await this.#api.getStanding(mode, playerId);
    if (!result.ok) return result;
    return ProgressionResult.ok({ position: result.data.position, score: result.data.score });
  }

  // ------------------------------------------------ contrato de ProfileScreen

  /** Puntuación oficial del mundo actual si el servidor ya la confirmó; si no, la local. */
  getPersonalScore() {
    const snapshot = this.#progression.snapshot();
    return snapshot.verifiedScore ?? snapshot.score;
  }

  getPlayerLevel() {
    return this.#progression.level;
  }

  /** Posición conocida en la tabla del modo actual, o null si no se conoce. */
  getLeaderboardRank() {
    return this.#progression.rank ?? null;
  }
}
