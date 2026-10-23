import { GameConfig } from '../game/GameConfig.js';
import { GameEventTypes } from '../game/GameEvents.js';
import { ScoreRules } from './ScoreRules.js';
import { ProgressState } from './ProgressState.js';
import { ProgressTracker } from './ProgressTracker.js';
import { ProgressValidator } from './ProgressValidator.js';
import { ProgressionApiClient } from './ProgressionApiClient.js';
import { ProgressionLocalStore } from './ProgressionLocalStore.js';
import { ProgressionResult } from './ProgressionResult.js';
import { LevelRules } from './LevelRules.js';
import { LevelProgress } from './LevelProgress.js';

/** Estado de la sincronización con el servidor, para mostrarlo en la interfaz. */
export const SyncStatus = Object.freeze({
  IDLE: 'idle',
  SYNCING: 'syncing',
  SYNCED: 'synced',
  OFFLINE: 'offline',
  REJECTED: 'rejected'
});

/** Rechazos definitivos: reintentar con los mismos datos daría el mismo resultado. */
const FINAL_REJECTIONS = new Set([
  ProgressionResult.Reasons.INVALID_PROGRESS,
  ProgressionResult.Reasons.UNSUPPORTED_WORLD,
  ProgressionResult.Reasons.INVALID_MODE,
  ProgressionResult.Reasons.INVALID_REQUEST
]);

/**
 * Integración de la progresión con el juego y contrato público para la
 * interfaz. Conecta el ProgressTracker (reglas) con la copia local y con el
 * servidor de puntuaciones. Game solo llama a start(), update() y flush().
 *
 * La puntuación local es provisoria: la oficial es verifiedScore, la que
 * recalculó y aceptó el servidor. La interfaz nunca calcula puntos: los lee
 * de acá o de los eventos scoreChanged, progressSynced y progressSyncFailed.
 */
export class PlayerProgression {
  #tracker = null;
  #terrain = null;
  #worldKey = null;
  #identity = null;
  #revision = 0;
  #dirty = false;
  #changeCounter = 0;
  #syncElapsed = 0;
  #inFlight = null;
  #status = SyncStatus.IDLE;
  #verifiedScore = null;
  #rank = null;
  #lastError = null;
  #levelProgress;

  /**
   * @param {object} [options]
   * @param {object} [options.config] GameConfig.progression
   * @param {ProgressionApiClient} [options.apiClient]
   * @param {ProgressionLocalStore} [options.store]
   * @param {import('../game/GameEvents.js').GameEvents|null} [options.events]
   * @param {string} [options.mode] modo de la partida
   * @param {string} [options.playerName] nombre para registrar un jugador invitado nuevo
   * @param {object} [options.levelConfig] GameConfig.levels
   */
  constructor({
    config = GameConfig.progression,
    apiClient = new ProgressionApiClient(config),
    store = new ProgressionLocalStore(),
    events = null,
    mode = config.GAME_MODE,
    playerName = null,
    levelConfig = GameConfig.levels
  } = {}) {
    this.config = config;
    this.rules = new ScoreRules(config);
    this.validator = new ProgressValidator(this.rules);
    this.api = apiClient;
    this.store = store;
    this.events = events;
    if (!this.rules.isValidMode(mode)) throw new RangeError(`Modo de juego desconocido: "${mode}".`);
    this.mode = mode;
    this.playerName = playerName;
    this.levelRules = new LevelRules(levelConfig);
    this.#levelProgress = new LevelProgress(this.levelRules);
    /** Promesa de la conexión inicial con el servidor; útil para tests y para la interfaz. */
    this.ready = Promise.resolve();
  }

  /**
   * Empieza a registrar progreso en un mundo. Recupera al instante la copia
   * local y conecta con el servidor en segundo plano (no bloquea el juego).
   * @param {import('../world/NaturalTerrain.js').NaturalTerrain} terrain
   * @param {string} worldKey ver WorldKey
   */
  start(terrain, worldKey) {
    this.#terrain = terrain;
    this.#worldKey = worldKey;
    this.#tracker?.detach();
    this.#tracker = new ProgressTracker(terrain, this.rules, (change) => this.#onChange(change));
    if (this.events) this.#tracker.attach(this.events);

    const cached = this.store.loadProgress(this.mode, worldKey);
    const cachedState = cached ? this.#acceptState(cached.state) : null;
    if (cachedState) {
      this.#tracker.load(cachedState);
      this.#revision = cached.revision;
      this.#levelProgress.load(this.#tracker.state.stats());
      // Lo guardado localmente puede no haber llegado al servidor.
      this.#dirty = true;
    }
    this.ready = this.#connect();
    return this.ready;
  }

  /** Llamado por Game cada frame mientras el juego corre. */
  update(deltaTime, blockX, blockZ) {
    if (!this.#tracker) return;
    this.#tracker.observePosition(blockX, blockZ);
    this.#syncElapsed += deltaTime;
    if (this.#syncElapsed < this.config.SYNC_INTERVAL_SECONDS) return;
    this.#syncElapsed = 0;
    if (this.#dirty && this.#identity && this.#status !== SyncStatus.REJECTED) this.flush();
  }

  /**
   * Envía el progreso pendiente ya mismo. Nunca lanza.
   * @param {{keepalive?: boolean}} [options] keepalive permite enviarlo al cerrar la pestaña
   * @returns {Promise<object>} ProgressionResult del envío (o del último, si no había nada pendiente)
   */
  flush(options = {}) {
    if (!this.#identity || !this.#dirty) return Promise.resolve(ProgressionResult.ok({ skipped: true }));
    if (this.#inFlight) return this.#inFlight;
    this.#inFlight = this.#submit(options).finally(() => {
      this.#inFlight = null;
    });
    return this.#inFlight;
  }

  // ------------------------------------------------------------ contrato público

  /** Puntuación local, calculada con las reglas sobre el progreso de este mundo. */
  get score() {
    return this.#tracker ? this.#tracker.score : 0;
  }

  /** Última puntuación aceptada por el servidor, o null si todavía no hubo ninguna. */
  get verifiedScore() {
    return this.#verifiedScore;
  }

  /** Posición en la clasificación del modo (desde 1), o null si no se conoce. */
  get rank() {
    return this.#rank;
  }

  /** Puntos por categoría: exploration, biomes, mining, building y total. */
  get breakdown() {
    return this.rules.breakdown(this.stats);
  }

  get stats() {
    return this.#tracker ? this.#tracker.state.stats() : new ProgressState().stats();
  }

  get status() {
    return this.#status;
  }

  get level() {
    return this.#levelProgress.level;
  }

  get experience() {
    return this.#levelProgress.experience;
  }

  get experienceForNextLevel() {
    return this.#levelProgress.experienceForNextLevel;
  }

  get levelProgress() {
    return this.#levelProgress.levelProgress;
  }

  get isMaxLevel() {
    return this.#levelProgress.isMaxLevel;
  }

  get lastError() {
    return this.#lastError;
  }

  get worldKey() {
    return this.#worldKey;
  }

  get playerId() {
    return this.#identity?.playerId ?? null;
  }

  /** Copia de solo lectura con todo lo que necesita la interfaz. */
  snapshot() {
    return Object.freeze({
      mode: this.mode,
      worldKey: this.#worldKey,
      playerId: this.playerId,
      playerName: this.#identity?.name ?? null,
      score: this.score,
      level: this.level,
      experience: this.experience,
      experienceForNextLevel: this.experienceForNextLevel,
      levelProgress: this.levelProgress,
      isMaxLevel: this.isMaxLevel,
      verifiedScore: this.#verifiedScore,
      rank: this.#rank,
      stats: this.stats,
      breakdown: this.breakdown,
      status: this.#status
    });
  }

  /**
   * Primeras posiciones de la clasificación del modo actual.
   * @returns {Promise<object>} ProgressionResult con { entries: [{position, playerId, name, score, achievedAt}] }
   */
  async getLeaderboard(limit = this.config.LEADERBOARD_DEFAULT_LIMIT) {
    const bounded = Math.min(this.config.LEADERBOARD_MAX_LIMIT, Math.max(1, Math.floor(limit) || 1));
    const result = await this.api.getLeaderboard(this.mode, bounded);
    if (!result.ok) return result;
    return ProgressionResult.ok({ mode: this.mode, entries: result.data.entries });
  }

  /**
   * Posición y mejor puntuación del jugador actual en la clasificación.
   * @returns {Promise<object>} ProgressionResult con { position, score } (position null si no figura)
   */
  async refreshStanding() {
    if (!this.#identity) return ProgressionResult.fail(ProgressionResult.Reasons.OFFLINE);
    const result = await this.api.getStanding(this.mode, this.#identity.playerId);
    if (!result.ok) return result;
    this.#rank = result.data.position;
    return ProgressionResult.ok({ position: result.data.position, score: result.data.score });
  }

  dispose() {
    this.#tracker?.detach();
    this.#tracker = null;
  }

  // ------------------------------------------------------------ interno

  #onChange({ delta, reason }) {
    this.#dirty = true;
    this.#changeCounter += 1;
    this.store.saveProgress(this.mode, this.#worldKey, this.#revision, this.#tracker.state.toJSON());
    this.events?.emit(GameEventTypes.SCORE_CHANGED, { score: this.score, delta, reason, breakdown: this.breakdown });
    for (const { level, previousLevel } of this.#levelProgress.update(this.stats)) {
      this.events?.emit(GameEventTypes.LEVEL_UP, { level, previousLevel });
    }
  }

  /** Estado serializado aceptable para este mundo, o null. */
  #acceptState(data) {
    const state = ProgressState.parse(data);
    if (!state) return null;
    return this.validator.validate(state, this.#terrain).ok ? state : null;
  }

  async #connect() {
    const identity = await this.#ensureIdentity();
    if (!identity) return;

    let remote = await this.api.getProgress(identity, this.mode, this.#worldKey);
    if (!remote.ok && remote.reason === ProgressionResult.Reasons.UNAUTHORIZED) {
      // El servidor ya no reconoce la identidad (por ejemplo, base reiniciada): se registra otra.
      this.store.clearIdentity();
      this.#identity = null;
      if (!(await this.#ensureIdentity())) return;
      remote = await this.api.getProgress(this.#identity, this.mode, this.#worldKey);
    }

    if (!remote.ok) {
      this.#fail(remote);
      return;
    }
    if (remote.data.progress) this.#adoptRemote(remote.data.progress);
    if (this.#dirty) await this.flush();
  }

  async #ensureIdentity() {
    this.#identity = this.store.loadIdentity();
    if (this.#identity) return this.#identity;

    const result = await this.api.registerPlayer(this.playerName ?? PlayerProgression.#guestName());
    if (!result.ok) {
      this.#fail(result);
      return null;
    }
    const { playerId, token, name } = result.data;
    this.#identity = { playerId, token, name };
    this.store.saveIdentity(this.#identity);
    return this.#identity;
  }

  /** Une lo del servidor con lo local: ninguna posición recompensada se pierde ni se duplica. */
  #adoptRemote({ revision, state, score, rank }) {
    const remoteState = this.#acceptState(state);
    if (!remoteState) return;
    const localState = this.#tracker.state;
    const merged = ProgressState.merge(localState, remoteState);
    const serverHasEverything = remoteState.includes(merged) && remoteState.blocksBuilt === merged.blocksBuilt;
    this.#tracker.load(merged);
    this.#levelProgress.update(this.#tracker.state.stats());
    this.#revision = Math.max(this.#revision, revision);
    this.#dirty = !serverHasEverything;
    this.#verifiedScore = score;
    this.#rank = rank ?? this.#rank;
    this.#status = this.#dirty ? SyncStatus.IDLE : SyncStatus.SYNCED;
    this.store.saveProgress(this.mode, this.#worldKey, this.#revision, merged.toJSON());
  }

  async #submit({ keepalive = false } = {}, retried = false) {
    const changesAtSend = this.#changeCounter;
    const revision = this.#revision + 1;
    this.#status = SyncStatus.SYNCING;
    const result = await this.api.submitProgress(
      this.#identity,
      { mode: this.mode, worldKey: this.#worldKey, revision, state: this.#tracker.state.toJSON() },
      { keepalive }
    );

    if (result.ok) {
      this.#revision = revision;
      this.#verifiedScore = result.data.score;
      this.#rank = result.data.rank;
      this.#dirty = this.#changeCounter !== changesAtSend;
      this.#status = SyncStatus.SYNCED;
      this.#lastError = null;
      this.store.saveProgress(this.mode, this.#worldKey, this.#revision, this.#tracker.state.toJSON());
      this.events?.emit(GameEventTypes.PROGRESS_SYNCED, { score: this.#verifiedScore, rank: this.#rank });
      return result;
    }

    if (result.reason === ProgressionResult.Reasons.UNAUTHORIZED) {
      // Credencial rechazada: se descarta para registrar una nueva en la próxima partida.
      this.store.clearIdentity();
      this.#identity = null;
    }
    if (result.reason === ProgressionResult.Reasons.STALE_REVISION && result.data?.current && !retried) {
      // Otra sesión avanzó primero: se unen ambos progresos y se reenvía una vez.
      this.#adoptRemote(result.data.current);
      this.#dirty = true;
      return this.#submit({ keepalive }, true);
    }
    return this.#fail(result);
  }

  #fail(result) {
    this.#lastError = result;
    const { Reasons } = ProgressionResult;
    if (FINAL_REJECTIONS.has(result.reason)) this.#status = SyncStatus.REJECTED;
    else if (result.reason === Reasons.OFFLINE || result.reason === Reasons.TIMEOUT) this.#status = SyncStatus.OFFLINE;
    else this.#status = SyncStatus.IDLE;
    this.events?.emit(GameEventTypes.PROGRESS_SYNC_FAILED, { reason: result.reason, message: result.message });
    return result;
  }

  static #guestName() {
    const digits = typeof globalThis.crypto?.getRandomValues === 'function'
      ? globalThis.crypto.getRandomValues(new Uint16Array(1))[0] % 10000
      : Date.now() % 10000;
    return `Jugador-${String(digits).padStart(4, '0')}`;
  }
}
