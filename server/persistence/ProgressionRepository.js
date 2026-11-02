/**
 * Contrato de almacenamiento de la progresión. ProgressionService solo habla
 * con esta interfaz; las implementaciones (MySQL, memoria) son intercambiables.
 * Es también el contrato a acordar con Backend 1 si la persistencia pasa a
 * su sistema de cuentas.
 *
 * Tipos:
 *   Player   { id, name, tokenHash, accountId, createdAt }
 *   Progress { playerId, mode, worldKey, revision, score, stats, state, updatedAt }
 *   Standing { playerId, name, score, achievedAt, worldKey, position }
 *
 * Todos los tiempos son milisegundos epoch.
 * @interface
 */
export class ProgressionRepository {
  /** Crea las estructuras necesarias si no existen. */
  async init() { throw new Error('no implementado'); }

  /** @param {Player} player */
  async createPlayer(player) { throw new Error('no implementado'); }

  /** @returns {Promise<Player|null>} */
  async findPlayerById(playerId) { throw new Error('no implementado'); }

  /** @returns {Promise<Player|null>} */
  async findPlayerByTokenHash(tokenHash) { throw new Error('no implementado'); }

  /** @returns {Promise<Progress|null>} */
  async getProgress(playerId, mode, worldKey) { throw new Error('no implementado'); }

  /**
   * Guarda el progreso solo si la revisión almacenada sigue siendo
   * expectedRevision (0 = no existía). En la misma operación actualiza la mejor
   * marca del jugador en la clasificación del modo si la puntuación la supera.
   * @param {Progress} progress
   * @returns {Promise<{ok:true}|{ok:false, reason:'stale'}>}
   */
  async saveProgress(progress, expectedRevision) { throw new Error('no implementado'); }

  /** @returns {Promise<Standing[]>} primeras `limit` posiciones, ya ordenadas */
  async topScores(mode, limit) { throw new Error('no implementado'); }

  /** @returns {Promise<Standing|null>} null si el jugador no figura en ese modo */
  async standingOf(mode, playerId) { throw new Error('no implementado'); }

  async close() {}
}
