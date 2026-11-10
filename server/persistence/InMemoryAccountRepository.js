import { AccountRepository } from './AccountRepository.js';

/**
 * Cuentas y sesiones en memoria. Sirve para los tests y para STORAGE=memory;
 * se pierde al reiniciar el servidor.
 */
export class InMemoryAccountRepository extends AccountRepository {
  #accounts = new Map();
  #sessions = new Map();
  #resets = new Map();

  async init() {}

  async createAccount(account) {
    for (const existing of this.#accounts.values()) {
      if (existing.usernameKey === account.usernameKey) return { ok: false, reason: 'username-taken' };
      if (existing.emailKey === account.emailKey) return { ok: false, reason: 'email-taken' };
    }
    this.#accounts.set(account.id, structuredClone(account));
    return { ok: true };
  }

  async findAccountById(accountId) {
    return this.#copy(this.#accounts.get(accountId));
  }

  async findAccountByLogin(key) {
    for (const account of this.#accounts.values()) {
      if (account.usernameKey === key || account.emailKey === key) return this.#copy(account);
    }
    return null;
  }

  async updateAccount(accountId, changes) {
    const account = this.#accounts.get(accountId);
    if (!account) return { ok: false, reason: 'not-found' };
    if (changes.usernameKey !== undefined) {
      for (const other of this.#accounts.values()) {
        if (other.id !== accountId && other.usernameKey === changes.usernameKey) return { ok: false, reason: 'username-taken' };
      }
    }
    const defined = Object.fromEntries(Object.entries(changes).filter(([, value]) => value !== undefined));
    this.#accounts.set(accountId, structuredClone({ ...account, ...defined }));
    return { ok: true };
  }

  async createSession(session) {
    this.#sessions.set(session.tokenHash, { ...session });
  }

  async findSession(tokenHash) {
    return this.#copy(this.#sessions.get(tokenHash));
  }

  async deleteSession(tokenHash) {
    this.#sessions.delete(tokenHash);
  }

  async deleteSessionsOfAccount(accountId, exceptTokenHash = null) {
    for (const [tokenHash, session] of this.#sessions) {
      if (session.accountId === accountId && tokenHash !== exceptTokenHash) this.#sessions.delete(tokenHash);
    }
  }

  async deleteExpiredSessions(now) {
    for (const [tokenHash, session] of this.#sessions) {
      if (session.expiresAt <= now) this.#sessions.delete(tokenHash);
    }
  }

  async createPasswordReset(reset) {
    for (const [tokenHash, existing] of this.#resets) {
      if (existing.accountId === reset.accountId && existing.usedAt === null) this.#resets.delete(tokenHash);
    }
    this.#resets.set(reset.tokenHash, { ...reset, usedAt: null });
  }

  async findPasswordReset(tokenHash) {
    return this.#copy(this.#resets.get(tokenHash));
  }

  async markPasswordResetUsed(tokenHash, usedAt) {
    const reset = this.#resets.get(tokenHash);
    if (!reset || reset.usedAt !== null) return false;
    reset.usedAt = usedAt;
    return true;
  }

  #copy(value) {
    return value ? structuredClone(value) : null;
  }
}
