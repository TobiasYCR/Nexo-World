/**
 * Cliente HTTP REST para comunicación con los contratos de Backend 1.
 * Traduce peticiones de red en respuestas estandarizadas y maneja errores de conexión.
 */
export class BackendAuthClient {
  #baseUrl;
  #fetchFn;

  /**
   * @param {Object} [options]
   * @param {string} [options.baseUrl]
   * @param {typeof fetch} [options.fetchFn]
   */
  constructor({ baseUrl = '/api', fetchFn = globalThis.fetch } = {}) {
    this.#baseUrl = baseUrl.replace(/\/+$/, '');
    this.#fetchFn = fetchFn;
  }

  /**
   * Registra un nuevo usuario en Backend 1.
   * @param {{ username: string, email: string, password: string }} payload
   */
  async register({ username, email, password }) {
    return this.#request('/auth/register', {
      method: 'POST',
      body: { username, email, password }
    });
  }

  /**
   * Inicia sesión con usuario/email y contraseña.
   * @param {{ identifier: string, password: string }} payload
   */
  async login({ identifier, password }) {
    return this.#request('/auth/login', {
      method: 'POST',
      body: { identifier, password }
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
        message: 'No se pudo conectar con el servidor de autenticación. Verifica tu conexión.'
      };
    }
  }
}
