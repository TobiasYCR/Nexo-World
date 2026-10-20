import { AuthSession } from './AuthSession.js';
import { SessionManager } from './SessionManager.js';
import { BackendAuthClient } from './BackendAuthClient.js';
import { IntentBus } from '../ui/IntentBus.js';

/**
 * Servicio principal de autenticación y gestión de usuarios (Frontend 2).
 * Coordina la comunicación con Backend 1, el almacenamiento local de sesiones
 * y la emisión de eventos de estado de usuario.
 */
export class AuthService {
  #client;
  #sessionManager;
  #intentBus;
  #isBusy;

  /**
   * @param {Object} [options]
   * @param {BackendAuthClient} [options.client]
   * @param {SessionManager} [options.sessionManager]
   * @param {IntentBus|null} [options.intentBus]
   */
  constructor({
    client = new BackendAuthClient(),
    sessionManager = new SessionManager(),
    intentBus = null
  } = {}) {
    this.#client = client;
    this.#sessionManager = sessionManager;
    this.#intentBus = intentBus;
    this.#isBusy = false;

    // Escuchar cambios de sesión para reemitir en el bus de la interfaz
    this.#sessionManager.addChangeListener((session) => {
      this.#notifyStateChange(session);
    });
  }

  get isBusy() {
    return this.#isBusy;
  }

  /**
   * @returns {AuthSession}
   */
  getSession() {
    return this.#sessionManager.getSession();
  }

  /**
   * @returns {Object|null}
   */
  getCurrentUser() {
    return this.getSession().user;
  }

  get isAuthenticated() {
    return this.getSession().isAuthenticated;
  }

  get isGuest() {
    return this.getSession().isGuest;
  }

  /**
   * Registra una nueva cuenta.
   * @param {Object} params
   * @param {string} params.username
   * @param {string} params.email
   * @param {string} params.password
   * @param {string} params.confirmPassword
   */
  async register({ username, email, password, confirmPassword }) {
    if (this.#isBusy) {
      return { ok: false, code: 'REQUEST_IN_FLIGHT', message: 'Ya se está procesando una solicitud.' };
    }

    const validation = this.#validateRegisterInputs({ username, email, password, confirmPassword });
    if (!validation.ok) {
      return validation;
    }

    this.#isBusy = true;
    try {
      const response = await this.#client.register({
        username: username.trim(),
        email: email.trim().toLowerCase(),
        password
      });

      if (!response.ok) {
        return {
          ok: false,
          code: response.code,
          message: response.message
        };
      }

      const session = AuthSession.create({
        token: response.data.token,
        expiresAt: response.data.expiresAt,
        user: response.data.user
      });

      this.#sessionManager.saveSession(session);

      return {
        ok: true,
        user: session.user,
        message: '¡Cuenta creada con éxito!'
      };
    } finally {
      this.#isBusy = false;
    }
  }

  /**
   * Inicia sesión con usuario o email y contraseña.
   * @param {Object} params
   * @param {string} params.identifier
   * @param {string} params.password
   */
  async login({ identifier, password }) {
    if (this.#isBusy) {
      return { ok: false, code: 'REQUEST_IN_FLIGHT', message: 'Ya se está procesando una solicitud.' };
    }

    const trimmedId = (identifier || '').trim();
    if (!trimmedId) {
      return { ok: false, code: 'INVALID_INPUT', message: 'Ingresa tu usuario o correo electrónico.' };
    }
    if (!password) {
      return { ok: false, code: 'INVALID_INPUT', message: 'Ingresa tu contraseña.' };
    }

    this.#isBusy = true;
    try {
      const response = await this.#client.login({
        identifier: trimmedId,
        password
      });

      if (!response.ok) {
        return {
          ok: false,
          code: response.code,
          message: response.message
        };
      }

      const session = AuthSession.create({
        token: response.data.token,
        expiresAt: response.data.expiresAt,
        user: response.data.user
      });

      this.#sessionManager.saveSession(session);

      return {
        ok: true,
        user: session.user,
        message: 'Sesión iniciada correctamente.'
      };
    } finally {
      this.#isBusy = false;
    }
  }

  /**
   * Inicia en modo invitado local sin registrar cuenta.
   */
  playAsGuest() {
    const guestSession = AuthSession.guest();
    this.#sessionManager.saveSession(guestSession);
    return {
      ok: true,
      user: guestSession.user,
      message: 'Ingresando como invitado (partidas locales).'
    };
  }

  /**
   * Cierra la sesión activa y limpia datos privados.
   */
  async logout() {
    const current = this.getSession();
    if (current.isAuthenticated && current.token) {
      try {
        await this.#client.logout(current.token);
      } catch {
        // Continuar con el cierre local aunque falle la red
      }
    }

    this.#sessionManager.clearSession();
    return { ok: true, message: 'Sesión cerrada.' };
  }

  /**
   * Actualiza datos permitidos del perfil del usuario.
   * @param {{ username?: string, currentPassword?: string, newPassword?: string }} updates
   */
  async updateProfile(updates) {
    const current = this.getSession();
    if (!current.isAuthenticated || !current.token) {
      return { ok: false, code: 'UNAUTHORIZED', message: 'Debes iniciar sesión para editar tu perfil.' };
    }

    if (this.#isBusy) {
      return { ok: false, code: 'REQUEST_IN_FLIGHT', message: 'Operación en curso.' };
    }

    if (updates.username) {
      const uVal = this.validateUsername(updates.username);
      if (!uVal.ok) return uVal;
    }

    if (updates.newPassword) {
      if (!updates.currentPassword) {
        return { ok: false, code: 'INVALID_INPUT', message: 'Ingresa tu contraseña actual para cambiarla.' };
      }
      if (updates.newPassword.length < 6) {
        return { ok: false, code: 'INVALID_INPUT', message: 'La nueva contraseña debe tener al menos 6 caracteres.' };
      }
    }

    this.#isBusy = true;
    try {
      const response = await this.#client.updateProfile(current.token, updates);
      if (!response.ok) {
        return { ok: false, code: response.code, message: response.message };
      }

      // Actualizar sesión local con los datos modificados
      const updatedUser = {
        ...current.user,
        ...(response.data?.user || {})
      };

      const newSession = AuthSession.create({
        token: current.token,
        expiresAt: current.expiresAt,
        user: updatedUser
      });

      this.#sessionManager.saveSession(newSession);

      return {
        ok: true,
        user: updatedUser,
        message: 'Perfil actualizado exitosamente.'
      };
    } finally {
      this.#isBusy = false;
    }
  }

  /**
   * Solicita el restablecimiento de contraseña.
   * @param {string} email
   */
  async recoverPassword(email) {
    if (this.#isBusy) {
      return { ok: false, code: 'REQUEST_IN_FLIGHT', message: 'Procesando solicitud...' };
    }

    const emailVal = this.validateEmail(email);
    if (!emailVal.ok) return emailVal;

    this.#isBusy = true;
    try {
      const response = await this.#client.recoverPassword({ email: email.trim().toLowerCase() });
      if (!response.ok) {
        return { ok: false, code: response.code, message: response.message };
      }
      return {
        ok: true,
        message: response.data?.message || 'Si la cuenta existe, se enviaron instrucciones de recuperación.'
      };
    } finally {
      this.#isBusy = false;
    }
  }

  // ==========================================================================
  // Validaciones
  // ==========================================================================

  validateUsername(username) {
    const val = (username || '').trim();
    if (!val) {
      return { ok: false, code: 'INVALID_USERNAME', message: 'El nombre de usuario es obligatorio.' };
    }
    if (val.length < 3 || val.length > 20) {
      return { ok: false, code: 'INVALID_USERNAME', message: 'El usuario debe tener entre 3 y 20 caracteres.' };
    }
    if (!/^[a-zA-Z0-9_]+$/.test(val)) {
      return { ok: false, code: 'INVALID_USERNAME', message: 'El usuario solo puede contener letras, números y guión bajo.' };
    }
    return { ok: true };
  }

  validateEmail(email) {
    const val = (email || '').trim();
    if (!val) {
      return { ok: false, code: 'INVALID_EMAIL', message: 'El correo electrónico es obligatorio.' };
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) {
      return { ok: false, code: 'INVALID_EMAIL', message: 'El correo electrónico no es válido.' };
    }
    return { ok: true };
  }

  validatePassword(password) {
    if (!password) {
      return { ok: false, code: 'INVALID_PASSWORD', message: 'La contraseña es obligatoria.' };
    }
    if (password.length < 6) {
      return { ok: false, code: 'INVALID_PASSWORD', message: 'La contraseña debe tener al menos 6 caracteres.' };
    }
    return { ok: true };
  }

  #validateRegisterInputs({ username, email, password, confirmPassword }) {
    const u = this.validateUsername(username);
    if (!u.ok) return u;

    const e = this.validateEmail(email);
    if (!e.ok) return e;

    const p = this.validatePassword(password);
    if (!p.ok) return p;

    if (password !== confirmPassword) {
      return { ok: false, code: 'PASSWORD_MISMATCH', message: 'Las contraseñas no coinciden.' };
    }

    return { ok: true };
  }

  #notifyStateChange(session) {
    if (this.#intentBus) {
      this.#intentBus.emit(IntentBus.Events.AUTH_STATE_CHANGED, {
        session,
        user: session.user,
        isAuthenticated: session.isAuthenticated,
        isGuest: session.isGuest
      });
    }
  }
}
