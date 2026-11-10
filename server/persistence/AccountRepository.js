/**
 * Contrato de almacenamiento de cuentas y sesiones. AccountService solo habla
 * con esta interfaz; las implementaciones (MySQL, memoria) son intercambiables.
 *
 * Tipos:
 *   Account { id, username, usernameKey, email, emailKey, credential, createdAt, updatedAt }
 *   Session { tokenHash, accountId, createdAt, expiresAt }
 *
 * usernameKey y emailKey son los valores normalizados (minúsculas, sin
 * espacios en los extremos) y son la clave de unicidad.
 * Todos los tiempos son milisegundos epoch.
 * @interface
 */
export class AccountRepository {
  /** Crea las estructuras necesarias si no existen. */
  async init() { throw new Error('no implementado'); }

  /**
   * @param {Account} account
   * @returns {Promise<{ok:true}|{ok:false, reason:'username-taken'|'email-taken'}>}
   */
  async createAccount(account) { throw new Error('no implementado'); }

  /** @returns {Promise<Account|null>} */
  async findAccountById(accountId) { throw new Error('no implementado'); }

  /**
   * Busca por nombre o por correo, ya normalizados.
   * @returns {Promise<Account|null>}
   */
  async findAccountByLogin(key) { throw new Error('no implementado'); }

  /**
   * Cambia nombre y/o credencial.
   * @param {string} accountId
   * @param {{username?:string, usernameKey?:string, credential?:object, updatedAt:number}} changes
   * @returns {Promise<{ok:true}|{ok:false, reason:'username-taken'|'not-found'}>}
   */
  async updateAccount(accountId, changes) { throw new Error('no implementado'); }

  /** @param {Session} session */
  async createSession(session) { throw new Error('no implementado'); }

  /** @returns {Promise<Session|null>} */
  async findSession(tokenHash) { throw new Error('no implementado'); }

  async deleteSession(tokenHash) { throw new Error('no implementado'); }

  /** Cierra todas las sesiones de una cuenta salvo, opcionalmente, una. */
  async deleteSessionsOfAccount(accountId, exceptTokenHash = null) { throw new Error('no implementado'); }

  /** Borra las sesiones vencidas. */
  async deleteExpiredSessions(now) { throw new Error('no implementado'); }

  /**
   * Guarda un código de recuperación y descarta los anteriores sin usar de la cuenta.
   * @param {{tokenHash:string, accountId:string, createdAt:number, expiresAt:number}} reset
   */
  async createPasswordReset(reset) { throw new Error('no implementado'); }

  /** @returns {Promise<{tokenHash, accountId, createdAt, expiresAt, usedAt:number|null}|null>} */
  async findPasswordReset(tokenHash) { throw new Error('no implementado'); }

  /**
   * Marca el código como usado. Solo funciona una vez.
   * @returns {Promise<boolean>} true si estaba sin usar
   */
  async markPasswordResetUsed(tokenHash, usedAt) { throw new Error('no implementado'); }

  async close() {}
}
