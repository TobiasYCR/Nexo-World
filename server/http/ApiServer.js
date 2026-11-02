import { createServer } from 'node:http';
import { ProgressionResult } from '../../src/progression/ProgressionResult.js';
import { PlayerTokens } from '../security/PlayerTokens.js';

const { Reasons } = ProgressionResult;

/** Código HTTP de cada motivo de error. */
const STATUS_BY_REASON = Object.freeze({
  [Reasons.UNAUTHORIZED]: 401,
  [Reasons.NOT_FOUND]: 404,
  [Reasons.PLAYER_NOT_FOUND]: 404,
  [Reasons.INVALID_REQUEST]: 400,
  [Reasons.INVALID_NAME]: 422,
  [Reasons.INVALID_MODE]: 422,
  [Reasons.UNSUPPORTED_WORLD]: 422,
  [Reasons.INVALID_PROGRESS]: 422,
  [Reasons.STALE_REVISION]: 409,
  [Reasons.RATE_LIMITED]: 429,
  [Reasons.STORAGE_ERROR]: 503,
  [Reasons.SERVER_ERROR]: 500
});

/**
 * Capa HTTP de la API de progresión (node:http, sin frameworks). Solo traduce
 * pedidos y respuestas: valida forma y tamaño, autentica y delega toda regla
 * en ProgressionService. Respuestas siempre en JSON.
 *
 * Rutas:
 *   GET  /api/health
 *   POST /api/players                       { name } -> { playerId, token, name }
 *   GET  /api/progress?mode=&world=          (token) -> { progress } (null si no hay)
 *   PUT  /api/progress                       (token) { mode, world, revision, state }
 *   GET  /api/leaderboard?mode=&limit=
 *   GET  /api/leaderboard/players/:id?mode=
 */
export class ApiServer {
  static MAX_BODY_BYTES = 256 * 1024;

  /**
   * @param {import('../progression/ProgressionService.js').ProgressionService} service
   * @param {{allowedOrigin:string, basePath?:string, logger?:{error:Function}}} options
   */
  constructor(service, { allowedOrigin, basePath = '/api', logger = console }) {
    this.service = service;
    this.allowedOrigin = allowedOrigin;
    this.basePath = basePath;
    this.logger = logger;
    this.server = createServer((request, response) => {
      this.#handle(request, response).catch((error) => {
        this.logger.error('[api] error no controlado', error);
        if (!response.headersSent) this.#send(response, 500, ApiServer.#errorBody(ProgressionResult.fail(Reasons.SERVER_ERROR)));
      });
    });
  }

  /** @returns {Promise<number>} puerto efectivo (0 elige uno libre, útil en tests) */
  listen(port, host) {
    return new Promise((resolve, reject) => {
      this.server.once('error', reject);
      this.server.listen(port, host, () => {
        this.server.off('error', reject);
        resolve(this.server.address().port);
      });
    });
  }

  close() {
    return new Promise((resolve) => this.server.close(() => resolve()));
  }

  async #handle(request, response) {
    this.#setCorsHeaders(response);
    if (request.method === 'OPTIONS') {
      response.writeHead(204).end();
      return;
    }

    const url = new URL(request.url, 'http://localhost');
    if (!url.pathname.startsWith(`${this.basePath}/`)) {
      this.#sendResult(response, ProgressionResult.fail(Reasons.NOT_FOUND));
      return;
    }
    const path = url.pathname.slice(this.basePath.length);
    const query = url.searchParams;
    const route = `${request.method} ${path}`;

    if (route === 'GET /health') {
      this.#send(response, 200, { ok: true });
      return;
    }
    if (route === 'POST /players') {
      const body = await this.#readJson(request, response);
      if (body === undefined) return;
      this.#sendResult(response, await this.service.registerPlayer(body?.name), 201);
      return;
    }
    if (path === '/progress' && (request.method === 'GET' || request.method === 'PUT')) {
      const player = await this.service.authenticate(PlayerTokens.fromAuthorizationHeader(request.headers.authorization));
      if (!player) {
        this.#sendResult(response, ProgressionResult.fail(Reasons.UNAUTHORIZED));
        return;
      }
      if (request.method === 'GET') {
        this.#sendResult(response, await this.service.getProgress(player, query.get('mode'), query.get('world')));
        return;
      }
      const body = await this.#readJson(request, response);
      if (body === undefined) return;
      this.#sendResult(response, await this.service.submitProgress(player, body));
      return;
    }
    if (route === 'GET /leaderboard') {
      this.#sendResult(response, await this.service.leaderboard(query.get('mode'), query.get('limit')));
      return;
    }
    const standingMatch = /^\/leaderboard\/players\/([0-9a-f-]{36})$/.exec(path);
    if (request.method === 'GET' && standingMatch) {
      this.#sendResult(response, await this.service.standing(query.get('mode'), standingMatch[1]));
      return;
    }
    if (request.method === 'GET' && path.startsWith('/leaderboard/players/')) {
      this.#sendResult(response, ProgressionResult.fail(Reasons.PLAYER_NOT_FOUND));
      return;
    }
    this.#sendResult(response, ProgressionResult.fail(Reasons.NOT_FOUND));
  }

  /** Lee y parsea el cuerpo; si falla responde 400/413 y devuelve undefined. */
  async #readJson(request, response) {
    const chunks = [];
    let size = 0;
    for await (const chunk of request) {
      size += chunk.length;
      if (size > ApiServer.MAX_BODY_BYTES) {
        this.#send(response, 413, ApiServer.#errorBody(ProgressionResult.fail(Reasons.INVALID_REQUEST, { detail: 'cuerpo demasiado grande' })));
        request.destroy();
        return undefined;
      }
      chunks.push(chunk);
    }
    try {
      return chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : null;
    } catch {
      this.#send(response, 400, ApiServer.#errorBody(ProgressionResult.fail(Reasons.INVALID_REQUEST, { detail: 'JSON inválido' })));
      return undefined;
    }
  }

  #sendResult(response, result, successStatus = 200) {
    if (result.ok) {
      const { ok, reason, message, ...data } = result;
      this.#send(response, successStatus, data);
      return;
    }
    this.#send(response, STATUS_BY_REASON[result.reason] ?? 500, ApiServer.#errorBody(result));
  }

  /** Cuerpo de error: motivo estable, mensaje legible y datos útiles para el cliente. */
  static #errorBody({ reason, message, detail, current, retryAfterSeconds }) {
    return { error: reason, message, ...(detail ? { detail } : {}), ...(current !== undefined ? { current } : {}), ...(retryAfterSeconds ? { retryAfterSeconds } : {}) };
  }

  #setCorsHeaders(response) {
    response.setHeader('Access-Control-Allow-Origin', this.allowedOrigin);
    response.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS');
    response.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    response.setHeader('Vary', 'Origin');
  }

  #send(response, status, body) {
    const json = JSON.stringify(body);
    response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': Buffer.byteLength(json) });
    response.end(json);
  }
}
