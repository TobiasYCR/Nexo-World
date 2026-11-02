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
  static #ACCOUNT_IDENTITY_KEY = 'account-identity';

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

  /**
   * Jugador de la cuenta con la sesión iniciada: su id y el token de sesión,
   * que el servidor también acepta para guardar progreso.
   * @returns {{playerId:string, token:string, name:string}|null}
   */
  loadAccountIdentity() {
    const identity = this.#read(ProgressionLocalStore.#ACCOUNT_IDENTITY_KEY);
    const valid = identity && typeof identity.playerId === 'string' && typeof identity.token === 'string';
    return valid ? { playerId: identity.playerId, token: identity.token, name: String(identity.name ?? '') } : null;
  }

  saveAccountIdentity(identity) {
    return this.#write(ProgressionLocalStore.#ACCOUNT_IDENTITY_KEY, identity);
  }

  clearAccountIdentity() {
    this.#remove(ProgressionLocalStore.#ACCOUNT_IDENTITY_KEY);
  }

  /**
   * @param {string|null} [scope] jugador de una cuenta; null para el invitado
   *   (así el progreso de cada cuenta queda separado del de quien juega sin sesión)
   * @returns {{revision:number, state:object}|null}
   */
  loadProgress(mode, worldKey, scope = null) {
    const record = this.#read(ProgressionLocalStore.#progressKey(mode, worldKey, scope));
    if (!record || !Number.isSafeInteger(record.revision) || record.revision < 0) return null;
    return { revision: record.revision, state: record.state };
  }

  saveProgress(mode, worldKey, revision, state, scope = null) {
    return this.#write(ProgressionLocalStore.#progressKey(mode, worldKey, scope), { revision, state });
  }

  /** La clave sin cuenta es la de siempre: el progreso guardado antes de este cambio se sigue leyendo. */
  static #progressKey(mode, worldKey, scope) {
    return scope ? `account:${scope}:${mode}:${worldKey}` : `${mode}:${worldKey}`;
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
