import { SettingsStorage } from '../storage/SettingsStorage.js';

/**
 * Esquema y valores por defecto inmutables de la configuración avanzada de Nexo World.
 */
export const SETTINGS_SCHEMA = Object.freeze({
  // General
  mouseSensitivity: Object.freeze({
    id: 'mouseSensitivity',
    category: 'general',
    label: 'Sensibilidad del mouse',
    type: 'number',
    default: 1.0,
    min: 0.1,
    max: 3.0,
    step: 0.05,
    formatter: (v) => Number(v).toFixed(2),
    disabled: false
  }),
  fov: Object.freeze({
    id: 'fov',
    category: 'general',
    label: 'Campo de visión (FOV)',
    type: 'number',
    default: 75,
    min: 60,
    max: 110,
    step: 1,
    formatter: (v) => `${Math.round(v)}°`,
    disabled: false
  }),
  masterVolume: Object.freeze({
    id: 'masterVolume',
    category: 'general',
    label: 'Volumen maestro',
    type: 'number',
    default: 70,
    min: 0,
    max: 100,
    step: 5,
    formatter: (v) => `${Math.round(v)}%`,
    disabled: false
  }),
  renderDistance: Object.freeze({
    id: 'renderDistance',
    category: 'general',
    label: 'Distancia de render',
    type: 'number',
    default: 8,
    min: 4,
    max: 16,
    step: 1,
    formatter: (v) => `${v} chunks`,
    disabled: true,
    disabledNote: 'Pendiente Backend 2: hoy es parámetro de construcción del mundo, falta un setter en caliente.'
  }),

  // Gráficos y Efectos
  graphicsPreset: Object.freeze({
    id: 'graphicsPreset',
    category: 'graphics',
    label: 'Calidad visual',
    type: 'string',
    options: ['low', 'medium', 'high', 'custom'],
    labels: { low: 'Baja', medium: 'Media', high: 'Alta', custom: 'Personalizada' },
    default: 'high',
    disabled: false
  }),
  ambientParticles: Object.freeze({
    id: 'ambientParticles',
    category: 'graphics',
    label: 'Partículas ambientales',
    type: 'boolean',
    default: true,
    disabled: false
  }),
  particleDensity: Object.freeze({
    id: 'particleDensity',
    category: 'graphics',
    label: 'Densidad de partículas',
    type: 'number',
    default: 1.0,
    min: 0.1,
    max: 2.0,
    step: 0.1,
    formatter: (v) => `${Math.round(v * 100)}%`,
    disabled: false
  }),
  cameraEffects: Object.freeze({
    id: 'cameraEffects',
    category: 'graphics',
    label: 'Efectos de cámara (balanceo)',
    type: 'boolean',
    default: true,
    disabled: false
  }),
  damageEffects: Object.freeze({
    id: 'damageEffects',
    category: 'graphics',
    label: 'Efectos visuales de daño',
    type: 'boolean',
    default: true,
    disabled: false
  }),
  frustumCulling: Object.freeze({
    id: 'frustumCulling',
    category: 'graphics',
    label: 'Frustum Culling',
    type: 'boolean',
    default: true,
    disabled: true,
    disabledNote: 'Gestionado internamente por el motor de renderizado.'
  }),
  greedyMeshing: Object.freeze({
    id: 'greedyMeshing',
    category: 'graphics',
    label: 'Greedy Meshing',
    type: 'boolean',
    default: false,
    disabled: true,
    disabledNote: 'Optimización de geometría pendiente de integración en el motor.'
  }),

  // Interfaz y HUD
  uiScale: Object.freeze({
    id: 'uiScale',
    category: 'ui',
    label: 'Escala de la interfaz',
    type: 'number',
    default: 1.0,
    min: 0.75,
    max: 1.5,
    step: 0.25,
    formatter: (v) => `${Math.round(v * 100)}%`,
    disabled: false
  }),
  crosshairSize: Object.freeze({
    id: 'crosshairSize',
    category: 'ui',
    label: 'Tamaño de la mira',
    type: 'number',
    default: 20,
    min: 12,
    max: 32,
    step: 2,
    formatter: (v) => `${v}px`,
    disabled: false
  }),
  crosshairOpacity: Object.freeze({
    id: 'crosshairOpacity',
    category: 'ui',
    label: 'Opacidad de la mira',
    type: 'number',
    default: 1.0,
    min: 0.2,
    max: 1.0,
    step: 0.1,
    formatter: (v) => `${Math.round(v * 100)}%`,
    disabled: false
  }),
  showHealthBar: Object.freeze({
    id: 'showHealthBar',
    category: 'ui',
    label: 'Mostrar barra de vida',
    type: 'boolean',
    default: true,
    disabled: false
  }),
  showBlockName: Object.freeze({
    id: 'showBlockName',
    category: 'ui',
    label: 'Mostrar nombre de bloque en hotbar',
    type: 'boolean',
    default: true,
    disabled: false
  }),
  showDebug: Object.freeze({
    id: 'showDebug',
    category: 'ui',
    label: 'Panel de debug (F3)',
    type: 'boolean',
    default: false,
    disabled: false
  }),
  debugUpdateInterval: Object.freeze({
    id: 'debugUpdateInterval',
    category: 'ui',
    label: 'Intervalo de actualización F3',
    type: 'number',
    default: 250,
    min: 50,
    max: 1000,
    step: 50,
    formatter: (v) => `${v} ms`,
    disabled: false
  })
});

export const GRAPHIC_PRESETS = Object.freeze({
  low: {
    ambientParticles: false,
    particleDensity: 0.5,
    cameraEffects: false,
    damageEffects: false
  },
  medium: {
    ambientParticles: true,
    particleDensity: 0.8,
    cameraEffects: true,
    damageEffects: true
  },
  high: {
    ambientParticles: true,
    particleDensity: 1.0,
    cameraEffects: true,
    damageEffects: true
  }
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
    if (meta.type === 'string') {
      if (typeof val !== 'string') return false;
      if (meta.options) return meta.options.includes(val);
      return true;
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

  /**
   * Aplica un preset gráfico completo.
   * @param {'low'|'medium'|'high'} presetName
   */
  setGraphicsPreset(presetName) {
    if (!(presetName in GRAPHIC_PRESETS)) return false;
    const preset = GRAPHIC_PRESETS[presetName];

    for (const [key, val] of Object.entries(preset)) {
      this.#values[key] = val;
      this.#notify(key, val);
    }
    this.#values.graphicsPreset = presetName;
    this.#storage.save(this.#values);
    this.#notify('graphicsPreset', presetName);
    return true;
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

    // Si se modifica una opción gráfica individual manualmente, actualizar preset a 'custom'
    if (key !== 'graphicsPreset' && ['ambientParticles', 'particleDensity', 'cameraEffects', 'damageEffects'].includes(key)) {
      this.#values.graphicsPreset = 'custom';
    }

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
