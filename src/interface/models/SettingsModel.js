import { SettingsStorage } from '../storage/SettingsStorage.js';

/**
 * Esquema y valores por defecto inmutables de la configuración.
 */
export const SETTINGS_SCHEMA = Object.freeze({
  mouseSensitivity: Object.freeze({
    id: 'mouseSensitivity',
    label: 'Sensibilidad del mouse',
    type: 'number',
    default: 1.0,
    min: 0.1,
    max: 3.0,
    step: 0.05,
    formatter: (v) => Number(v).toFixed(2),
    disabled: false
  }),
  renderDistance: Object.freeze({
    id: 'renderDistance',
    label: 'Distancia de render',
    type: 'number',
    default: 8,
    min: 4,
    max: 16,
    step: 1,
    formatter: (v) => `${v} chunks`,
    disabled: false
  }),
  masterVolume: Object.freeze({
    id: 'masterVolume',
    label: 'Volumen maestro',
    type: 'number',
    default: 70,
    min: 0,
    max: 100,
    step: 5,
    formatter: (v) => `${Math.round(v)}%`,
    disabled: false
  }),
  fov: Object.freeze({
    id: 'fov',
    label: 'Campo de visión (FOV)',
    type: 'number',
    default: 70,
    min: 60,
    max: 110,
    step: 1,
    formatter: (v) => `${Math.round(v)}°`,
    disabled: false
  }),
  showDebug: Object.freeze({
    id: 'showDebug',
    label: 'Panel de debug',
    type: 'boolean',
    default: false,
    disabled: false
  })
});

/**
 * Modelo de configuración del usuario.
 * Administra las opciones, valida tipos/límites, notifica cambios y persiste el estado.
 */
export class SettingsModel {
  #values = {};
  #listeners = new Set();
  #storage;

  /**
   * @param {SettingsStorage} [storage]
   */
  constructor(storage = new SettingsStorage()) {
    this.#storage = storage;
    this.#loadAndValidate();
  }

  get schema() {
    return SETTINGS_SCHEMA;
  }

  #loadAndValidate() {
    const raw = this.#storage.load();
    this.#values = {};

    for (const [key, meta] of Object.entries(SETTINGS_SCHEMA)) {
      if (key in raw && this.#isValidValue(meta, raw[key])) {
        this.#values[key] = raw[key];
      } else {
        this.#values[key] = meta.default;
      }
    }
  }

  #isValidValue(meta, val) {
    if (meta.type === 'number') {
      if (typeof val !== 'number' || Number.isNaN(val)) return false;
      return val >= meta.min && val <= meta.max;
    }
    if (meta.type === 'boolean') {
      return typeof val === 'boolean';
    }
    return false;
  }

  get(key) {
    if (key in this.#values) {
      return this.#values[key];
    }
    return SETTINGS_SCHEMA[key]?.default;
  }

  getAll() {
    return { ...this.#values };
  }

  set(key, value) {
    const meta = SETTINGS_SCHEMA[key];
    if (!meta) {
      console.warn(`[SettingsModel] Clave de ajuste desconocida: "${key}"`);
      return false;
    }

    if (!this.#isValidValue(meta, value)) {
      console.warn(`[SettingsModel] Valor inválido para "${key}":`, value);
      return false;
    }

    const previous = this.#values[key];
    if (previous === value) return true;

    this.#values[key] = value;
    this.#storage.save(this.#values);
    this.#notify(key, value, previous);
    return true;
  }

  resetToDefaults() {
    const previous = { ...this.#values };
    for (const [key, meta] of Object.entries(SETTINGS_SCHEMA)) {
      this.#values[key] = meta.default;
    }
    this.#storage.save(this.#values);

    for (const [key, meta] of Object.entries(SETTINGS_SCHEMA)) {
      if (previous[key] !== meta.default) {
        this.#notify(key, meta.default, previous[key]);
      }
    }
  }

  subscribe(listener) {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  #notify(key, value, previous) {
    for (const listener of this.#listeners) {
      try {
        listener(key, value, previous);
      } catch (err) {
        console.error('[SettingsModel] Error en suscriptor:', err);
      }
    }
  }
}
