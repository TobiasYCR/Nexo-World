import { UserAccount } from './UserAccount.js';
import { UserRepository } from './UserRepository.js';
import { UserResult } from './UserResult.js';
import { UserValidator } from './UserValidator.js';
import { PasswordHasher } from './PasswordHasher.js';

/**
 * Contrato público del sistema de cuentas. Es la única clase que el resto del
 * juego debería usar: nadie más toca el almacenamiento ni las credenciales.
 *
 * Qué hace y qué no, para no pisarse con Frontend 2:
 *
 *   SÍ  registrar, buscar, renombrar, cambiar contraseña y verificar que un par
 *       usuario/contraseña es correcto.
 *   NO  sesiones, tokens, "usuario actual", pantallas ni recordar quién entró.
 *
 * verifyCredentials() existe acá porque la credencial no sale de este módulo:
 * nadie afuera puede comparar un hash que no puede leer. El flujo de inicio de
 * sesión (qué pasa después de verificar, cuánto dura la sesión, cómo se
 * muestra) es de Frontend 2.
 *
 * Todos los métodos son asincrónicos porque Web Crypto lo es, incluso los que
 * hoy no derivan nada: así el contrato no cambia si mañana lo necesitan.
 */
export class UserManager {
  #repository;
  #validator;
  #hasher;
  #clock;

  constructor(
    repository = new UserRepository(),
    hasher = new PasswordHasher(),
    validator = new UserValidator(),
    clock = () => Date.now()
  ) {
    this.#repository = repository;
    this.#hasher = hasher;
    this.#validator = validator;
    this.#clock = clock;
  }

  /** Si esto es false, registrar o iniciar sesión va a fallar siempre. */
  get isAvailable() {
    return this.#repository.isAvailable && this.#hasher.isAvailable;
  }

  /**
   * Registra una cuenta nueva.
   * @param {string} username
   * @param {string} password
   * @returns {Promise<{ok:boolean, reason:string|null, message:string|null, account?:object}>}
   */
  async register(username, password) {
    const { Reasons } = UserResult;

    const badUsername = this.#validator.checkUsername(username);
    if (badUsername) return UserResult.fail(badUsername);
    const badPassword = this.#validator.checkPassword(password);
    if (badPassword) return UserResult.fail(badPassword);

    if (!this.#hasher.isAvailable) return UserResult.fail(Reasons.CRYPTO_UNAVAILABLE);

    const trimmed = username.trim();
    const usernameKey = UserAccount.normalizeUsername(trimmed);

    // Se chequea antes de derivar para no gastar 200.000 iteraciones en un
    // nombre que ya está tomado. El insert vuelve a chequear, porque entre
    // ambos momentos otra pestaña pudo registrar el mismo nombre.
    const existing = this.#repository.findByUsernameKey(usernameKey);
    if (existing.ok) return UserResult.fail(Reasons.USERNAME_TAKEN);
    if (existing.reason !== Reasons.NOT_FOUND) return existing;

    const credential = await this.#hasher.derive(password);
    if (credential === null) return UserResult.fail(Reasons.CRYPTO_UNAVAILABLE);

    const now = this.#clock();
    const account = new UserAccount({
      id: UserManager.#newId(),
      username: trimmed,
      credential,
      createdAt: now,
      updatedAt: now
    });
    return this.#repository.insert(account);
  }

  /**
   * Comprueba que el par usuario/contraseña es correcto.
   *
   * Devuelve el mismo motivo (`invalid-credentials`) tanto si el usuario no
   * existe como si la contraseña está mal: distinguirlos le confirmaría a un
   * atacante qué nombres están registrados.
   *
   * @returns {Promise<{ok:boolean, reason:string|null, account?:object}>}
   */
  async verifyCredentials(username, password) {
    const { Reasons } = UserResult;
    if (typeof username !== 'string' || typeof password !== 'string') {
      return UserResult.fail(Reasons.INVALID_CREDENTIALS);
    }
    if (!this.#hasher.isAvailable) return UserResult.fail(Reasons.CRYPTO_UNAVAILABLE);

    const found = this.#repository.findByUsernameKey(UserAccount.normalizeUsername(username));
    if (!found.ok) {
      // Un almacenamiento caído o datos dañados sí se informan tal cual: no son
      // una pista sobre qué cuentas existen, y el jugador necesita saberlo.
      if (found.reason !== Reasons.NOT_FOUND) return found;
      return UserResult.fail(Reasons.INVALID_CREDENTIALS);
    }

    const matches = await this.#hasher.verify(password, found.account.credential);
    if (!matches) return UserResult.fail(Reasons.INVALID_CREDENTIALS);
    return UserResult.ok({ account: found.account.toPublicJSON() });
  }

  /** @returns {Promise<{ok:boolean, reason:string|null, account?:object}>} */
  async findByUsername(username) {
    if (typeof username !== 'string') return UserResult.fail(UserResult.Reasons.NOT_FOUND);
    const found = this.#repository.findByUsernameKey(UserAccount.normalizeUsername(username));
    if (!found.ok) return found;
    return UserResult.ok({ account: found.account.toPublicJSON() });
  }

  /** @returns {Promise<{ok:boolean, reason:string|null, account?:object}>} */
  async findById(id) {
    const found = this.#repository.findById(id);
    if (!found.ok) return found;
    return UserResult.ok({ account: found.account.toPublicJSON() });
  }

  /** @returns {Promise<boolean>} */
  async exists(username) {
    const found = await this.findByUsername(username);
    return found.ok;
  }

  /** Vistas públicas de todas las cuentas, sin credenciales. */
  async listAccounts() {
    return this.#repository.listPublic();
  }

  /**
   * Cambia el nombre de una cuenta, manteniendo su id.
   * @param {string} id
   * @param {string} username nombre nuevo
   */
  async renameAccount(id, username) {
    const badUsername = this.#validator.checkUsername(username);
    if (badUsername) return UserResult.fail(badUsername);

    const found = this.#repository.findById(id);
    if (!found.ok) return found;

    const account = found.account;
    const previousKey = account.usernameKey;
    account.rename(username.trim(), this.#clock());
    return this.#repository.update(account, previousKey);
  }

  /**
   * Cambia la contraseña, exigiendo la actual.
   *
   * Pedir la contraseña vigente es lo que evita que alguien que dejó la sesión
   * abierta en una máquina ajena quede con la cuenta tomada.
   */
  async changePassword(id, currentPassword, newPassword) {
    const { Reasons } = UserResult;

    const badPassword = this.#validator.checkPassword(newPassword);
    if (badPassword) return UserResult.fail(badPassword);
    if (!this.#hasher.isAvailable) return UserResult.fail(Reasons.CRYPTO_UNAVAILABLE);

    const found = this.#repository.findById(id);
    if (!found.ok) return found;

    const account = found.account;
    const matches = await this.#hasher.verify(currentPassword, account.credential);
    if (!matches) return UserResult.fail(Reasons.INVALID_CREDENTIALS);

    const credential = await this.#hasher.derive(newPassword);
    if (credential === null) return UserResult.fail(Reasons.CRYPTO_UNAVAILABLE);

    account.changeCredential(credential, this.#clock());
    return this.#repository.update(account);
  }

  /** Borra una cuenta, exigiendo la contraseña. */
  async deleteAccount(id, password) {
    const { Reasons } = UserResult;
    if (!this.#hasher.isAvailable) return UserResult.fail(Reasons.CRYPTO_UNAVAILABLE);

    const found = this.#repository.findById(id);
    if (!found.ok) return found;

    const matches = await this.#hasher.verify(password, found.account.credential);
    if (!matches) return UserResult.fail(Reasons.INVALID_CREDENTIALS);
    return this.#repository.delete(id);
  }

  /**
   * Identificador único.
   *
   * Usa crypto.randomUUID cuando está (navegadores actuales y Node >= 19). El
   * respaldo con getRandomValues cubre contextos sin HTTPS, donde randomUUID
   * no se expone. Math.random no se usa ni como último recurso: dos pestañas
   * abiertas en el mismo milisegundo pueden generar el mismo valor.
   */
  static #newId() {
    const provider = globalThis.crypto;
    if (typeof provider?.randomUUID === 'function') return provider.randomUUID();
    const bytes = provider.getRandomValues(new Uint8Array(16));
    return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  }
}
