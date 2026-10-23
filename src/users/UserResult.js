/**
 * Resultado de una operación sobre usuarios. Se devuelve en lugar de lanzar,
 * igual que SaveResult: quien registra o autentica quiere mostrar un mensaje,
 * no atrapar excepciones.
 *
 * Forma: { ok, reason, message, detail?, ...datos }. `reason` es un código
 * estable para lógica; `message` es texto listo para mostrar al jugador.
 *
 * Los mensajes de credenciales son deliberadamente vagos: decir "ese usuario
 * no existe" o "la contraseña es incorrecta" por separado le confirma a un
 * atacante qué nombres están registrados.
 */
export class UserResult {
  static Reasons = Object.freeze({
    STORAGE_UNAVAILABLE: 'storage-unavailable',
    CRYPTO_UNAVAILABLE: 'crypto-unavailable',
    INVALID_USERNAME: 'invalid-username',
    INVALID_PASSWORD: 'invalid-password',
    USERNAME_TAKEN: 'username-taken',
    EMAIL_TAKEN: 'email-taken',
    INVALID_EMAIL: 'invalid-email',
    NOT_FOUND: 'not-found',
    INVALID_CREDENTIALS: 'invalid-credentials',
    CORRUPT_DATA: 'corrupt-data',
    INCOMPATIBLE_VERSION: 'incompatible-version',
    QUOTA_EXCEEDED: 'quota-exceeded',
    WRITE_FAILED: 'write-failed'
  });

  static #MESSAGES = Object.freeze({
    'storage-unavailable': 'El navegador no permite guardar cuentas (almacenamiento bloqueado o modo privado).',
    'crypto-unavailable': 'El navegador no ofrece las funciones de cifrado necesarias para crear una cuenta.',
    'invalid-username': 'El nombre de usuario no es válido.',
    'invalid-password': 'La contraseña no cumple los requisitos mínimos.',
    'username-taken': 'Ese nombre de usuario ya está en uso.',
    'email-taken': 'Ya hay una cuenta registrada con ese correo.',
    'invalid-email': 'El correo electrónico no es válido.',
    'not-found': 'No existe ninguna cuenta con esos datos.',
    'invalid-credentials': 'El usuario o la contraseña no son correctos.',
    'corrupt-data': 'Los datos de la cuenta están dañados y no se pueden leer.',
    'incompatible-version': 'La cuenta se guardó con una versión incompatible del juego.',
    'quota-exceeded': 'No hay espacio suficiente en el navegador para guardar la cuenta.',
    'write-failed': 'No se pudo guardar la cuenta.'
  });

  static ok(data = {}) {
    return Object.freeze({ ok: true, reason: null, message: null, ...data });
  }

  /**
   * @param {string} reason uno de UserResult.Reasons
   * @param {string} [detail] información técnica para la consola, nunca para la pantalla
   */
  static fail(reason, detail) {
    const message = UserResult.#MESSAGES[reason] ?? 'Error desconocido de cuentas.';
    return Object.freeze({ ok: false, reason, message, ...(detail ? { detail } : {}) });
  }
}
