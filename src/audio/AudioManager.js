import { GameConfig } from '../game/GameConfig.js';
import { AssetCatalog } from '../utils/AssetCatalog.js';
import { AudioCategories } from '../utils/Constants.js';
import { MathUtils } from '../utils/MathUtils.js';

/**
 * Audio del juego sobre la Web Audio API nativa (sin p5.sound).
 *
 * Ruteo: voz -> ganancia de categoría (sfx/music/ambient) -> maestro -> salida.
 *
 * Autoplay: el navegador no deja arrancar un AudioContext sin gesto del
 * usuario. Por eso la carga está partida en dos:
 *   - preload(): descarga los bytes apenas arranca el juego (no necesita contexto);
 *   - unlock(): en el primer gesto crea el contexto y decodifica lo descargado.
 *
 * Contrato de fallos: ningún método lanza ni devuelve promesas rechazadas. Un
 * archivo ausente o indecodificable deja ese sonido mudo.
 */
export class AudioManager {
  /** Defaults propios mientras GameConfig no tenga sección `audio`. */
  static DEFAULT_VOLUMES = Object.freeze({
    master: 1,
    [AudioCategories.SFX]: 1,
    [AudioCategories.MUSIC]: 0.6,
    [AudioCategories.AMBIENT]: 0.8
  });

  #context = null;
  #masterGain = null;
  #categoryGains = new Map();
  #unlockPromise = null;

  /** soundId -> Promise<ArrayBuffer|null> con los bytes descargados. */
  #downloads = new Map();
  /** soundId -> Promise<AudioBuffer|null>. */
  #decodes = new Map();
  /** soundId -> AudioBuffer listo para sonar. */
  #buffers = new Map();

  #masterVolume;
  #categoryVolumes = new Map();

  /**
   * @param {object} [assets] GameConfig.assets o un AssetCatalog
   * @param {object} [options]
   * @param {object} [options.volumes] volúmenes iniciales (0..1) por `master` y categoría
   * @param {Function} [options.fetch] inyectable para tests
   * @param {Function} [options.createContext] fábrica de AudioContext, inyectable para tests
   */
  constructor(assets = GameConfig.assets, options = {}) {
    this.catalog = AssetCatalog.from(assets);
    this.fetch = options.fetch ?? globalThis.fetch?.bind(globalThis) ?? null;
    this.createContext = options.createContext ?? AudioManager.#createBrowserContext;

    const volumes = {
      ...AudioManager.DEFAULT_VOLUMES,
      ...AudioManager.#volumesFromConfig(GameConfig.audio),
      ...(options.volumes ?? {})
    };
    this.#masterVolume = MathUtils.clamp01(volumes.master, 1);
    for (const category of Object.values(AudioCategories)) {
      this.#categoryVolumes.set(category, MathUtils.clamp01(volumes[category], 1));
    }
  }

  /**
   * Lee la futura sección GameConfig.audio (MASTER_VOLUME, SFX_VOLUME,
   * MUSIC_VOLUME, AMBIENT_VOLUME). Claves ausentes no pisan los defaults.
   */
  static #volumesFromConfig(audioConfig) {
    if (!audioConfig) return {};
    const volumes = {};
    if (audioConfig.MASTER_VOLUME !== undefined) volumes.master = audioConfig.MASTER_VOLUME;
    for (const category of Object.values(AudioCategories)) {
      const key = `${category.toUpperCase()}_VOLUME`;
      if (audioConfig[key] !== undefined) volumes[category] = audioConfig[key];
    }
    return volumes;
  }

  static #createBrowserContext() {
    const ContextClass = globalThis.AudioContext ?? globalThis.webkitAudioContext;
    return ContextClass ? new ContextClass() : null;
  }

  get isReady() {
    return this.#context !== null && this.#context.state === 'running';
  }

  // ---------------------------------------------------------------- carga

  /**
   * Descarga los bytes de los sonidos (por defecto, todo el catálogo). Se puede
   * llamar antes de cualquier gesto del usuario. Si el contexto ya existe,
   * decodifica en cuanto llegan.
   * @param {string[]} [soundIds]
   * @returns {Promise<{downloaded:string[], missing:string[]}>}
   */
  async preload(soundIds = this.catalog.soundIds()) {
    const results = await Promise.all(soundIds.map((soundId) => this.#download(soundId)));
    const downloaded = soundIds.filter((_, index) => results[index] !== null);
    const missing = soundIds.filter((_, index) => results[index] === null);
    if (missing.length > 0) {
      console.warn(`[AudioManager] Sonidos no disponibles, quedan mudos: ${missing.join(', ')}`);
    }
    if (this.#context) await Promise.all(downloaded.map((soundId) => this.#decode(soundId)));
    return { downloaded, missing };
  }

  #download(soundId) {
    if (!this.#downloads.has(soundId)) {
      this.#downloads.set(soundId, this.#fetchBytes(this.catalog.soundUrl(soundId)));
    }
    return this.#downloads.get(soundId);
  }

  async #fetchBytes(url) {
    if (!url || !this.fetch) return null;
    try {
      const response = await this.fetch(url);
      return response.ok ? await response.arrayBuffer() : null;
    } catch {
      return null;
    }
  }

  #decode(soundId) {
    if (!this.#decodes.has(soundId)) {
      this.#decodes.set(soundId, this.#decodeDownloaded(soundId));
    }
    return this.#decodes.get(soundId);
  }

  async #decodeDownloaded(soundId) {
    const bytes = await this.#download(soundId);
    if (!bytes || !this.#context) return null;
    try {
      // decodeAudioData desacopla el ArrayBuffer: se decodifica una copia para
      // no invalidar los bytes descargados.
      const buffer = await this.#context.decodeAudioData(bytes.slice(0));
      this.#buffers.set(soundId, buffer);
      return buffer;
    } catch {
      console.warn(`[AudioManager] No se pudo decodificar "${soundId}".`);
      return null;
    }
  }

  // ------------------------------------------------------------ contexto

  /**
   * Crea y reanuda el AudioContext. Debe invocarse desde un gesto del usuario
   * (clic o tecla). Idempotente: los llamados repetidos comparten la promesa.
   * @returns {Promise<boolean>} true si el audio quedó activo
   */
  unlock() {
    this.#unlockPromise ??= this.#startContext();
    return this.#unlockPromise.then(async (started) => {
      if (!started) {
        this.#unlockPromise = null;
        return false;
      }
      try {
        if (this.#context.state === 'suspended') await this.#context.resume();
      } catch {
        return false;
      }
      return this.isReady;
    });
  }

  async #startContext() {
    try {
      this.#context = this.createContext();
    } catch {
      this.#context = null;
    }
    if (!this.#context) return false;

    this.#buildGraph();
    // Si nadie llamó a preload(), se descarga el catálogo ahora.
    if (this.#downloads.size === 0) this.catalog.soundIds().forEach((soundId) => this.#download(soundId));
    await Promise.all([...this.#downloads.keys()].map((soundId) => this.#decode(soundId)));
    return true;
  }

  #buildGraph() {
    const context = this.#context;
    this.#masterGain = context.createGain();
    this.#masterGain.gain.value = this.#masterVolume;
    this.#masterGain.connect(context.destination);

    for (const [category, volume] of this.#categoryVolumes) {
      const gain = context.createGain();
      gain.gain.value = volume;
      gain.connect(this.#masterGain);
      this.#categoryGains.set(category, gain);
    }
  }

  // ------------------------------------------------------------ volumen

  get masterVolume() {
    return this.#masterVolume;
  }

  /** @param {number} volume 0..1. Se puede llamar antes del unlock. */
  setMasterVolume(volume) {
    this.#masterVolume = MathUtils.clamp01(volume, this.#masterVolume);
    if (this.#masterGain) this.#masterGain.gain.value = this.#masterVolume;
    return this.#masterVolume;
  }

  getCategoryVolume(category) {
    return this.#categoryVolumes.get(category) ?? null;
  }

  /** @returns {boolean} false si la categoría no existe */
  setCategoryVolume(category, volume) {
    if (!this.#categoryVolumes.has(category)) return false;
    const value = MathUtils.clamp01(volume, this.#categoryVolumes.get(category));
    this.#categoryVolumes.set(category, value);
    const gain = this.#categoryGains.get(category);
    if (gain) gain.gain.value = value;
    return true;
  }

  // -------------------------------------------------------- reproducción

  /**
   * @param {string} soundId ver SoundIds
   * @param {{category?:string, volume?:number, loop?:boolean}} [options]
   * @returns {AudioBufferSourceNode|null} null si el sonido no está listo o no existe
   */
  play(soundId, { category = this.catalog.soundCategory(soundId), volume = 1, loop = false } = {}) {
    const buffer = this.#buffers.get(soundId);
    const categoryGain = this.#categoryGains.get(category);
    if (!buffer || !categoryGain || !this.isReady) return null;

    try {
      const source = this.#context.createBufferSource();
      source.buffer = buffer;
      source.loop = loop;

      const voiceGain = this.#context.createGain();
      voiceGain.gain.value = MathUtils.clamp01(volume, 1);
      source.connect(voiceGain);
      voiceGain.connect(categoryGain);
      source.onended = () => voiceGain.disconnect();
      source.start();
      return source;
    } catch {
      return null;
    }
  }

  isLoaded(soundId) {
    return this.#buffers.has(soundId);
  }
}
