import { ProgressionRepository } from './ProgressionRepository.js';
import { Leaderboard } from '../../src/progression/Leaderboard.js';

/**
 * Implementación en memoria del repositorio. Sirve para los tests y para
 * levantar el servidor sin MySQL (STORAGE=memory); se pierde al reiniciar.
 * Usa el mismo criterio de orden (Leaderboard) que replica la consulta SQL.
 */
export class InMemoryProgressionRepository extends ProgressionRepository {
  #players = new Map();
  #progress = new Map();
  #best = new Map();
  /** Permite simular una falla de almacenamiento en los tests. */
  failNextWrite = false;

  async init() {}

  async createPlayer(player) {
    this.#throwIfFailing();
    this.#players.set(player.id, { ...player });
  }

  async findPlayerById(playerId) {
    return this.#copy(this.#players.get(playerId));
  }

  async findPlayerByTokenHash(tokenHash) {
    for (const player of this.#players.values()) if (player.tokenHash === tokenHash) return { ...player };
    return null;
  }

  async getProgress(playerId, mode, worldKey) {
    return this.#copy(this.#progress.get(this.#progressKey(playerId, mode, worldKey)));
  }

  async saveProgress(progress, expectedRevision) {
    this.#throwIfFailing();
    const key = this.#progressKey(progress.playerId, progress.mode, progress.worldKey);
    const storedRevision = this.#progress.get(key)?.revision ?? 0;
    if (storedRevision !== expectedRevision) return { ok: false, reason: 'stale' };
    this.#progress.set(key, structuredClone(progress));

    const bestKey = `${progress.mode}|${progress.playerId}`;
    const current = this.#best.get(bestKey);
    if (Leaderboard.improves(current, progress.score)) {
      this.#best.set(bestKey, {
        mode: progress.mode,
        playerId: progress.playerId,
        score: progress.score,
        achievedAt: progress.updatedAt,
        worldKey: progress.worldKey
      });
    }
    return { ok: true };
  }

  async topScores(mode, limit) {
    return Leaderboard.top(this.#entries(mode), limit);
  }

  async standingOf(mode, playerId) {
    const entries = this.#entries(mode);
    const position = Leaderboard.positionOf(entries, playerId);
    if (position === null) return null;
    return { ...entries.find((entry) => entry.playerId === playerId), position };
  }

  #entries(mode) {
    return [...this.#best.values()]
      .filter((entry) => entry.mode === mode)
      .map(({ playerId, score, achievedAt, worldKey }) => ({
        playerId,
        name: this.#players.get(playerId)?.name ?? '',
        score,
        achievedAt,
        worldKey
      }));
  }

  #progressKey(playerId, mode, worldKey) {
    return `${playerId}|${mode}|${worldKey}`;
  }

  #copy(value) {
    return value ? structuredClone(value) : null;
  }

  #throwIfFailing() {
    if (!this.failNextWrite) return;
    this.failNextWrite = false;
    throw new Error('falla simulada de almacenamiento');
  }
}
