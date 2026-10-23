/**
 * Una cuenta de usuario.
 *
 * La credencial se guarda como objeto opaco ({algorithm, iterations, salt,
 * hash}) y nunca se expone fuera de esta clase y de PasswordHasher: el resto
 * del juego trabaja con toPublicJSON(), que no la incluye. Así, un sector que
 * muestre perfiles no puede filtrar el hash por descuido.
 *
 * `usernameKey` es el nombre normalizado y es la clave de unicidad: evita que
 * "Leandro" y "leandro" se registren como cuentas distintas.
 */
export class UserAccount {
  #id;
  #username;
  #email;
  #credential;
  #createdAt;
  #updatedAt;

  /**
   * @param {{id:string, username:string, email?:string|null, credential:object,
   *          createdAt:number, updatedAt:number}} datos
   */
  constructor({ id, username, email = null, credential, createdAt, updatedAt }) {
    this.#id = id;
    this.#username = username;
    this.#email = email ?? null;
    this.#credential = credential;
    this.#createdAt = createdAt;
    this.#updatedAt = updatedAt;
  }

  get id() {
    return this.#id;
  }

  get username() {
    return this.#username;
  }

  /**
   * Correo, si la cuenta se registró con uno. Es opcional a propósito: la capa
   * de datos no lo necesita para nada (sin servidor de mail no habilita
   * recuperar ni verificar la cuenta), pero la pantalla de registro lo pide y
   * permite iniciar sesión con él, así que se guarda cuando llega.
   */
  get email() {
    return this.#email;
  }

  /** Clave de unicidad del correo, con el mismo criterio que el nombre. */
  get emailKey() {
    return this.#email === null ? null : UserAccount.normalizeUsername(this.#email);
  }

  get createdAt() {
    return this.#createdAt;
  }

  get updatedAt() {
    return this.#updatedAt;
  }

  /** Clave de unicidad: minúsculas y sin espacios en los extremos. */
  get usernameKey() {
    return UserAccount.normalizeUsername(this.#username);
  }

  /** @param {string} username */
  static normalizeUsername(username) {
    return String(username ?? '').trim().toLowerCase();
  }

  /**
   * Copia de la credencial. Se devuelve copia y no la referencia para que
   * nadie la mute desde afuera sin pasar por changeCredential().
   */
  get credential() {
    return { ...this.#credential };
  }

  /** @param {object} credential credencial nueva, ya derivada por PasswordHasher */
  changeCredential(credential, now = Date.now()) {
    this.#credential = credential;
    this.#updatedAt = now;
  }

  /** @param {string} username */
  rename(username, now = Date.now()) {
    this.#username = username;
    this.#updatedAt = now;
  }

  /** @param {string|null} email */
  changeEmail(email, now = Date.now()) {
    this.#email = email ?? null;
    this.#updatedAt = now;
  }

  /** Vista segura: es la única forma en la que una cuenta sale de este módulo. */
  toPublicJSON() {
    return {
      id: this.#id,
      username: this.#username,
      email: this.#email,
      createdAt: this.#createdAt,
      updatedAt: this.#updatedAt
    };
  }

  /** Forma completa, solo para que UserRepository la escriba en el almacenamiento. */
  toStoredJSON() {
    return {
      id: this.#id,
      username: this.#username,
      email: this.#email,
      credential: { ...this.#credential },
      createdAt: this.#createdAt,
      updatedAt: this.#updatedAt
    };
  }

  /**
   * Reconstruye una cuenta leída del almacenamiento.
   * Devuelve null si al registro le falta cualquier campo obligatorio: los
   * datos vienen de localStorage, que el usuario puede editar a mano.
   * @returns {UserAccount|null}
   */
  static fromStoredJSON(raw) {
    if (raw === null || typeof raw !== 'object') return null;
    const { id, username, email, credential, createdAt, updatedAt } = raw;
    if (typeof id !== 'string' || id.length === 0) return null;
    if (typeof username !== 'string' || username.trim().length === 0) return null;
    if (credential === null || typeof credential !== 'object') return null;
    if (typeof credential.hash !== 'string' || typeof credential.salt !== 'string') return null;
    if (!Number.isFinite(createdAt) || !Number.isFinite(updatedAt)) return null;
    // El correo es opcional: una cuenta guardada antes de que existiera el
    // campo sigue siendo válida y se lee con email null.
    const correo = typeof email === 'string' && email.length > 0 ? email : null;
    return new UserAccount({ id, username, email: correo, credential, createdAt, updatedAt });
  }
}
