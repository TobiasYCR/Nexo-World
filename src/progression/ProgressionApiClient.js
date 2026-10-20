import { GameConfig } from '../game/GameConfig.js';
import { ProgressionResult } from './ProgressionResult.js';

/**
 * Cliente HTTP del servidor de puntuaciones. Solo traduce llamadas a la API
 * (ver docs/PROGRESION.md) en ProgressionResult: no conoce reglas ni estado.
 * Ningún método lanza; un servidor caído devuelve reason 'offline'.
 */
export class ProgressionApiClient {
  /**
   * @param {object} [config] GameConfig.progression
   * @param {typeof fetch|null} [fetchFn] inyectable para tests
   */
  constructor(config = GameConfig.progression, fetchFn = ProgressionApiClient.#defaultFetch()) {
    this.config = config;
    this.basePath = config.API_BASE_PATH;
    this.fetch = fetchFn;
  }

  static #defaultFetch() {
    return typeof globalThis.fetch === 'function' ? globalThis.fetch.bind(globalThis) : null;
  }

  registerPlayer(name) {
    return this.#request('POST', '/players', { body: { name } });
  }

  getProgress(identity, mode, worldKey) {
    const query = new URLSearchParams({ mode, world: worldKey });
    return this.#request('GET', `/progress?${query}`, { token: identity.token });
  }

  submitProgress(identity, { mode, worldKey, revision, state }, { keepalive = false } = {}) {
    return this.#request('PUT', '/progress', { token: identity.token, body: { mode, world: worldKey, revision, state }, keepalive });
  }

  getLeaderboard(mode, limit) {
    const query = new URLSearchParams({ mode, limit: String(limit) });
    return this.#request('GET', `/leaderboard?${query}`);
  }

  getStanding(mode, playerId) {
    const query = new URLSearchParams({ mode });
    return this.#request('GET', `/leaderboard/players/${encodeURIComponent(playerId)}?${query}`);
  }

  async #request(method, path, { body, token, keepalive = false } = {}) {
    if (!this.fetch) return ProgressionResult.fail(ProgressionResult.Reasons.OFFLINE);

    const controller = typeof AbortController === 'function' ? new AbortController() : null;
    const timer = controller ? setTimeout(() => controller.abort(), this.config.REQUEST_TIMEOUT_MS) : null;
    const headers = { Accept: 'application/json' };
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (token) headers.Authorization = `Bearer ${token}`;

    let response;
    try {
      response = await this.fetch(`${this.basePath}${path}`, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: controller?.signal,
        keepalive
      });
    } catch (error) {
      const reason = error?.name === 'AbortError' ? ProgressionResult.Reasons.TIMEOUT : ProgressionResult.Reasons.OFFLINE;
      return ProgressionResult.fail(reason, { detail: String(error?.message ?? error) });
    } finally {
      if (timer) clearTimeout(timer);
    }

    let data = null;
    try {
      data = await response.json();
    } catch {
      // Un proxy sin servidor detrás responde HTML o vacío: se trata como desconexión.
      return ProgressionResult.fail(ProgressionResult.Reasons.OFFLINE, { status: response.status });
    }

    if (response.ok) return ProgressionResult.ok({ status: response.status, data });
    const reason = Object.values(ProgressionResult.Reasons).includes(data?.error)
      ? data.error
      : ProgressionResult.Reasons.SERVER_ERROR;
    return ProgressionResult.fail(reason, { status: response.status, data });
  }
}
