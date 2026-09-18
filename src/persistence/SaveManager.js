import { WorldSerializer } from './WorldSerializer.js';
import { PlayerSerializer } from './PlayerSerializer.js';
import { SaveResult } from './SaveResult.js';

/**
 * Guardado y carga de partidas sobre localStorage (o cualquier objeto con la
 * interfaz Storage). Ningún método lanza: todos devuelven un SaveResult.
 *
 * Estructura guardada (sobre, versionado por separado de su contenido):
 *   { format, saveVersion, savedAt, world: {version:...}, player: {version:...}|null }
 */
export class SaveManager {
  static STORAGE_PREFIX = 'nexo-world:save:';
  static FORMAT_ID = 'nexo-world-save';
  static SAVE_VERSION = 1;
  static #PROBE_KEY = 'nexo-world:probe';

  #storage;

  /**
   * @param {Storage|null} [storage] por defecto window.localStorage, si está accesible
   */
  constructor(
    storage = SaveManager.#resolveDefaultStorage(),
    worldSerializer = new WorldSerializer(),
    playerSerializer = new PlayerSerializer()
  ) {
    this.#storage = storage ?? null;
    this.worldSerializer = worldSerializer;
    this.playerSerializer = playerSerializer;
  }

  /** En modo privado o con cookies bloqueadas, el solo acceso a localStorage lanza. */
  static #resolveDefaultStorage() {
    try {
      return globalThis.localStorage ?? null;
    } catch {
      return null;
    }
  }

  /** Prueba real de escritura: algunos navegadores exponen localStorage pero rechazan setItem. */
  get isAvailable() {
    if (!this.#storage) return false;
    try {
      this.#storage.setItem(SaveManager.#PROBE_KEY, '1');
      this.#storage.removeItem(SaveManager.#PROBE_KEY);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * @param {string} slotName
   * @param {import('../world/World.js').World} world
   * @param {import('../player/Player.js').Player|null} [player]
   * @returns {{ok:boolean, reason:string|null, message:string|null, bytes?:number}}
   */
  save(slotName, world, player = null) {
    const { Reasons } = SaveResult;
    if (!SaveManager.#isValidSlot(slotName)) return SaveResult.fail(Reasons.INVALID_SLOT);
    if (!this.#storage) return SaveResult.fail(Reasons.STORAGE_UNAVAILABLE);

    let json;
    try {
      json = JSON.stringify({
        format: SaveManager.FORMAT_ID,
        saveVersion: SaveManager.SAVE_VERSION,
        savedAt: Date.now(),
        world: this.worldSerializer.serialize(world),
        player: player ? this.playerSerializer.serialize(player) : null
      });
    } catch (error) {
      return SaveResult.fail(Reasons.WRITE_FAILED, String(error));
    }

    try {
      this.#storage.setItem(SaveManager.#keyFor(slotName), json);
    } catch (error) {
      return SaveResult.fail(SaveManager.#reasonForWriteError(error), String(error));
    }
    return SaveResult.ok({ bytes: json.length });
  }

  /**
   * Lee, valida y decodifica todo antes de modificar mundo o jugador.
   * @returns {{ok:boolean, reason:string|null, message:string|null, savedAt?:number}}
   */
  load(slotName, world, player = null) {
    const { Reasons } = SaveResult;
    if (!SaveManager.#isValidSlot(slotName)) return SaveResult.fail(Reasons.INVALID_SLOT);
    if (!this.#storage) return SaveResult.fail(Reasons.STORAGE_UNAVAILABLE);

    let raw;
    try {
      raw = this.#storage.getItem(SaveManager.#keyFor(slotName));
    } catch (error) {
      return SaveResult.fail(Reasons.STORAGE_UNAVAILABLE, String(error));
    }
    if (raw === null || raw === undefined) return SaveResult.fail(Reasons.NOT_FOUND);

    let envelope;
    try {
      envelope = JSON.parse(raw);
    } catch (error) {
      return SaveResult.fail(Reasons.CORRUPT_DATA, `JSON inválido: ${error.message}`);
    }
    if (envelope === null || typeof envelope !== 'object' || envelope.format !== SaveManager.FORMAT_ID) {
      return SaveResult.fail(Reasons.CORRUPT_DATA, 'no es un guardado de Nexo World');
    }
    if (envelope.saveVersion !== SaveManager.SAVE_VERSION) {
      return SaveResult.fail(Reasons.INCOMPATIBLE_VERSION, `guardado v${envelope.saveVersion}, se esperaba v${SaveManager.SAVE_VERSION}`);
    }

    const decodedWorld = this.worldSerializer.decode(world, envelope.world);
    if (!decodedWorld.ok) return decodedWorld;

    let decodedPlayer = null;
    if (player && envelope.player != null) {
      decodedPlayer = this.playerSerializer.decode(envelope.player);
      if (!decodedPlayer.ok) return decodedPlayer;
    }

    // A partir de acá no hay validaciones pendientes: el estado se reemplaza completo.
    this.worldSerializer.apply(world, decodedWorld.chunks);
    if (decodedPlayer) this.playerSerializer.apply(player, decodedPlayer);
    return SaveResult.ok({ savedAt: envelope.savedAt ?? null });
  }

  exists(slotName) {
    if (!SaveManager.#isValidSlot(slotName) || !this.#storage) return false;
    try {
      return this.#storage.getItem(SaveManager.#keyFor(slotName)) !== null;
    } catch {
      return false;
    }
  }

  delete(slotName) {
    const { Reasons } = SaveResult;
    if (!SaveManager.#isValidSlot(slotName)) return SaveResult.fail(Reasons.INVALID_SLOT);
    if (!this.#storage) return SaveResult.fail(Reasons.STORAGE_UNAVAILABLE);
    try {
      this.#storage.removeItem(SaveManager.#keyFor(slotName));
      return SaveResult.ok();
    } catch (error) {
      return SaveResult.fail(Reasons.STORAGE_UNAVAILABLE, String(error));
    }
  }

  static #keyFor(slotName) {
    return `${SaveManager.STORAGE_PREFIX}${slotName}`;
  }

  static #isValidSlot(slotName) {
    return typeof slotName === 'string' && slotName.length > 0;
  }

  /**
   * Cuota llena: el nombre del error varía por navegador (QuotaExceededError,
   * NS_ERROR_DOM_QUOTA_REACHED en Firefox viejo; códigos 22 y 1014).
   */
  static #reasonForWriteError(error) {
    const { Reasons } = SaveResult;
    const name = error?.name ?? '';
    const code = error?.code;
    if (name === 'QuotaExceededError' || name === 'NS_ERROR_DOM_QUOTA_REACHED' || code === 22 || code === 1014) {
      return Reasons.QUOTA_EXCEEDED;
    }
    if (name === 'SecurityError') return Reasons.STORAGE_UNAVAILABLE;
    return Reasons.WRITE_FAILED;
  }
}
