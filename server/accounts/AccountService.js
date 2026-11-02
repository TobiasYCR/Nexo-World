import { GameConfig } from '../../src/game/GameConfig.js';
import { PasswordHasher } from '../../src/users/PasswordHasher.js';
import { UserValidator } from '../../src/users/UserValidator.js';
import { UserAccount } from '../../src/users/UserAccount.js';
import { PlayerTokens } from '../security/PlayerTokens.js';
import { LoginThrottle } from '../security/LoginThrottle.js';
import { AuthResponse } from './AuthResponse.js';

/**
 * Casos de uso de cuentas: registro, inicio y cierre de sesión, perfil.
 *
 * Reutiliza las reglas del juego (UserValidator, PasswordHasher, UserAccount)
 * para que el servidor y la pantalla de registro pidan exactamente lo mismo.
 *
 * Cada cuenta tiene un jugador de la tabla de puntuaciones (players.account_id).
 * Al registrarse, si el navegador ya jugaba como invitado, ese jugador pasa a
 * ser el de la cuenta y conserva su progreso. Con la sesión iniciada, el token
 * de sesión también sirve para guardar progreso (ver resolvePlayer).
 *
 * Todos los métodos devuelven AuthResponse y no lanzan.
 */
export class AccountService {
  #accounts;
  #players;
  #hasher;
  #validator;
  #throttle;
  #clock;
  #sessionTtlMs;
  #logger;
  /** Credencial de descarte para que un usuario inexistente tarde lo mismo que una contraseña errónea. */
  #dummyCredential = null;

  /**
   * @param {import('../persistence/AccountRepository.js').AccountRepository} accounts
   * @param {import('../persistence/ProgressionRepository.js').ProgressionRepository} players
   * @param {{hasher?:PasswordHasher, validator?:UserValidator, throttle?:LoginThrottle,
   *          clock?:()=>number, sessionTtlMs?:number, logger?:{error:Function}}} [options]
   */
  constructor(accounts, players, {
    hasher = new PasswordHasher(),
    validator = new UserValidator(),
    throttle = new LoginThrottle(),
    clock = Date.now,
    sessionTtlMs = GameConfig.users.SESSION_TTL_MS,
    logger = console
  } = {}) {
    this.#accounts = accounts;
    this.#players = players;
    this.#hasher = hasher;
    this.#validator = validator;
    this.#throttle = throttle;
    this.#clock = clock;
    this.#sessionTtlMs = sessionTtlMs;
    this.#logger = logger;
  }

  async register(body) {
    const { username, email, password, guestToken } = body ?? {};
    const invalid = this.#validator.checkUsername(username)
      ?? (typeof email === 'string' && email.trim() !== '' ? this.#validator.checkEmail(email) : 'invalid-email')
      ?? this.#validator.checkPassword(password);
    if (invalid) return AuthResponse.fail(invalid);

    return this.#guard(async () => {
      const credential = await this.#hasher.derive(password);
      if (!credential) return AuthResponse.fail('storage-error');

      const now = this.#clock();
      const cleanName = username.trim();
      const cleanEmail = email.trim().toLowerCase();
      const account = {
        id: PlayerTokens.newPlayerId(),
        username: cleanName,
        usernameKey: UserAccount.normalizeUsername(cleanName),
        email: cleanEmail,
        emailKey: cleanEmail,
        credential,
        createdAt: now,
        updatedAt: now
      };
      const created = await this.#accounts.createAccount(account);
      if (!created.ok) return AuthResponse.fail(created.reason);

      return AuthResponse.ok(await this.#openSession(account, guestToken), 201);
    });
  }

  async login(body) {
    const { identifier, password, guestToken } = body ?? {};
    if (typeof identifier !== 'string' || identifier.trim() === '' || typeof password !== 'string' || password === '') {
      return AuthResponse.fail('invalid-request');
    }
    const key = UserAccount.normalizeUsername(identifier);

    return this.#guard(async () => {
      const now = this.#clock();
      const retryAfterSeconds = this.#throttle.retryAfterSeconds(key, now);
      if (retryAfterSeconds > 0) return AuthResponse.fail('rate-limited', { retryAfterSeconds });

      const account = await this.#accounts.findAccountByLogin(key);
      const valid = account
        ? await this.#hasher.verify(password, account.credential)
        : await this.#verifyAgainstDummy(password);
      if (!account || !valid) {
        this.#throttle.recordFailure(key, now);
        return AuthResponse.fail('invalid-credentials');
      }

      this.#throttle.reset(key);
      return AuthResponse.ok(await this.#openSession(account, guestToken));
    });
  }

  async logout(token) {
    if (!token) return AuthResponse.ok({});
    return this.#guard(async () => {
      await this.#accounts.deleteSession(PlayerTokens.hash(token));
      return AuthResponse.ok({});
    });
  }

  async session(token) {
    return this.#guard(async () => {
      const found = await this.#authenticate(token);
      if (!found) return AuthResponse.fail('unauthorized');
      return AuthResponse.ok({ token, expiresAt: found.session.expiresAt, user: await this.#publicUser(found.account) });
    });
  }

  async profile(token) {
    return this.#guard(async () => {
      const found = await this.#authenticate(token);
      if (!found) return AuthResponse.fail('unauthorized');
      return AuthResponse.ok({ user: await this.#publicUser(found.account) });
    });
  }

  /**
   * @param {string} token
   * @param {{username?:string, currentPassword?:string, newPassword?:string}} updates
   */
  async updateProfile(token, updates) {
    const { username, currentPassword, newPassword } = updates ?? {};
    return this.#guard(async () => {
      const found = await this.#authenticate(token);
      if (!found) return AuthResponse.fail('unauthorized');
      const { account } = found;
      const changes = { updatedAt: this.#clock() };

      if (username !== undefined && username !== account.username) {
        const invalid = this.#validator.checkUsername(username);
        if (invalid) return AuthResponse.fail(invalid);
        changes.username = username.trim();
        changes.usernameKey = UserAccount.normalizeUsername(username);
      }

      if (newPassword !== undefined && newPassword !== '') {
        const invalid = this.#validator.checkPassword(newPassword);
        if (invalid) return AuthResponse.fail(invalid);
        if (typeof currentPassword !== 'string' || !(await this.#hasher.verify(currentPassword, account.credential))) {
          return AuthResponse.fail('wrong-password');
        }
        changes.credential = await this.#hasher.derive(newPassword);
        if (!changes.credential) return AuthResponse.fail('storage-error');
      }

      const updated = await this.#accounts.updateAccount(account.id, changes);
      if (!updated.ok) return AuthResponse.fail(updated.reason === 'not-found' ? 'unauthorized' : updated.reason);
      if (changes.username) await this.#players.renameAccountPlayer(account.id, changes.username);
      // Cambiar la contraseña cierra las demás sesiones abiertas de la cuenta.
      if (changes.credential) await this.#accounts.deleteSessionsOfAccount(account.id, PlayerTokens.hash(token));

      const fresh = await this.#accounts.findAccountById(account.id);
      return AuthResponse.ok({ user: await this.#publicUser(fresh) });
    });
  }

  async recoverPassword() {
    return AuthResponse.fail('not-supported');
  }

  /**
   * Jugador de la cuenta dueña de un token de sesión, o null. Lo usa la API de
   * progresión para aceptar el token de sesión además del de invitado.
   */
  async resolvePlayer(token) {
    try {
      const found = await this.#authenticate(token);
      if (!found) return null;
      return await this.#ensurePlayer(found.account, null);
    } catch (error) {
      this.#logger.error('[accounts] error al resolver la sesión', error);
      return null;
    }
  }

  // ------------------------------------------------------------ interno

  async #openSession(account, guestToken) {
    const now = this.#clock();
    await this.#accounts.deleteExpiredSessions(now);
    const token = PlayerTokens.newToken();
    const expiresAt = now + this.#sessionTtlMs;
    await this.#accounts.createSession({ tokenHash: PlayerTokens.hash(token), accountId: account.id, createdAt: now, expiresAt });
    await this.#ensurePlayer(account, guestToken);
    return { token, expiresAt, user: await this.#publicUser(account) };
  }

  /** Cuenta y sesión de un token vigente, o null. */
  async #authenticate(token) {
    if (typeof token !== 'string' || token === '') return null;
    const tokenHash = PlayerTokens.hash(token);
    const session = await this.#accounts.findSession(tokenHash);
    if (!session) return null;
    if (session.expiresAt <= this.#clock()) {
      await this.#accounts.deleteSession(tokenHash);
      return null;
    }
    const account = await this.#accounts.findAccountById(session.accountId);
    return account ? { account, session } : null;
  }

  /**
   * Jugador de la cuenta. Si no tiene, adopta al invitado del navegador (si
   * todavía no es de nadie) o crea uno nuevo con el nombre de la cuenta.
   */
  async #ensurePlayer(account, guestToken) {
    const existing = await this.#players.findPlayerByAccountId(account.id);
    if (existing) return existing;

    if (typeof guestToken === 'string' && guestToken !== '') {
      const guest = await this.#players.findPlayerByTokenHash(PlayerTokens.hash(guestToken));
      if (guest && guest.accountId == null && await this.#players.linkPlayerToAccount(guest.id, account.id, account.username)) {
        return { ...guest, accountId: account.id, name: account.username };
      }
    }

    // Nadie conoce este token: el jugador de una cuenta se usa con el token de sesión.
    const player = {
      id: PlayerTokens.newPlayerId(),
      name: account.username,
      tokenHash: PlayerTokens.hash(PlayerTokens.newToken()),
      accountId: account.id,
      createdAt: this.#clock()
    };
    try {
      await this.#players.createPlayer(player);
    } catch (error) {
      // Dos inicios de sesión simultáneos: el otro ya creó el jugador de la cuenta.
      const created = await this.#players.findPlayerByAccountId(account.id);
      if (created) return created;
      throw error;
    }
    return player;
  }

  async #publicUser(account) {
    const player = await this.#players.findPlayerByAccountId(account.id);
    return {
      id: account.id,
      username: account.username,
      email: account.email,
      createdAt: account.createdAt,
      updatedAt: account.updatedAt,
      playerId: player?.id ?? null
    };
  }

  async #verifyAgainstDummy(password) {
    this.#dummyCredential ??= await this.#hasher.derive('nexo-world-cuenta-inexistente');
    if (this.#dummyCredential) await this.#hasher.verify(password, this.#dummyCredential);
    return false;
  }

  async #guard(operation) {
    try {
      return await operation();
    } catch (error) {
      this.#logger.error('[accounts] error de almacenamiento', error);
      return AuthResponse.fail('storage-error');
    }
  }
}
