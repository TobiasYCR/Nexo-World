import { randomInt } from 'node:crypto';

/**
 * Códigos de recuperación de contraseña para dictar o copiar a mano: 8
 * caracteres sin los que se confunden (0/O, 1/I/L), mostrados como XXXX-XXXX.
 * Son 32^8 combinaciones (~10^12); con el límite de intentos y el vencimiento
 * corto alcanza para un juego sin servidor de correo.
 */
export class ResetCode {
  static ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  static LENGTH = 8;

  static generate() {
    let code = '';
    for (let index = 0; index < ResetCode.LENGTH; index += 1) {
      code += ResetCode.ALPHABET[randomInt(ResetCode.ALPHABET.length)];
    }
    return `${code.slice(0, 4)}-${code.slice(4)}`;
  }

  /** Mayúsculas, sin guiones ni espacios: "abcd efgh" y "ABCD-EFGH" son el mismo código. */
  static normalize(input) {
    return String(input ?? '').toUpperCase().replace(/[\s-]/g, '');
  }
}
