import { AudioCategories, SoundIds } from './Constants.js';

/**
 * Catálogo único de assets: el único lugar que sabe dónde vive cada archivo.
 * Las clases de recursos piden por nombre lógico y reciben una URL.
 *
 * Recibe las bases por parámetro (GameConfig.assets) para que utils no dependa
 * de game. Vite publica /assets en la raíz del servidor (publicDir), por eso las
 * URLs no llevan el prefijo "assets/".
 */
export class AssetCatalog {
  /** Sonidos conocidos: ruta relativa a la base de audio y categoría de mezcla. */
  static SOUNDS = Object.freeze({
    [SoundIds.BLOCK_PLACE]: Object.freeze({ path: 'sfx/block_place.wav', category: AudioCategories.SFX }),
    [SoundIds.BLOCK_BREAK]: Object.freeze({ path: 'sfx/block_break.wav', category: AudioCategories.SFX })
  });

  constructor(assetsConfig, sounds = AssetCatalog.SOUNDS) {
    this.textureBasePath = AssetCatalog.#withTrailingSlash(assetsConfig.TEXTURE_BASE_PATH);
    this.audioBasePath = AssetCatalog.#withTrailingSlash(assetsConfig.AUDIO_BASE_PATH);
    this.sounds = sounds;
  }

  /** Acepta un catálogo ya armado o la sección `assets` de la configuración. */
  static from(source) {
    return source instanceof AssetCatalog ? source : new AssetCatalog(source);
  }

  /** @param {string} fileName nombre declarado en BlockType.texture, ej. "grass.png" */
  textureUrl(fileName) {
    return `${this.textureBasePath}${fileName}`;
  }

  soundUrl(soundId) {
    const entry = this.sounds[soundId];
    return entry ? `${this.audioBasePath}${entry.path}` : null;
  }

  soundCategory(soundId) {
    return this.sounds[soundId]?.category ?? AudioCategories.SFX;
  }

  soundIds() {
    return Object.keys(this.sounds);
  }

  static #withTrailingSlash(path) {
    return path.endsWith('/') ? path : `${path}/`;
  }
}
