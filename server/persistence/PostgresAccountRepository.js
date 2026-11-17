import { AccountRepository } from './AccountRepository.js';
import { PostgresDatabase } from './PostgresDatabase.js';

/**
 * Cuentas, sesiones y códigos de recuperación sobre PostgreSQL. Usa la misma
 * conexión que la progresión. Todas las consultas usan parámetros.
 */
export class PostgresAccountRepository extends AccountRepository {
  #database;
  #ownsDatabase;

  /** @param {PostgresDatabase|object} source conexión compartida, o datos para abrir una propia */
  constructor(source) {
    super();
    this.#ownsDatabase = !(source instanceof PostgresDatabase);
    this.#database = this.#ownsDatabase ? new PostgresDatabase(source) : source;
  }

  async init() {
    await this.#database.init();
  }

  async createAccount({ id, username, usernameKey, email, emailKey, credential, createdAt, updatedAt }) {
    try {
      await this.#database.query(
        `INSERT INTO accounts (id, username, username_key, email, email_key, credential, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [id, username, usernameKey, email, emailKey, JSON.stringify(credential), createdAt, updatedAt]
      );
      return { ok: true };
    } catch (error) {
      const taken = PostgresAccountRepository.#takenReason(error);
      if (taken) return { ok: false, reason: taken };
      throw error;
    }
  }

  async findAccountById(accountId) {
    const { rows } = await this.#database.query('SELECT * FROM accounts WHERE id = $1', [accountId]);
    return rows.length ? PostgresAccountRepository.#toAccount(rows[0]) : null;
  }

  async findAccountByLogin(key) {
    const { rows } = await this.#database.query(
      'SELECT * FROM accounts WHERE username_key = $1 OR email_key = $1 LIMIT 1',
      [key]
    );
    return rows.length ? PostgresAccountRepository.#toAccount(rows[0]) : null;
  }

  async updateAccount(accountId, { username, usernameKey, credential, updatedAt }) {
    const values = [updatedAt];
    const sets = [`updated_at = $${values.length}`];
    if (username !== undefined) {
      values.push(username);
      sets.push(`username = $${values.length}`);
      values.push(usernameKey);
      sets.push(`username_key = $${values.length}`);
    }
    if (credential !== undefined) {
      values.push(JSON.stringify(credential));
      sets.push(`credential = $${values.length}`);
    }
    values.push(accountId);
    try {
      const { rowCount } = await this.#database.query(
        `UPDATE accounts SET ${sets.join(', ')} WHERE id = $${values.length}`,
        values
      );
      return rowCount === 1 ? { ok: true } : { ok: false, reason: 'not-found' };
    } catch (error) {
      const taken = PostgresAccountRepository.#takenReason(error);
      if (taken) return { ok: false, reason: taken };
      throw error;
    }
  }

  async createSession({ tokenHash, accountId, createdAt, expiresAt }) {
    await this.#database.query(
      'INSERT INTO sessions (token_hash, account_id, created_at, expires_at) VALUES ($1, $2, $3, $4)',
      [tokenHash, accountId, createdAt, expiresAt]
    );
  }

  async findSession(tokenHash) {
    const { rows } = await this.#database.query('SELECT * FROM sessions WHERE token_hash = $1', [tokenHash]);
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
    await this.#database.query('DELETE FROM sessions WHERE token_hash = $1', [tokenHash]);
  }

  async deleteSessionsOfAccount(accountId, exceptTokenHash = null) {
    await this.#database.query(
      'DELETE FROM sessions WHERE account_id = $1 AND token_hash <> $2',
      [accountId, exceptTokenHash ?? '']
    );
  }

  async deleteExpiredSessions(now) {
    await this.#database.query('DELETE FROM sessions WHERE expires_at <= $1', [now]);
  }

  async createPasswordReset({ tokenHash, accountId, createdAt, expiresAt }) {
    await this.#database.transaction(async (client) => {
      await client.query('DELETE FROM password_resets WHERE account_id = $1 AND used_at IS NULL', [accountId]);
      await client.query(
        'INSERT INTO password_resets (token_hash, account_id, created_at, expires_at) VALUES ($1, $2, $3, $4)',
        [tokenHash, accountId, createdAt, expiresAt]
      );
    });
  }

  async findPasswordReset(tokenHash) {
    const { rows } = await this.#database.query('SELECT * FROM password_resets WHERE token_hash = $1', [tokenHash]);
    if (!rows.length) return null;
    const row = rows[0];
    return {
      tokenHash: row.token_hash,
      accountId: row.account_id,
      createdAt: Number(row.created_at),
      expiresAt: Number(row.expires_at),
      usedAt: row.used_at === null ? null : Number(row.used_at)
    };
  }

  async markPasswordResetUsed(tokenHash, usedAt) {
    const { rowCount } = await this.#database.query(
      'UPDATE password_resets SET used_at = $1 WHERE token_hash = $2 AND used_at IS NULL',
      [usedAt, tokenHash]
    );
    return rowCount === 1;
  }

  async close() {
    if (this.#ownsDatabase) await this.#database.close();
  }

  /** Nombre o correo repetido según la clave única que saltó. */
  static #takenReason(error) {
    if (error?.code !== PostgresDatabase.UNIQUE_VIOLATION) return null;
    return error.constraint === 'uq_accounts_email' ? 'email-taken' : 'username-taken';
  }

  static #toAccount(row) {
    return {
      id: row.id,
      username: row.username,
      usernameKey: row.username_key,
      email: row.email,
      emailKey: row.email_key,
      credential: row.credential,
      createdAt: Number(row.created_at),
      updatedAt: Number(row.updated_at)
    };
  }
}
