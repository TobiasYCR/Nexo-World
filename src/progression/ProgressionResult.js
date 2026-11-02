/**
 * Resultado de una operación de progresión (red o almacenamiento). Igual que
 * SaveResult: no lanza, devuelve { ok, reason, message, ...datos } con un
 * código estable para la lógica y un texto listo para mostrar.
 */
export class ProgressionResult {
  static Reasons = Object.freeze({
    OFFLINE: 'offline',
    TIMEOUT: 'timeout',
    UNAUTHORIZED: 'unauthorized',
    NOT_FOUND: 'not-found',
    PLAYER_NOT_FOUND: 'player-not-found',
    INVALID_REQUEST: 'invalid-request',
    INVALID_NAME: 'invalid-name',
    INVALID_MODE: 'invalid-mode',
    UNSUPPORTED_WORLD: 'unsupported-world',
    INVALID_PROGRESS: 'invalid-progress',
    STALE_REVISION: 'stale-revision',
    RATE_LIMITED: 'rate-limited',
    STORAGE_UNAVAILABLE: 'storage-unavailable',
    STORAGE_ERROR: 'storage-error',
    SERVER_ERROR: 'server-error'
  });

  static #MESSAGES = Object.freeze({
    offline: 'No hay conexión con el servidor de puntuaciones; el progreso se guarda en este navegador.',
    timeout: 'El servidor de puntuaciones tardó demasiado en responder.',
    unauthorized: 'No se pudo verificar tu identidad de jugador.',
    'not-found': 'No hay progreso registrado para este mundo.',
    'player-not-found': 'El jugador no existe.',
    'invalid-request': 'La solicitud no es válida.',
    'invalid-name': 'El nombre de jugador no es válido.',
    'invalid-mode': 'El modo de juego no es válido.',
    'unsupported-world': 'El servidor no reconoce este mundo.',
    'invalid-progress': 'El progreso enviado no es coherente con el mundo.',
    'stale-revision': 'Hay un progreso más reciente registrado.',
    'rate-limited': 'Se sumaron puntos demasiado rápido; se volverá a intentar más tarde.',
    'storage-unavailable': 'No se puede guardar el progreso en este navegador.',
    'storage-error': 'No se pudo guardar el progreso.',
    'server-error': 'El servidor de puntuaciones tuvo un error.'
  });

  static ok(data = {}) {
    return Object.freeze({ ok: true, reason: null, message: null, ...data });
  }

  static fail(reason, data = {}) {
    const message = ProgressionResult.#MESSAGES[reason] ?? 'Error desconocido de progresión.';
    return Object.freeze({ ok: false, reason, message, ...data });
  }

  static messageFor(reason) {
    return ProgressionResult.#MESSAGES[reason] ?? 'Error desconocido de progresión.';
  }
}
