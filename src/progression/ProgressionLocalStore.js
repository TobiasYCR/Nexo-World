import { ProgressionResult } from './ProgressionResult.js';

/**
 * Copia local del progreso y de la identidad del jugador (localStorage o
 * cualquier objeto con la interfaz Storage). Cumple dos funciones: que el
 * progreso sobreviva a recargar la página aunque el servidor no responda, y
 * recordar las credenciales de invitado. No reemplaza a la base de datos: el
 * servidor sigue siendo la fuente de la clasificación.
 *
 * Si el almacenamiento no está disponible (modo privado, tests en Node) guarda
 * en memoria y lo informa con isPersistent = false.
 */
export class ProgressionLocalStore {
  static PREFIX = 'nexo-world:progress:';
  static #IDENTITY_KEY = 'identity';

  #storage;
  #memory = new Map();

  constructor(storage = ProgressionLocalStore.#resolveDefaultStorage()) {
    this.#storage = storage ?? null;
  }

  static #resolveDefaultStorage() {
    try {
      return globalThis.localStorage ?? null;
    } catch {
      return null;
    }
  }

  get isPersistent() {
    return this.#storage !== null;
  }

  /** @returns {{playerId:string, token:string, name:string}|null} */
  loadIdentity() {
    const identity = this.#read(ProgressionLocalStore.#IDENTITY_KEY);
    const valid = identity && typeof identity.playerId === 'string' && typeof identity.token === 'string';
    return valid ? { playerId: identity.playerId, token: identity.token, name: String(identity.name ?? '') } : null;
  }

  saveIdentity(identity) {
    return this.#write(ProgressionLocalStore.#IDENTITY_KEY, identity);
  }

  clearIdentity() {
    this.#remove(ProgressionLocalStore.#IDENTITY_KEY);
  }

  /** @returns {{revision:number, state:object}|null} */
  loadProgress(mode, worldKey) {
    const record = this.#read(`${mode}:${worldKey}`);
    if (!record || !Number.isSafeInteger(record.revision) || record.revision < 0) return null;
    return { revision: record.revision, state: record.state };
  }

  saveProgress(mode, worldKey, revision, state) {
    return this.#write(`${mode}:${worldKey}`, { revision, state });
  }

  #read(key) {
    const fullKey = ProgressionLocalStore.PREFIX + key;
    let raw = this.#memory.get(fullKey) ?? null;
    if (this.#storage) {
      try {
        raw = this.#storage.getItem(fullKey);
      } catch {
        raw = this.#memory.get(fullKey) ?? null;
      }
    }
    if (raw === null || raw === undefined) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  #write(key, value) {
    const fullKey = ProgressionLocalStore.PREFIX + key;
    const json = JSON.stringify(value);
    this.#memory.set(fullKey, json);
    if (!this.#storage) return ProgressionResult.fail(ProgressionResult.Reasons.STORAGE_UNAVAILABLE);
    try {
      this.#storage.setItem(fullKey, json);
      return ProgressionResult.ok();
    } catch (error) {
      return ProgressionResult.fail(ProgressionResult.Reasons.STORAGE_ERROR, { detail: String(error) });
    }
  }

  #remove(key) {
    const fullKey = ProgressionLocalStore.PREFIX + key;
    this.#memory.delete(fullKey);
    try {
      this.#storage?.removeItem(fullKey);
    } catch {
      // Sin almacenamiento no hay nada que borrar.
    }
  }
}
