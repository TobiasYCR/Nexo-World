import { Base64Codec } from '../utils/Base64Codec.js';
import { GameConfig } from '../game/GameConfig.js';

/**
 * Derivación y verificación de contraseñas con PBKDF2 sobre Web Crypto.
 *
 * Por qué PBKDF2 y no un hash simple: SHA-256 a secas se rompe con tablas
 * precalculadas y hardware común. PBKDF2 agrega sal (dos usuarios con la misma
 * contraseña dan hashes distintos) y un costo configurable en iteraciones, que
 * encarece probar contraseñas por fuerza bruta.
 *
 * Por qué PBKDF2 y no bcrypt/scrypt/Argon2: son mejores, pero ninguno viene en
 * Web Crypto. Traerlos obliga a sumar una dependencia o compilar WebAssembly, y
 * el issue pide evitar dependencias innecesarias. PBKDF2-SHA-256 está en el
 * navegador desde siempre y en Node >= 15.
 *
 * LÍMITE IMPORTANTE: esto corre en el navegador, con los datos en
 * localStorage. Protege contra que alguien que lea el almacenamiento obtenga
 * la contraseña en claro (que la persona probablemente reutilice en otros
 * sitios), pero NO impide que ese alguien edite el almacenamiento y se haga
 * pasar por otro usuario. Para eso hace falta un servidor que valide. Está
 * documentado en docs/INVESTIGACION-PERSISTENCIA-USUARIOS.md.
 */
export class PasswordHasher {
  static ALGORITHM = 'PBKDF2-SHA-256';

  #crypto;
  #iterations;
  #saltBytes;
  #keyBytes;

  /**
   * @param {Crypto|null} [cryptoProvider] por defecto el global, si está accesible
   */
  constructor(cryptoProvider = PasswordHasher.#resolveDefaultCrypto(), config = GameConfig.users) {
    this.#crypto = cryptoProvider ?? null;
    this.#iterations = config.PBKDF2_ITERATIONS;
    this.#saltBytes = config.SALT_BYTES;
    this.#keyBytes = config.DERIVED_KEY_BYTES;
  }

  /** En contextos sin HTTPS o muy viejos, crypto existe pero subtle no. */
  static #resolveDefaultCrypto() {
    try {
      return globalThis.crypto?.subtle ? globalThis.crypto : null;
    } catch {
      return null;
    }
  }

  get isAvailable() {
    return Boolean(this.#crypto?.subtle && this.#crypto?.getRandomValues);
  }

  /**
   * Deriva una credencial nueva a partir de una contraseña.
   * @param {string} password
   * @returns {Promise<{algorithm:string, iterations:number, salt:string, hash:string}|null>}
   *          null si el entorno no ofrece Web Crypto
   */
  async derive(password) {
    if (!this.isAvailable) return null;
    const salt = this.#crypto.getRandomValues(new Uint8Array(this.#saltBytes));
    const hash = await this.#deriveBits(password, salt, this.#iterations);
    if (hash === null) return null;
    return {
      algorithm: PasswordHasher.ALGORITHM,
      iterations: this.#iterations,
      salt: Base64Codec.encode(salt),
      hash: Base64Codec.encode(hash)
    };
  }

  /**
   * Verifica una contraseña contra una credencial guardada.
   *
   * Reutiliza la sal y las iteraciones del registro, no las de la
   * configuración actual: si mañana se sube el costo, las cuentas viejas
   * siguen pudiendo iniciar sesión.
   *
   * @param {string} password
   * @param {{algorithm?:string, iterations?:number, salt?:string, hash?:string}} credential
   * @returns {Promise<boolean>}
   */
  async verify(password, credential) {
    if (!this.isAvailable) return false;
    if (credential === null || typeof credential !== 'object') return false;
    if (credential.algorithm !== undefined && credential.algorithm !== PasswordHasher.ALGORITHM) return false;
    if (typeof credential.salt !== 'string' || typeof credential.hash !== 'string') return false;

    const iterations = Number.isInteger(credential.iterations) && credential.iterations > 0
      ? credential.iterations
      : this.#iterations;

    const salt = Base64Codec.decode(credential.salt);
    const expected = Base64Codec.decode(credential.hash);
    if (salt === null || expected === null) return false;

    const actual = await this.#deriveBits(password, salt, iterations);
    if (actual === null) return false;
    return PasswordHasher.#areEqual(actual, expected);
  }

  /** @returns {Promise<Uint8Array|null>} */
  async #deriveBits(password, salt, iterations) {
    try {
      const material = new TextEncoder().encode(String(password));
      const key = await this.#crypto.subtle.importKey('raw', material, 'PBKDF2', false, ['deriveBits']);
      const bits = await this.#crypto.subtle.deriveBits(
        { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
        key,
        this.#keyBytes * 8
      );
      return new Uint8Array(bits);
    } catch {
      // Un fallo de Web Crypto no debe distinguirse de una contraseña mala:
      // quien llama solo sabe que no se pudo verificar.
      return null;
    }
  }

  /**
   * Comparación en tiempo constante.
   *
   * Un `===` sobre los base64 corta en el primer byte distinto, y esa
   * diferencia de tiempo filtra cuántos bytes acertó quien prueba. Acá siempre
   * se recorren todos.
   */
  static #areEqual(a, b) {
    if (a.length !== b.length) return false;
    let diff = 0;
    for (let i = 0; i < a.length; i += 1) diff |= a[i] ^ b[i];
    return diff === 0;
  }
}
