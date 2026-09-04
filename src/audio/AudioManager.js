import { GameConfig } from '../game/GameConfig.js';

/**
 * Punto único de acceso al audio, construido sobre la Web Audio API nativa
 * (sin dependencias extra). Centraliza rutas, volúmenes por categoría y el
 * desbloqueo del contexto, que los navegadores exigen tras un gesto del usuario.
 *
 * Estado actual: registro, carga y reproducción básicas. No hay assets de audio
 * en el repositorio todavía, así que las llamadas son inocuas.
 */
export class AudioManager {
  #context = null;
  #buffers = new Map();
  #categoryGains = new Map();

  constructor(config = GameConfig.assets) {
    this.basePath = config.AUDIO_BASE_PATH;
    this.masterVolume = 1;
  }

  get isReady() {
    return this.#context !== null && this.#context.state === 'running';
  }

  /** Debe invocarse desde un gesto del usuario (clic o tecla). */
  async unlock() {
    this.#context ??= new (window.AudioContext ?? window.webkitAudioContext)();
    if (this.#context.state === 'suspended') await this.#context.resume();
    return this.#context;
  }

  #gainFor(category) {
    if (!this.#categoryGains.has(category)) {
      const gain = this.#context.createGain();
      gain.connect(this.#context.destination);
      this.#categoryGains.set(category, gain);
    }
    return this.#categoryGains.get(category);
  }

  setCategoryVolume(category, volume) {
    if (!this.#context) return;
    this.#gainFor(category).gain.value = volume;
  }

  /**
   * @param {string} name identificador lógico, ej. "footstep"
   * @param {string} path ruta relativa a AUDIO_BASE_PATH, ej. "sfx/footstep.mp3"
   */
  async load(name, path) {
    await this.unlock();
    const response = await fetch(`${this.basePath}${path}`);
    if (!response.ok) throw new Error(`No se pudo cargar el audio "${path}".`);
    const buffer = await this.#context.decodeAudioData(await response.arrayBuffer());
    this.#buffers.set(name, buffer);
    return buffer;
  }

  play(name, { category = 'sfx', volume = 1, loop = false } = {}) {
    const buffer = this.#buffers.get(name);
    if (!buffer || !this.isReady) return null;

    const source = this.#context.createBufferSource();
    source.buffer = buffer;
    source.loop = loop;

    const gain = this.#context.createGain();
    gain.gain.value = volume * this.masterVolume;
    source.connect(gain).connect(this.#gainFor(category));
    source.start();
    return source;
  }
}
