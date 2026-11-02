import { createHash, randomBytes, randomUUID } from 'node:crypto';

/**
 * Credenciales de jugador invitado. El token solo se entrega una vez al
 * registrarse; en la base se guarda su hash SHA-256, así que una filtración de
 * la tabla no permite escribir puntuaciones ajenas.
 */
export class PlayerTokens {
  static TOKEN_BYTES = 32;

  static newPlayerId() {
    return randomUUID();
  }

  static newToken() {
    return randomBytes(PlayerTokens.TOKEN_BYTES).toString('base64url');
  }

  static hash(token) {
    return createHash('sha256').update(token, 'utf8').digest('hex');
  }

  /** Token del encabezado "Authorization: Bearer <token>", o null. */
  static fromAuthorizationHeader(header) {
    if (typeof header !== 'string') return null;
    const match = /^Bearer ([A-Za-z0-9_-]{20,128})$/.exec(header.trim());
    return match ? match[1] : null;
  }
}
