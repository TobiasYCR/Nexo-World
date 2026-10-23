import { GameConfig } from '../game/GameConfig.js';

/**
 * Validación de nombres de usuario y contraseñas.
 *
 * Está separada del repositorio porque las reglas son del dominio, no del
 * almacenamiento: si mañana se agrega registro desde otra pantalla, valida con
 * esta misma clase y no reescribe los límites.
 *
 * Devuelve el código de UserResult.Reasons correspondiente, o null si el valor
 * es válido. No arma el resultado: eso lo hace quien valida.
 */
export class UserValidator {
  #rules;

  constructor(rules = GameConfig.users) {
    this.#rules = rules;
  }

  /**
   * @param {unknown} username
   * @returns {'invalid-username'|null}
   */
  checkUsername(username) {
    if (typeof username !== 'string') return 'invalid-username';
    const trimmed = username.trim();
    if (trimmed.length < this.#rules.USERNAME_MIN_LENGTH) return 'invalid-username';
    if (trimmed.length > this.#rules.USERNAME_MAX_LENGTH) return 'invalid-username';
    if (!this.#rules.USERNAME_PATTERN.test(trimmed)) return 'invalid-username';
    return null;
  }

  /**
   * Valida un correo, si viene. Ausente o vacío es válido: el correo es
   * opcional en la capa de datos, aunque la pantalla de registro lo exija.
   *
   * La comprobación es deliberadamente laxa (algo@algo.algo): validar correos
   * con precisión es imposible con una expresión regular, y el único modo real
   * de saber si uno existe es mandarle un mensaje, cosa que sin servidor no se
   * puede hacer.
   *
   * @param {unknown} email
   * @returns {'invalid-email'|null}
   */
  checkEmail(email) {
    if (email === null || email === undefined || email === '') return null;
    if (typeof email !== 'string') return 'invalid-email';
    const limpio = email.trim();
    if (limpio.length === 0) return null;
    if (limpio.length > this.#rules.EMAIL_MAX_LENGTH) return 'invalid-email';
    return this.#rules.EMAIL_PATTERN.test(limpio) ? null : 'invalid-email';
  }

  /**
   * @param {unknown} password
   * @returns {'invalid-password'|null}
   */
  checkPassword(password) {
    if (typeof password !== 'string') return 'invalid-password';
    // No se recorta: los espacios son caracteres válidos dentro de una
    // contraseña y recortarlos cambiaría silenciosamente lo que el usuario puso.
    if (password.length < this.#rules.PASSWORD_MIN_LENGTH) return 'invalid-password';
    if (password.length > this.#rules.PASSWORD_MAX_LENGTH) return 'invalid-password';
    return null;
  }
}
