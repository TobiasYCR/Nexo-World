import { GameConfig } from '../game/GameConfig.js';
import { UserManager } from './UserManager.js';
import { UserResult } from './UserResult.js';

/**
 * Adaptador entre la pantalla de login (Frontend 2) y el sistema de cuentas
 * (Backend 1).
 *
 * Por qué existe: `AuthService` hablaba con `BackendAuthClient`, que hace
 * pedidos HTTP a `/api/auth/*`. Ese servidor no existe, así que registrarse
 * fallaba con "No se pudo conectar con el servidor de autenticación" mientras
 * `UserManager` quedaba sin usar. Esta clase implementa la misma interfaz que
 * `BackendAuthClient` —mismos métodos, mismas respuestas `{ok, data}` o
 * `{ok, code, message}`— pero resuelve todo contra `UserManager`, en el
 * navegador. Intercambiarlas no toca una línea de la interfaz.
 *
 * Qué es un "token" acá: sin servidor no hay nada que firmar ni validar del
 * otro lado. El token es un identificador de sesión local, guardado junto al
 * id del usuario y su vencimiento. Sirve para que la interfaz sepa quién está
 * conectado y para que la sesión caduque; **no es una credencial de
 * seguridad**. Quien pueda editar localStorage puede fabricarse uno. Es la
 * misma limitación que documenta docs/INVESTIGACION-PERSISTENCIA-USUARIOS.md:
 * esto separa perfiles en una misma máquina, no protege cuentas.
 */
export class LocalAuthClient {
  static SESSION_PREFIX = 'nexo-world:session:';

  #users;
  #storage;
  #ttl;
  #clock;

  /**
   * @param {{users?:UserManager, storage?:Storage|null, ttlMs?:number, clock?:()=>number}} [opciones]
   */
  constructor({
    users = new UserManager(),
    storage = LocalAuthClient.#resolveDefaultStorage(),
    ttlMs = GameConfig.users.SESSION_TTL_MS,
    clock = () => Date.now()
  } = {}) {
    this.#users = users;
    this.#storage = storage ?? null;
    this.#ttl = ttlMs;
    this.#clock = clock;
  }

  static #resolveDefaultStorage() {
    try {
      return globalThis.localStorage ?? null;
    } catch {
      return null;
    }
  }

  // --- Interfaz de BackendAuthClient ---------------------------------------

  async register({ username, email, password }) {
    const resultado = await this.#users.register(username, password, { email });
    if (!resultado.ok) return LocalAuthClient.#error(resultado);
    return this.#abrirSesion(resultado.account);
  }

  async login({ identifier, password }) {
    const resultado = await this.#users.verifyCredentials(identifier, password);
    if (!resultado.ok) return LocalAuthClient.#error(resultado);
    return this.#abrirSesion(resultado.account);
  }

  async logout(token) {
    this.#borrarSesion(token);
    return { ok: true, data: {} };
  }

  async verifySession(token) {
    const sesion = this.#leerSesion(token);
    if (sesion === null) {
      return { ok: false, code: 'UNAUTHORIZED', message: 'La sesión expiró o no es válida.' };
    }
    const encontrado = await this.#users.findById(sesion.userId);
    if (!encontrado.ok) {
      // La cuenta ya no está: la sesión que apunta a ella tampoco sirve.
      this.#borrarSesion(token);
      return { ok: false, code: 'UNAUTHORIZED', message: 'La sesión expiró o no es válida.' };
    }
    return { ok: true, data: { token, expiresAt: sesion.expiresAt, user: encontrado.account } };
  }

  async getProfile(token) {
    const verificada = await this.verifySession(token);
    if (!verificada.ok) return verificada;
    return { ok: true, data: { user: verificada.data.user } };
  }

  /**
   * @param {string} token
   * @param {{username?:string, currentPassword?:string, newPassword?:string}} updates
   */
  async updateProfile(token, updates = {}) {
    const verificada = await this.verifySession(token);
    if (!verificada.ok) return verificada;
    const id = verificada.data.user.id;

    if (updates.newPassword) {
      const cambiada = await this.#users.changePassword(id, updates.currentPassword, updates.newPassword);
      if (!cambiada.ok) return LocalAuthClient.#error(cambiada);
    }

    if (updates.username && updates.username !== verificada.data.user.username) {
      const renombrada = await this.#users.renameAccount(id, updates.username);
      if (!renombrada.ok) return LocalAuthClient.#error(renombrada);
    }

    const actualizado = await this.#users.findById(id);
    if (!actualizado.ok) return LocalAuthClient.#error(actualizado);
    return { ok: true, data: { user: actualizado.account } };
  }

  /**
   * Recuperar la contraseña no se puede hacer sin servidor, y se dice.
   *
   * Lo honesto es fallar con un motivo claro en vez de contestar "si la cuenta
   * existe, se enviaron instrucciones": nadie envía nada, y el usuario se
   * quedaría esperando un correo que no va a llegar.
   */
  async recoverPassword() {
    return {
      ok: false,
      code: 'NOT_SUPPORTED',
      message:
        'La recuperación de contraseña necesita un servidor de correo, que este juego todavía no tiene. ' +
        'Si olvidaste la clave, creá una cuenta nueva o pedile ayuda al equipo.'
    };
  }

  // --- Sesiones locales ----------------------------------------------------

  #abrirSesion(cuenta) {
    if (!this.#storage) {
      return { ok: false, code: 'STORAGE_UNAVAILABLE', message: UserResult.fail('storage-unavailable').message };
    }
    const token = LocalAuthClient.#nuevoToken();
    const expiresAt = this.#clock() + this.#ttl;
    try {
      this.#storage.setItem(
        LocalAuthClient.SESSION_PREFIX + token,
        JSON.stringify({ userId: cuenta.id, expiresAt })
      );
    } catch {
      return {
        ok: false,
        code: 'STORAGE_UNAVAILABLE',
        message: 'No se pudo guardar la sesión en el navegador.'
      };
    }
    return { ok: true, data: { token, expiresAt, user: cuenta } };
  }

  /** @returns {{userId:string, expiresAt:number}|null} */
  #leerSesion(token) {
    if (!this.#storage || typeof token !== 'string' || token.length === 0) return null;
    let crudo;
    try {
      crudo = this.#storage.getItem(LocalAuthClient.SESSION_PREFIX + token);
    } catch {
      return null;
    }
    if (crudo === null || crudo === undefined) return null;

    let sesion;
    try {
      sesion = JSON.parse(crudo);
    } catch {
      return null;
    }
    if (sesion === null || typeof sesion !== 'object') return null;
    if (typeof sesion.userId !== 'string' || !Number.isFinite(sesion.expiresAt)) return null;
    if (this.#clock() >= sesion.expiresAt) {
      this.#borrarSesion(token);
      return null;
    }
    return sesion;
  }

  #borrarSesion(token) {
    if (!this.#storage || typeof token !== 'string') return;
    try {
      this.#storage.removeItem(LocalAuthClient.SESSION_PREFIX + token);
    } catch {
      // Nada que hacer: quien llamó ya recibió el resultado de su operación.
    }
  }

  /** Traduce un UserResult a la forma de error que espera AuthService. */
  static #error(resultado) {
    return {
      ok: false,
      code: LocalAuthClient.#CODIGOS[resultado.reason] ?? 'ERROR',
      message: resultado.message
    };
  }

  /** Motivos de UserResult -> códigos que la interfaz ya conoce. */
  static #CODIGOS = Object.freeze({
    'storage-unavailable': 'STORAGE_UNAVAILABLE',
    'crypto-unavailable': 'CRYPTO_UNAVAILABLE',
    'invalid-username': 'INVALID_USERNAME',
    'invalid-password': 'INVALID_PASSWORD',
    'invalid-email': 'INVALID_EMAIL',
    'username-taken': 'USERNAME_TAKEN',
    'email-taken': 'EMAIL_TAKEN',
    'not-found': 'NOT_FOUND',
    'invalid-credentials': 'INVALID_CREDENTIALS',
    'corrupt-data': 'CORRUPT_DATA',
    'incompatible-version': 'INCOMPATIBLE_VERSION',
    'quota-exceeded': 'QUOTA_EXCEEDED',
    'write-failed': 'WRITE_FAILED'
  });

  /** Mismo criterio que los ids de cuenta: nada de Math.random. */
  static #nuevoToken() {
    const provider = globalThis.crypto;
    if (typeof provider?.randomUUID === 'function') return provider.randomUUID();
    const bytes = provider.getRandomValues(new Uint8Array(32));
    return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  }
}
