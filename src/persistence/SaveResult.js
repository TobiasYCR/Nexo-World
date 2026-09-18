/**
 * Resultado de una operación de guardado o carga. Se devuelve en lugar de lanzar:
 * quien guarda quiere mostrar un mensaje, no atrapar excepciones.
 *
 * Forma: { ok, reason, message, detail?, ...datos }. `reason` es un código
 * estable para lógica; `message` es texto listo para mostrar al jugador.
 */
export class SaveResult {
  static Reasons = Object.freeze({
    STORAGE_UNAVAILABLE: 'storage-unavailable',
    INVALID_SLOT: 'invalid-slot',
    NOT_FOUND: 'not-found',
    CORRUPT_DATA: 'corrupt-data',
    INCOMPATIBLE_VERSION: 'incompatible-version',
    WORLD_MISMATCH: 'world-mismatch',
    CORRUPT_CHUNK: 'corrupt-chunk',
    CORRUPT_PLAYER: 'corrupt-player',
    QUOTA_EXCEEDED: 'quota-exceeded',
    WRITE_FAILED: 'write-failed'
  });

  static #MESSAGES = Object.freeze({
    'storage-unavailable': 'El navegador no permite guardar partidas (almacenamiento bloqueado o modo privado).',
    'invalid-slot': 'El nombre de la ranura de guardado no es válido.',
    'not-found': 'No hay ninguna partida guardada en esta ranura.',
    'corrupt-data': 'La partida guardada está dañada y no se puede leer.',
    'incompatible-version': 'La partida se guardó con una versión incompatible del juego.',
    'world-mismatch': 'La partida guardada corresponde a un mundo de otro tamaño.',
    'corrupt-chunk': 'Una parte del mundo guardado está dañada; no se cargó nada.',
    'corrupt-player': 'Los datos del jugador guardados están dañados; no se cargó nada.',
    'quota-exceeded': 'No hay espacio suficiente en el navegador para guardar la partida.',
    'write-failed': 'No se pudo escribir la partida.'
  });

  static ok(data = {}) {
    return Object.freeze({ ok: true, reason: null, message: null, ...data });
  }

  /**
   * @param {string} reason uno de SaveResult.Reasons
   * @param {string} [detail] información técnica para la consola
   */
  static fail(reason, detail) {
    const message = SaveResult.#MESSAGES[reason] ?? 'Error desconocido de guardado.';
    return Object.freeze({ ok: false, reason, message, ...(detail ? { detail } : {}) });
  }
}
