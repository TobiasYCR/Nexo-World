/**
 * Representa una sesión de autenticación en Nexo World.
 * Encapsula el token de acceso, el usuario activo y el estado de expiración.
 */
export class AuthSession {
  #token;
  #expiresAt;
  #user;
  #isGuest;

  /**
   * @param {Object} params
   * @param {string|null} [params.token]
   * @param {number|null} [params.expiresAt]
   * @param {{ id: string, username: string, email?: string, createdAt?: number }|null} [params.user]
   * @param {boolean} [params.isGuest]
   */
  constructor({ token = null, expiresAt = null, user = null, isGuest = false } = {}) {
    this.#token = token;
    this.#expiresAt = typeof expiresAt === 'number' ? expiresAt : null;
    this.#user = user ? Object.freeze({ ...user }) : null;
    this.#isGuest = Boolean(isGuest);
    Object.freeze(this);
  }

  get token() {
    return this.#token;
  }

  get expiresAt() {
    return this.#expiresAt;
  }

  get user() {
    return this.#user;
  }

  get isGuest() {
    return this.#isGuest;
  }

  get isAuthenticated() {
    return !this.#isGuest && Boolean(this.#token && this.#user && !this.isExpired);
  }

  get isExpired() {
    if (!this.#expiresAt) return false;
    return Date.now() >= this.#expiresAt;
  }

  /**
   * Crea una sesión en modo invitado (Guest Mode).
   * @returns {AuthSession}
   */
  static guest() {
    return new AuthSession({
      token: null,
      expiresAt: null,
      user: {
        id: 'guest',
        username: 'Invitado',
        email: '',
        createdAt: Date.now()
      },
      isGuest: true
    });
  }

  /**
   * Crea una sesión autenticada con credenciales válidas.
   * @param {Object} data
   * @returns {AuthSession}
   */
  static create({ token, expiresAt, user }) {
    if (!token || typeof token !== 'string') {
      throw new Error('Se requiere un token de autenticación válido.');
    }
    if (!user || typeof user !== 'object' || !user.id || !user.username) {
      throw new Error('Se requiere un usuario válido con id y username.');
    }
    return new AuthSession({
      token,
      expiresAt,
      user,
      isGuest: false
    });
  }

  /**
   * Serializa la sesión para almacenamiento seguro (sin datos sensibles).
   */
  toJSON() {
    if (this.#isGuest) {
      return { isGuest: true };
    }
    return {
      token: this.#token,
      expiresAt: this.#expiresAt,
      user: this.#user,
      isGuest: false
    };
  }

  /**
   * Reconstruye una sesión a partir de un JSON almacenado.
   * @param {Object} raw
   * @returns {AuthSession|null}
   */
  static fromJSON(raw) {
    if (!raw || typeof raw !== 'object') return null;
    if (raw.isGuest) return AuthSession.guest();
    if (!raw.token || !raw.user) return null;
    return new AuthSession({
      token: raw.token,
      expiresAt: raw.expiresAt,
      user: raw.user,
      isGuest: false
    });
  }
}
