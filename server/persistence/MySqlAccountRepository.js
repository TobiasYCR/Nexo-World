import { AccountRepository } from './AccountRepository.js';
import { MySqlDatabase } from './MySqlDatabase.js';

/**
 * Cuentas y sesiones sobre MySQL. Usa la misma conexión que la progresión,
 * así jugadores, cuentas y puntuaciones quedan en la base nexo_world.
 * Todas las consultas usan parámetros.
 */
export class MySqlAccountRepository extends AccountRepository {
  #database;
  #ownsDatabase;

  /** @param {MySqlDatabase|object} source conexión compartida, o datos para abrir una propia */
  constructor(source) {
    super();
    this.#ownsDatabase = !(source instanceof MySqlDatabase);
    this.#database = this.#ownsDatabase ? new MySqlDatabase(source) : source;
  }

  get #pool() {
    return this.#database.pool;
  }

  async init() {
    await this.#database.init();
  }

  async createAccount({ id, username, usernameKey, email, emailKey, credential, createdAt, updatedAt }) {
    try {
      await this.#pool.query(
        `INSERT INTO accounts (id, username, username_key, email, email_key, credential, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, username, usernameKey, email, emailKey, JSON.stringify(credential), createdAt, updatedAt]
      );
      return { ok: true };
    } catch (error) {
      const taken = MySqlAccountRepository.#takenReason(error);
      if (taken) return { ok: false, reason: taken };
      throw error;
    }
  }

  async findAccountById(accountId) {
    const [rows] = await this.#pool.query('SELECT * FROM accounts WHERE id = ?', [accountId]);
    return rows.length ? MySqlAccountRepository.#toAccount(rows[0]) : null;
  }

  async findAccountByLogin(key) {
    const [rows] = await this.#pool.query(
      'SELECT * FROM accounts WHERE username_key = ? OR email_key = ? LIMIT 1',
      [key, key]
    );
    return rows.length ? MySqlAccountRepository.#toAccount(rows[0]) : null;
  }

  async updateAccount(accountId, { username, usernameKey, credential, updatedAt }) {
    const sets = ['updated_at = ?'];
    const values = [updatedAt];
    if (username !== undefined) {
      sets.push('username = ?', 'username_key = ?');
      values.push(username, usernameKey);
    }
    if (credential !== undefined) {
      sets.push('credential = ?');
      values.push(JSON.stringify(credential));
    }
    try {
      const [result] = await this.#pool.query(`UPDATE accounts SET ${sets.join(', ')} WHERE id = ?`, [...values, accountId]);
      return result.affectedRows === 1 ? { ok: true } : { ok: false, reason: 'not-found' };
    } catch (error) {
      const taken = MySqlAccountRepository.#takenReason(error);
      if (taken) return { ok: false, reason: taken };
      throw error;
    }
  }

  async createSession({ tokenHash, accountId, createdAt, expiresAt }) {
    await this.#pool.query(
      'INSERT INTO sessions (token_hash, account_id, created_at, expires_at) VALUES (?, ?, ?, ?)',
      [tokenHash, accountId, createdAt, expiresAt]
    );
  }

  async findSession(tokenHash) {
    const [rows] = await this.#pool.query('SELECT * FROM sessions WHERE token_hash = ?', [tokenHash]);
    if (!rows.length) return null;
    const row = rows[0];
    return {
      tokenHash: row.token_hash,
      accountId: row.account_id,
      createdAt: Number(row.created_at),
      expiresAt: Number(row.expires_at)
    };
  }

  async deleteSession(tokenHash) {
    await this.#pool.query('DELETE FROM sessions WHERE token_hash = ?', [tokenHash]);
  }

  async deleteSessionsOfAccount(accountId, exceptTokenHash = null) {
    await this.#pool.query(
      'DELETE FROM sessions WHERE account_id = ? AND token_hash <> ?',
      [accountId, exceptTokenHash ?? '']
    );
  }

  async deleteExpiredSessions(now) {
    await this.#pool.query('DELETE FROM sessions WHERE expires_at <= ?', [now]);
  }

  async close() {
    if (this.#ownsDatabase) await this.#database.close();
  }

  /** Nombre o correo repetido según el índice único que saltó. */
  static #takenReason(error) {
    if (error?.code !== 'ER_DUP_ENTRY') return null;
    return String(error.message).includes('uq_accounts_email') ? 'email-taken' : 'username-taken';
  }

  static #toAccount(row) {
    return {
      id: row.id,
      username: row.username,
      usernameKey: row.username_key,
      email: row.email,
      emailKey: row.email_key,
      credential: MySqlDatabase.json(row.credential),
      createdAt: Number(row.created_at),
      updatedAt: Number(row.updated_at)
    };
  }
}
