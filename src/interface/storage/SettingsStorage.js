/**
 * Capa de almacenamiento y persistencia para la configuración de Nexo World.
 * Tolerante a fallos: usa localStorage si está disponible y degrada a memoria si
 * el almacenamiento local está restringido o lanza excepciones (ej. modo privado o tests en Node).
 */
export class SettingsStorage {
  static STORAGE_KEY = 'nexo_world_settings_v1';

  #memoryStore = {};
  #isLocalStorageAvailable = false;

  constructor(key = SettingsStorage.STORAGE_KEY) {
    this.key = key;
    this.#checkAvailability();
  }

  #checkAvailability() {
    try {
      if (typeof globalThis !== 'undefined' && globalThis.localStorage) {
        const testKey = '__storage_test__';
        globalThis.localStorage.setItem(testKey, testKey);
        globalThis.localStorage.removeItem(testKey);
        this.#isLocalStorageAvailable = true;
      }
    } catch (_) {
      this.#isLocalStorageAvailable = false;
    }
  }

  /**
   * Carga los datos almacenados de forma segura.
   * Si los datos están corruptos o no se pueden parsear, devuelve un objeto vacío.
   * @returns {Object}
   */
  load() {
    if (this.#isLocalStorageAvailable) {
      try {
        const raw = globalThis.localStorage.getItem(this.key);
        if (!raw) return { ...this.#memoryStore };
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          return { ...this.#memoryStore, ...parsed };
        }
      } catch (err) {
        console.warn('[SettingsStorage] Error al leer localStorage, usando fallback:', err);
      }
    }
    return { ...this.#memoryStore };
  }

  /**
   * Guarda los datos en almacenamiento persistente o en memoria.
   * @param {Object} data
   * @returns {boolean} True si se guardó correctamente.
   */
  save(data) {
    if (!data || typeof data !== 'object') return false;

    this.#memoryStore = { ...data };

    if (this.#isLocalStorageAvailable) {
      try {
        globalThis.localStorage.setItem(this.key, JSON.stringify(data));
        return true;
      } catch (err) {
        console.warn('[SettingsStorage] Error al escribir en localStorage:', err);
      }
    }
    return true;
  }

  /**
   * Borra los datos almacenados.
   */
  clear() {
    this.#memoryStore = {};
    if (this.#isLocalStorageAvailable) {
      try {
        globalThis.localStorage.removeItem(this.key);
      } catch (_) {}
    }
  }
}
