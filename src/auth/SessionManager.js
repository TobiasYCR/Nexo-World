import { AuthSession } from './AuthSession.js';

/**
 * Gestor de persistencia y ciclo de vida de sesiones en el navegador.
 * Aísla el almacenamiento (Storage) de los componentes de UI.
 */
export class SessionManager {
  static STORAGE_KEY = 'nexo-world:auth-session';

  #storage;
  #currentSession;
  #listeners;

  /**
   * @param {Storage|null} [storage]
   */
  constructor(storage = SessionManager.#resolveDefaultStorage()) {
    this.#storage = storage ?? null;
    this.#listeners = new Set();
    this.#currentSession = this.restoreSession();
  }

  static #resolveDefaultStorage() {
    try {
      return globalThis.localStorage ?? globalThis.window?.localStorage ?? null;
    } catch {
      return null;
    }
  }

  /**
   * Obtiene la sesión activa en memoria.
   * @returns {AuthSession}
   */
  getSession() {
    if (this.#currentSession && this.#currentSession.isExpired) {
      this.clearSession();
    }
    return this.#currentSession ?? AuthSession.guest();
  }

  /**
   * Guarda y propaga una nueva sesión.
   * @param {AuthSession} session
   */
  saveSession(session) {
    if (!(session instanceof AuthSession)) {
      throw new Error('La sesión debe ser una instancia de AuthSession.');
    }

    this.#currentSession = session;

    if (this.#storage) {
      try {
        if (session.isAuthenticated) {
          this.#storage.setItem(SessionManager.STORAGE_KEY, JSON.stringify(session.toJSON()));
        } else {
          this.#storage.removeItem(SessionManager.STORAGE_KEY);
        }
      } catch (err) {
        console.warn('[SessionManager] No se pudo persistir la sesión:', err);
      }
    }

    this.#notifyListeners(this.#currentSession);
  }

  /**
   * Cierra y elimina la sesión activa, volviendo al modo invitado.
   */
  clearSession() {
    const previous = this.#currentSession;
    this.#currentSession = AuthSession.guest();

    if (this.#storage) {
      try {
        this.#storage.removeItem(SessionManager.STORAGE_KEY);
      } catch {
        // Silencioso
      }
    }

    if (previous?.isAuthenticated) {
      this.#notifyListeners(this.#currentSession);
    }
  }

  /**
   * Restaura la sesión desde el almacenamiento persistente.
   * @returns {AuthSession}
   */
  restoreSession() {
    if (!this.#storage) {
      return AuthSession.guest();
    }

    try {
      const raw = this.#storage.getItem(SessionManager.STORAGE_KEY);
      if (!raw) return AuthSession.guest();

      const parsed = JSON.parse(raw);
      const session = AuthSession.fromJSON(parsed);

      if (!session || session.isExpired) {
        this.clearSession();
        return AuthSession.guest();
      }

      this.#currentSession = session;
      return session;
    } catch {
      this.clearSession();
      return AuthSession.guest();
    }
  }

  /**
   * Suscribe un callback a los cambios de sesión.
   * @param {(session: AuthSession) => void} callback
   * @returns {() => void} Función de desuscripción
   */
  addChangeListener(callback) {
    if (typeof callback !== 'function') return () => {};
    this.#listeners.add(callback);
    return () => this.#listeners.delete(callback);
  }

  #notifyListeners(session) {
    for (const listener of this.#listeners) {
      try {
        listener(session);
      } catch (err) {
        console.error('[SessionManager] Error en listener de sesión:', err);
      }
    }
  }
}
