import { UserResult } from '../../src/users/UserResult.js';

/** Código de error que espera la interfaz (el mismo que usa LocalAuthClient) y su estado HTTP. */
const ERRORS = Object.freeze({
  'invalid-username': ['INVALID_USERNAME', 400],
  'invalid-password': ['INVALID_PASSWORD', 400],
  'invalid-email': ['INVALID_EMAIL', 400],
  'invalid-request': ['INVALID_INPUT', 400],
  'invalid-credentials': ['INVALID_CREDENTIALS', 401],
  'invalid-reset-code': ['INVALID_RESET_CODE', 400],
  'account-not-found': ['ACCOUNT_NOT_FOUND', 404],
  'wrong-password': ['INVALID_CREDENTIALS', 401],
  unauthorized: ['UNAUTHORIZED', 401],
  'username-taken': ['USERNAME_TAKEN', 409],
  'email-taken': ['EMAIL_TAKEN', 409],
  'rate-limited': ['RATE_LIMITED', 429],
  'not-supported': ['NOT_SUPPORTED', 501],
  'storage-error': ['STORAGE_ERROR', 503]
});

/** Mensajes propios del servidor; el resto sale de UserResult para que coincidan con el juego. */
const MESSAGES = Object.freeze({
  'invalid-request': 'Faltan datos en la solicitud.',
  'wrong-password': 'La contraseña actual no es correcta.',
  unauthorized: 'La sesión expiró o no es válida. Volvé a iniciar sesión.',
  'rate-limited': 'Demasiados intentos fallidos. Esperá unos minutos antes de volver a probar.',
  'not-supported':
    'Este juego no manda correos. Para recuperar la contraseña, pedile a un administrador un código ' +
    'de recuperación y usalo en "¿Olvidaste tu contraseña?".',
  'invalid-reset-code': 'El código no es válido, ya se usó o venció. Pedile uno nuevo al administrador.',
  'account-not-found': 'No hay ninguna cuenta con ese usuario o correo.',
  'storage-error': 'No se pudo acceder a la base de datos. Probá de nuevo en un momento.'
});

/**
 * Respuesta de AccountService, lista para enviar por HTTP.
 * Éxito: el cuerpo son los datos. Error: { code, message } con la forma que
 * lee BackendAuthClient.
 */
export class AuthResponse {
  static ok(data, status = 200) {
    return Object.freeze({ ok: true, status, body: data });
  }

  /**
   * @param {string} reason motivo interno (claves de ERRORS)
   * @param {{retryAfterSeconds?:number}} [extra]
   */
  static fail(reason, extra = {}) {
    const [code, status] = ERRORS[reason] ?? ['SERVER_ERROR', 500];
    const message = MESSAGES[reason] ?? UserResult.fail(reason).message;
    return Object.freeze({ ok: false, status, body: { code, message, ...extra } });
  }
}
