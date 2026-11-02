/**
 * Cliente HTTP REST del servidor de cuentas (server/http/AuthRoutes.js).
 * Traduce peticiones de red en respuestas estandarizadas y maneja errores de conexión.
 */
export class BackendAuthClient {
  static #OFFLINE_MESSAGE =
    'No se pudo conectar con el servidor de cuentas. Revisá que esté corriendo (npm run server) o jugá como invitado.';

  #baseUrl;
  #fetchFn;
  #guestTokenProvider;

  /**
   * @param {Object} [options]
   * @param {string} [options.baseUrl]
   * @param {typeof fetch} [options.fetchFn]
   * @param {() => (string|null|undefined)} [options.guestTokenProvider] token del jugador
   *   invitado de este navegador; el servidor lo usa para que la cuenta conserve su progreso
   */
  constructor({ baseUrl = '/api', fetchFn = globalThis.fetch, guestTokenProvider = () => null } = {}) {
    this.#baseUrl = baseUrl.replace(/\/+$/, '');
    this.#fetchFn = fetchFn ? (...args) => fetchFn(...args) : null;
    this.#guestTokenProvider = guestTokenProvider;
  }

  /**
   * Registra un nuevo usuario en Backend 1.
   * @param {{ username: string, email: string, password: string }} payload
   */
  async register({ username, email, password }) {
    return this.#request('/auth/register', {
      method: 'POST',
      body: { username, email, password, ...this.#guestToken() }
    });
  }

  /**
   * Inicia sesión con usuario/email y contraseña.
   * @param {{ identifier: string, password: string }} payload
   */
  async login({ identifier, password }) {
    return this.#request('/auth/login', {
      method: 'POST',
      body: { identifier, password, ...this.#guestToken() }
    });
  }

  /**
   * Invalida la sesión actual en Backend 1.
   * @param {string} token
   */
  async logout(token) {
    return this.#request('/auth/logout', {
      method: 'POST',
      token
    });
  }

  /**
   * Comprueba si un token de sesión sigue siendo válido.
   * @param {string} token
   */
  async verifySession(token) {
    return this.#request('/auth/session', {
      method: 'GET',
      token
    });
  }

  /**
   * Obtiene la información del perfil del usuario autenticado.
   * @param {string} token
   */
  async getProfile(token) {
    return this.#request('/user/profile', {
      method: 'GET',
      token
    });
  }

  /**
   * Actualiza los datos permitidos del perfil del usuario.
   * @param {string} token
   * @param {{ username?: string, currentPassword?: string, newPassword?: string }} updates
   */
  async updateProfile(token, updates) {
    return this.#request('/user/profile', {
      method: 'PUT',
      token,
      body: updates
    });
  }

  /**
   * Solicita el restablecimiento de contraseña para un correo.
   * @param {{ email: string }} payload
   */
  async recoverPassword({ email }) {
    return this.#request('/auth/recover-password', {
      method: 'POST',
      body: { email }
    });
  }

  #guestToken() {
    let token = null;
    try {
      token = this.#guestTokenProvider?.() ?? null;
    } catch {
      token = null;
    }
    return typeof token === 'string' && token !== '' ? { guestToken: token } : {};
  }

  async #request(endpoint, { method = 'GET', body = null, token = null } = {}) {
    const url = `${this.#baseUrl}${endpoint}`;
    const headers = {
      'Content-Type': 'application/json'
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const options = {
      method,
      headers
    };

    if (body !== null && method !== 'GET' && method !== 'HEAD') {
      options.body = JSON.stringify(body);
    }

    try {
      if (!this.#fetchFn) {
        return {
          ok: false,
          code: 'NETWORK_ERROR',
          message: 'Entorno de red no disponible (fetch no definido).'
        };
      }

      const response = await this.#fetchFn(url, options);
      let json = null;

      try {
        json = await response.json();
      } catch {
        json = null;
      }

      if (!response.ok && json === null && response.status >= 500) {
        // El proxy de Vite responde 5xx sin cuerpo JSON cuando el servidor no está levantado.
        return { ok: false, code: 'NETWORK_ERROR', message: BackendAuthClient.#OFFLINE_MESSAGE };
      }

      if (!response.ok) {
        return {
          ok: false,
          code: json?.code || `HTTP_${response.status}`,
          message: json?.message || `Error del servidor (${response.status})`
        };
      }

      return {
        ok: true,
        data: json
      };
    } catch (networkError) {
      return {
        ok: false,
        code: 'NETWORK_ERROR',
        message: BackendAuthClient.#OFFLINE_MESSAGE
      };
    }
  }
}
