/**
 * Límite de intentos fallidos de inicio de sesión por usuario o correo.
 * Frena la prueba de contraseñas a mano o con un script contra una cuenta.
 *
 * Vive en memoria: alcanza para un único servidor y se reinicia con él.
 */
export class LoginThrottle {
  #attempts = new Map();

  /**
   * @param {{maxFailures?:number, windowMs?:number}} [options]
   */
  constructor({ maxFailures = 10, windowMs = 15 * 60 * 1000 } = {}) {
    this.maxFailures = maxFailures;
    this.windowMs = windowMs;
  }

  /** Segundos que faltan para poder volver a intentar, o 0 si no está bloqueado. */
  retryAfterSeconds(key, now) {
    const entry = this.#current(key, now);
    if (!entry || entry.failures < this.maxFailures) return 0;
    return Math.max(1, Math.ceil((entry.startedAt + this.windowMs - now) / 1000));
  }

  recordFailure(key, now) {
    const entry = this.#current(key, now) ?? { failures: 0, startedAt: now };
    entry.failures += 1;
    this.#attempts.set(key, entry);
  }

  reset(key) {
    this.#attempts.delete(key);
  }

  #current(key, now) {
    const entry = this.#attempts.get(key);
    if (!entry) return null;
    if (now - entry.startedAt >= this.windowMs) {
      this.#attempts.delete(key);
      return null;
    }
    return entry;
  }
}
