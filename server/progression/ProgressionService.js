import { GameConfig } from '../../src/game/GameConfig.js';
import { ScoreRules } from '../../src/progression/ScoreRules.js';
import { ProgressState } from '../../src/progression/ProgressState.js';
import { ProgressValidator } from '../../src/progression/ProgressValidator.js';
import { ProgressionResult } from '../../src/progression/ProgressionResult.js';
import { PlayerTokens } from '../security/PlayerTokens.js';

const { Reasons } = ProgressionResult;

/**
 * Casos de uso del servidor de progresión. Es la autoridad sobre los puntos:
 * recalcula la puntuación con las mismas reglas que el juego a partir de los
 * hechos informados, después de validarlos contra el mundo regenerado.
 *
 * Controles contra resultados inválidos:
 *   - Identidad: escribir exige el token del jugador.
 *   - Coherencia con el mundo: celdas, biomas y minerales tienen que existir ahí.
 *   - Puntos recalculados: se ignora cualquier puntuación que mande el cliente.
 *   - Revisión creciente y estado que incluye al guardado: un envío viejo no pisa uno nuevo.
 *   - Ritmo máximo: no se aceptan más puntos que los alcanzables en el tiempo transcurrido.
 *
 * Todos los métodos devuelven ProgressionResult; los errores de almacenamiento
 * se traducen a 'storage-error' sin exponer detalles al cliente.
 */
export class ProgressionService {
  /**
   * @param {import('../persistence/ProgressionRepository.js').ProgressionRepository} repository
   * @param {import('./WorldVerifier.js').WorldVerifier} worldVerifier
   * @param {{config?: object, clock?: () => number, logger?: {error: Function}}} [options]
   */
  constructor(repository, worldVerifier, { config = GameConfig.progression, clock = Date.now, logger = console } = {}) {
    this.repository = repository;
    this.worldVerifier = worldVerifier;
    this.config = config;
    this.rules = new ScoreRules(config);
    this.validator = new ProgressValidator(this.rules);
    this.clock = clock;
    this.logger = logger;
  }

  async registerPlayer(rawName) {
    const name = this.#normalizeName(rawName);
    if (!name) return ProgressionResult.fail(Reasons.INVALID_NAME);
    const token = PlayerTokens.newToken();
    const player = { id: PlayerTokens.newPlayerId(), name, tokenHash: PlayerTokens.hash(token), accountId: null, createdAt: this.clock() };
    return this.#guard(async () => {
      await this.repository.createPlayer(player);
      return ProgressionResult.ok({ playerId: player.id, token, name });
    });
  }

  /** Jugador dueño del token, o null. */
  async authenticate(token) {
    if (!token) return null;
    try {
      return await this.repository.findPlayerByTokenHash(PlayerTokens.hash(token));
    } catch (error) {
      this.logger.error('[progression] error al autenticar', error);
      return null;
    }
  }

  async getProgress(player, mode, worldKey) {
    if (!this.rules.isValidMode(mode)) return ProgressionResult.fail(Reasons.INVALID_MODE);
    return this.#guard(async () => {
      const progress = await this.repository.getProgress(player.id, mode, worldKey);
      // No tener progreso en un mundo nuevo es normal, no un error: se responde 200 con null.
      if (!progress) return ProgressionResult.ok({ progress: null });
      const standing = await this.repository.standingOf(mode, player.id);
      return ProgressionResult.ok({ progress: this.#publicProgress(progress, standing) });
    });
  }

  /**
   * @param {object} player autenticado
   * @param {{mode:string, world:string, revision:number, state:object}} body
   */
  async submitProgress(player, body) {
    const { mode, world: worldKey, revision } = body ?? {};
    if (!this.rules.isValidMode(mode)) return ProgressionResult.fail(Reasons.INVALID_MODE);
    if (!Number.isSafeInteger(revision) || revision < 1) return ProgressionResult.fail(Reasons.INVALID_REQUEST, { detail: 'revisión inválida' });

    const terrain = this.worldVerifier.terrainFor(worldKey);
    if (!terrain) return ProgressionResult.fail(Reasons.UNSUPPORTED_WORLD);

    const state = ProgressState.parse(body.state);
    if (!state) return ProgressionResult.fail(Reasons.INVALID_PROGRESS, { detail: 'estructura de progreso inválida' });
    const validation = this.validator.validate(state, terrain);
    if (!validation.ok) return ProgressionResult.fail(Reasons.INVALID_PROGRESS, { detail: validation.detail });

    return this.#guard(async () => {
      const current = await this.repository.getProgress(player.id, mode, worldKey);
      const stale = () => ProgressionResult.fail(Reasons.STALE_REVISION, { current: current ? this.#publicProgress(current, null) : null });
      if (current) {
        if (revision <= current.revision) return stale();
        // Un estado que no contiene lo ya guardado viene de una sesión desactualizada.
        const stored = ProgressState.parse(current.state);
        if (stored && !state.includes(stored)) return stale();
      }

      const now = this.clock();
      const stats = state.stats();
      const score = this.rules.scoreOf(stats);
      const previousScore = current?.score ?? 0;
      const since = current?.updatedAt ?? player.createdAt;
      if (score - previousScore > this.#allowedGain(now - since)) {
        return ProgressionResult.fail(Reasons.RATE_LIMITED, { retryAfterSeconds: this.#secondsUntilAllowed(score - previousScore, now - since) });
      }

      const saved = await this.repository.saveProgress(
        { playerId: player.id, mode, worldKey, revision, score, stats, state: state.toJSON(), updatedAt: now },
        current?.revision ?? 0
      );
      if (!saved.ok) {
        const latest = await this.repository.getProgress(player.id, mode, worldKey);
        return ProgressionResult.fail(Reasons.STALE_REVISION, { current: latest ? this.#publicProgress(latest, null) : null });
      }

      const standing = await this.repository.standingOf(mode, player.id);
      return ProgressionResult.ok({ score, stats, revision, rank: standing?.position ?? null, bestScore: standing?.score ?? score });
    });
  }

  async leaderboard(mode, rawLimit) {
    if (!this.rules.isValidMode(mode)) return ProgressionResult.fail(Reasons.INVALID_MODE);
    const limit = rawLimit === undefined || rawLimit === null || rawLimit === ''
      ? this.config.LEADERBOARD_DEFAULT_LIMIT
      : Number(rawLimit);
    if (!Number.isInteger(limit) || limit < 1) return ProgressionResult.fail(Reasons.INVALID_REQUEST, { detail: 'límite inválido' });
    return this.#guard(async () => {
      const entries = await this.repository.topScores(mode, Math.min(limit, this.config.LEADERBOARD_MAX_LIMIT));
      return ProgressionResult.ok({ mode, entries: entries.map(ProgressionService.#publicEntry) });
    });
  }

  async standing(mode, playerId) {
    if (!this.rules.isValidMode(mode)) return ProgressionResult.fail(Reasons.INVALID_MODE);
    return this.#guard(async () => {
      const player = await this.repository.findPlayerById(playerId);
      if (!player) return ProgressionResult.fail(Reasons.PLAYER_NOT_FOUND);
      const standing = await this.repository.standingOf(mode, playerId);
      // Un jugador sin puntuaciones existe pero no figura en la tabla.
      return ProgressionResult.ok({
        mode,
        playerId,
        name: player.name,
        position: standing?.position ?? null,
        score: standing?.score ?? 0,
        achievedAt: standing?.achievedAt ?? null
      });
    });
  }

  #allowedGain(elapsedMs) {
    return this.config.RATE_BURST_POINTS + (this.config.MAX_POINTS_PER_MINUTE * Math.max(0, elapsedMs)) / 60000;
  }

  #secondsUntilAllowed(gain, elapsedMs) {
    const neededMs = ((gain - this.config.RATE_BURST_POINTS) / this.config.MAX_POINTS_PER_MINUTE) * 60000;
    return Math.max(1, Math.ceil((neededMs - elapsedMs) / 1000));
  }

  #normalizeName(rawName) {
    if (typeof rawName !== 'string') return null;
    const name = rawName.trim().replace(/\s+/g, ' ');
    const { PLAYER_NAME_MIN_LENGTH: min, PLAYER_NAME_MAX_LENGTH: max } = this.config;
    if (name.length < min || name.length > max) return null;
    return /^[\p{L}\p{N} _.-]+$/u.test(name) ? name : null;
  }

  #publicProgress(progress, standing) {
    return {
      mode: progress.mode,
      worldKey: progress.worldKey,
      revision: progress.revision,
      score: progress.score,
      stats: progress.stats,
      state: progress.state,
      updatedAt: progress.updatedAt,
      rank: standing?.position ?? null
    };
  }

  static #publicEntry({ position, playerId, name, score, achievedAt }) {
    return { position, playerId, name, score, achievedAt };
  }

  /** Traduce fallas del almacenamiento en un resultado, sin filtrar detalles internos. */
  async #guard(operation) {
    try {
      return await operation();
    } catch (error) {
      this.logger.error('[progression] error de almacenamiento', error);
      return ProgressionResult.fail(Reasons.STORAGE_ERROR);
    }
  }
}
