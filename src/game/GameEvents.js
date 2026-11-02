export const GameEventTypes = Object.freeze({
  BLOCK_BROKEN: 'blockBroken',
  BLOCK_PLACED: 'blockPlaced',
  BREAK_PROGRESS: 'breakProgress',
  PLAYER_LANDED: 'playerLanded',
  PLAYER_DAMAGED: 'playerDamaged',
  PLAYER_DIED: 'playerDied',
  PLAYER_RESPAWNED: 'playerRespawned',
  /** Cambió la puntuación local: { score, delta, reason, breakdown }. */
  SCORE_CHANGED: 'scoreChanged',
  /** Subió uno o más niveles: { level, previousLevel }. */
  LEVEL_UP: 'levelUp',
  /** El servidor aceptó el progreso: { score, rank }. */
  PROGRESS_SYNCED: 'progressSynced',
  /** No se pudo sincronizar: { reason, message }. El progreso sigue guardado localmente. */
  PROGRESS_SYNC_FAILED: 'progressSyncFailed'
});

/** Bus chico e intencional para desacoplar reglas, feedback visual y audio. */
export class GameEvents {
  #listeners = new Map();

  on(event, listener) {
    if (!this.#listeners.has(event)) this.#listeners.set(event, new Set());
    this.#listeners.get(event).add(listener);
    return () => this.#listeners.get(event)?.delete(listener);
  }

  emit(event, payload = {}) {
    for (const listener of this.#listeners.get(event) ?? []) listener(payload);
  }
}
