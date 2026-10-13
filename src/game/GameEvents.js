export const GameEventTypes = Object.freeze({
  BLOCK_BROKEN: 'blockBroken',
  BLOCK_PLACED: 'blockPlaced',
  BREAK_PROGRESS: 'breakProgress',
  PLAYER_LANDED: 'playerLanded',
  PLAYER_DAMAGED: 'playerDamaged',
  PLAYER_DIED: 'playerDied',
  PLAYER_RESPAWNED: 'playerRespawned'
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
