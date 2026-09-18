import { SaveResult } from './SaveResult.js';

/**
 * Estado persistente del jugador. Versionado aparte del mundo: puede crecer
 * (inventario, orientación) sin invalidar los mundos guardados.
 */
export class PlayerSerializer {
  static FORMAT_VERSION = 1;

  serialize(player) {
    const { x, y, z } = player.position;
    return { version: PlayerSerializer.FORMAT_VERSION, position: { x, y, z } };
  }

  /** Valida sin tocar al jugador. */
  decode(data) {
    const { Reasons } = SaveResult;
    if (data === null || typeof data !== 'object') return SaveResult.fail(Reasons.CORRUPT_PLAYER, 'player no es un objeto');
    if (data.version !== PlayerSerializer.FORMAT_VERSION) {
      return SaveResult.fail(Reasons.INCOMPATIBLE_VERSION, `formato de jugador v${data.version}, se esperaba v${PlayerSerializer.FORMAT_VERSION}`);
    }
    const position = data.position;
    if (!position || ![position.x, position.y, position.z].every(Number.isFinite)) {
      return SaveResult.fail(Reasons.CORRUPT_PLAYER, 'posición inválida');
    }
    return SaveResult.ok({ position: { x: position.x, y: position.y, z: position.z } });
  }

  apply(player, decoded) {
    const { x, y, z } = decoded.position;
    player.teleportTo(x, y, z);
    return player;
  }
}
