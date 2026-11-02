import { PlayerTokens } from '../security/PlayerTokens.js';

/**
 * Rutas de cuentas. Siguen el contrato que ya usa BackendAuthClient en el
 * juego, así que la interfaz no cambia:
 *
 *   POST /api/auth/register          { username, email, password, guestToken? } -> { token, expiresAt, user }
 *   POST /api/auth/login             { identifier, password, guestToken? }      -> { token, expiresAt, user }
 *   POST /api/auth/logout            (token)
 *   GET  /api/auth/session           (token) -> { token, expiresAt, user }
 *   GET  /api/user/profile           (token) -> { user }
 *   PUT  /api/user/profile           (token) { username?, currentPassword?, newPassword? } -> { user }
 *   POST /api/auth/recover-password  -> 501, no hay servidor de correo
 *
 * user = { id, username, email, createdAt, updatedAt, playerId }.
 * Errores: { code, message }.
 */
export class AuthRoutes {
  /** @param {import('../accounts/AccountService.js').AccountService} accounts */
  constructor(accounts) {
    this.accounts = accounts;
  }

  /**
   * Atiende el pedido si la ruta es de cuentas.
   * @param {{method:string, path:string, headers:object, readJson:()=>Promise<object|undefined>}} request
   * @returns {Promise<import('../accounts/AuthResponse.js').AuthResponse|null|undefined>}
   *   respuesta, null si la ruta no es de cuentas, undefined si el cuerpo ya se rechazó
   */
  async handle({ method, path, headers, readJson }) {
    const token = PlayerTokens.fromAuthorizationHeader(headers.authorization);
    const route = `${method} ${path}`;

    switch (route) {
      case 'POST /auth/register':
        return this.#withBody(readJson, (body) => this.accounts.register(body));
      case 'POST /auth/login':
        return this.#withBody(readJson, (body) => this.accounts.login(body));
      case 'POST /auth/logout':
        return this.accounts.logout(token);
      case 'GET /auth/session':
        return this.accounts.session(token);
      case 'GET /user/profile':
        return this.accounts.profile(token);
      case 'PUT /user/profile':
        return this.#withBody(readJson, (body) => this.accounts.updateProfile(token, body));
      case 'POST /auth/recover-password':
        return this.accounts.recoverPassword();
      default:
        return null;
    }
  }

  async #withBody(readJson, action) {
    const body = await readJson();
    if (body === undefined) return undefined;
    return action(body);
  }
}
