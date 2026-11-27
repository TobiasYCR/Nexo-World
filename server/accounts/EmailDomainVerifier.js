import { resolveMx as dnsResolveMx } from 'node:dns/promises';

/**
 * Dominios y TLDs reservados para pruebas o documentación (RFC 2606 y RFC 6761).
 * Se rechazan sin consultar DNS porque algunos entornos locales los resuelven.
 */
const RESERVED_TLDS = new Set(['test', 'invalid', 'localhost', 'local', 'example']);
const RESERVED_DOMAINS = new Set(['localhost', 'example.com', 'example.net', 'example.org']);

/** Códigos DNS que confirman que el dominio no existe o no tiene registros MX. */
const DEFINITIVE_DNS_ERRORS = new Set(['ENOTFOUND', 'ENODATA', 'NOTFOUND', 'NODATA']);

/**
 * Verifica mediante DNS (registros MX) que el dominio de un correo electrónico
 * exista y esté configurado para recibir correos.
 *
 * Incluye caché en memoria con TTL para evitar consultas repetidas sobre
 * proveedores frecuentes (gmail.com, outlook.com, etc.) y un límite de tiempo
 * para que un servidor DNS lento no trabe el registro.
 */
export class EmailDomainVerifier {
  static DEFAULT_TIMEOUT_MS = 3000;
  static DEFAULT_VALID_TTL_MS = 10 * 60 * 1000;
  static DEFAULT_INVALID_TTL_MS = 60 * 1000;
  static DEFAULT_MAX_CACHE_SIZE = 500;

  #resolveMx;
  #timeoutMs;
  #validTtlMs;
  #invalidTtlMs;
  #maxCacheSize;
  #clock;
  #enabled;
  #logger;
  #cache = new Map();

  /**
   * @param {{
   *   resolveMx?: (domain: string) => Promise<Array<{exchange?: string, priority?: number}>>,
   *   timeoutMs?: number,
   *   validTtlMs?: number,
   *   invalidTtlMs?: number,
   *   maxCacheSize?: number,
   *   clock?: () => number,
   *   enabled?: boolean,
   *   logger?: {error?: Function, warn?: Function}
   * }} [options]
   */
  constructor({
    resolveMx = dnsResolveMx,
    timeoutMs = EmailDomainVerifier.DEFAULT_TIMEOUT_MS,
    validTtlMs = EmailDomainVerifier.DEFAULT_VALID_TTL_MS,
    invalidTtlMs = EmailDomainVerifier.DEFAULT_INVALID_TTL_MS,
    maxCacheSize = EmailDomainVerifier.DEFAULT_MAX_CACHE_SIZE,
    clock = Date.now,
    enabled = true,
    logger = console
  } = {}) {
    this.#resolveMx = resolveMx;
    this.#timeoutMs = timeoutMs;
    this.#validTtlMs = validTtlMs;
    this.#invalidTtlMs = invalidTtlMs;
    this.#maxCacheSize = maxCacheSize;
    this.#clock = clock;
    this.#enabled = enabled;
    this.#logger = logger;
  }

  /**
   * Comprueba si el dominio del correo tiene registros MX reales.
   * @param {string} email
   * @returns {Promise<null|'invalid-email-domain'|'email-verification-unavailable'>}
   *   null si el dominio es válido (o la verificación está desactivada)
   */
  async verify(email) {
    if (!this.#enabled) return null;

    const domain = EmailDomainVerifier.#extractDomain(email);
    if (!domain || EmailDomainVerifier.#isReserved(domain)) {
      return 'invalid-email-domain';
    }

    const now = this.#clock();
    const cached = this.#readCache(domain, now);
    if (cached !== undefined) {
      return cached ? null : 'invalid-email-domain';
    }

    try {
      const records = await this.#lookupMxWithTimeout(domain);
      const hasValidMx = Array.isArray(records) && records.some(EmailDomainVerifier.#isValidMxRecord);
      this.#writeCache(domain, hasValidMx, now);
      return hasValidMx ? null : 'invalid-email-domain';
    } catch (error) {
      if (DEFINITIVE_DNS_ERRORS.has(error?.code)) {
        this.#writeCache(domain, false, now);
        return 'invalid-email-domain';
      }
      this.#logger?.warn?.(`[accounts] no se pudo verificar DNS MX para "${domain}":`, error?.code ?? error?.message);
      return 'email-verification-unavailable';
    }
  }

  clearCache() {
    this.#cache.clear();
  }

  async #lookupMxWithTimeout(domain) {
    let timer = null;
    const timeout = new Promise((_, reject) => {
      timer = setTimeout(() => {
        const error = new Error(`DNS MX timeout (${this.#timeoutMs}ms)`);
        error.code = 'ETIMEOUT';
        reject(error);
      }, this.#timeoutMs);
      // No impedir el cierre del proceso si el timer queda pendiente.
      timer.unref?.();
    });

    try {
      return await Promise.race([this.#resolveMx(domain), timeout]);
    } finally {
      if (timer !== null) clearTimeout(timer);
    }
  }

  #readCache(domain, now) {
    const entry = this.#cache.get(domain);
    if (!entry) return undefined;
    if (entry.expiresAt <= now) {
      this.#cache.delete(domain);
      return undefined;
    }
    return entry.valid;
  }

  #writeCache(domain, valid, now) {
    if (this.#maxCacheSize <= 0) return;
    const ttl = valid ? this.#validTtlMs : this.#invalidTtlMs;
    if (ttl <= 0) return;

    if (this.#cache.size >= this.#maxCacheSize && !this.#cache.has(domain)) {
      const oldestKey = this.#cache.keys().next().value;
      if (oldestKey !== undefined) this.#cache.delete(oldestKey);
    }
    this.#cache.set(domain, { valid, expiresAt: now + ttl });
  }

  static #extractDomain(email) {
    if (typeof email !== 'string') return '';
    const trimmed = email.trim().toLowerCase();
    const at = trimmed.lastIndexOf('@');
    if (at <= 0 || at === trimmed.length - 1) return '';
    return trimmed.slice(at + 1);
  }

  static #isReserved(domain) {
    if (RESERVED_DOMAINS.has(domain)) return true;
    const parts = domain.split('.');
    const tld = parts[parts.length - 1];
    if (RESERVED_TLDS.has(tld)) return true;
    for (const reserved of RESERVED_DOMAINS) {
      if (domain.endsWith(`.${reserved}`)) return true;
    }
    return false;
  }

  /**
   * Un registro MX con exchange vacío o "." es un Null MX (RFC 7505):
   * declara explícitamente que el dominio no acepta correos.
   */
  static #isValidMxRecord(record) {
    if (!record || typeof record.exchange !== 'string') return false;
    const exchange = record.exchange.trim();
    return exchange.length > 0 && exchange !== '.';
  }
}
