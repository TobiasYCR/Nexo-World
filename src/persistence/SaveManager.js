import { WorldSerializer } from './WorldSerializer.js';

/**
 * Guardado y carga de partidas. Encapsula el medio de almacenamiento para que
 * cambiarlo (localStorage -> IndexedDB o backend) no afecte al resto del juego.
 *
 * Estado actual: base arquitectónica; solo persiste el mundo.
 */
export class SaveManager {
  static STORAGE_PREFIX = 'nexo-world:save:';

  constructor(storage = globalThis.localStorage, serializer = new WorldSerializer()) {
    this.storage = storage;
    this.serializer = serializer;
  }

  get isAvailable() {
    return Boolean(this.storage);
  }

  #keyFor(slotName) {
    return `${SaveManager.STORAGE_PREFIX}${slotName}`;
  }

  save(slotName, world) {
    if (!this.isAvailable) return false;
    const payload = { savedAt: Date.now(), world: this.serializer.serialize(world) };
    this.storage.setItem(this.#keyFor(slotName), JSON.stringify(payload));
    return true;
  }

  load(slotName, world) {
    if (!this.isAvailable) return false;
    const raw = this.storage.getItem(this.#keyFor(slotName));
    if (!raw) return false;
    this.serializer.deserialize(world, JSON.parse(raw).world);
    return true;
  }

  exists(slotName) {
    return this.isAvailable && this.storage.getItem(this.#keyFor(slotName)) !== null;
  }

  delete(slotName) {
    this.storage?.removeItem(this.#keyFor(slotName));
  }
}
