import { GameConfig } from '../game/GameConfig.js';
import { AssetCatalog } from '../utils/AssetCatalog.js';

/**
 * Carga y cachea las texturas de bloque. El resto del código pide por nombre
 * (el que declara BlockType.texture); las URLs las resuelve AssetCatalog.
 *
 * Contrato de fallos: ninguna promesa se rechaza. Una textura ausente resuelve
 * a null y BlockRenderer dibuja el color de respaldo del bloque.
 */
export class TextureManager {
  /** name -> p5.Image cargada. */
  #textures = new Map();
  /** name -> Promise<p5.Image|null>. Deduplica pedidos en vuelo y recuerda faltantes. */
  #requests = new Map();
  #missing = new Set();
  #loaded = false;

  constructor(p, assets = GameConfig.assets) {
    this.p = p;
    this.catalog = AssetCatalog.from(assets);
  }

  get isLoaded() {
    return this.#loaded;
  }

  get hasTextures() {
    return this.#textures.size > 0;
  }

  /** Nombres que fallaron al cargar, para diagnóstico. */
  get missing() {
    return [...this.#missing];
  }

  /**
   * Carga las texturas indicadas, normalmente BlockRegistry.textureNames().
   * @param {string[]} names nombres de archivo, ej. ["grass.png"]
   * @returns {Promise<{loaded:string[], missing:string[]}>}
   */
  async loadAll(names) {
    const unique = [...new Set(names.filter(Boolean))];
    const images = await Promise.all(unique.map((name) => this.load(name)));

    const loaded = unique.filter((_, index) => images[index] !== null);
    const missing = unique.filter((_, index) => images[index] === null);
    if (missing.length > 0) {
      console.warn(`[TextureManager] Sin textura, se usa el color de respaldo: ${missing.join(', ')}`);
    }

    this.#loaded = true;
    return { loaded, missing };
  }

  /** Atajo para cargar exactamente lo que declara el registro de bloques. */
  loadForRegistry(blockRegistry) {
    return this.loadAll(blockRegistry.textureNames());
  }

  /**
   * @param {string} name
   * @returns {Promise<import('p5').Image|null>}
   */
  load(name) {
    if (!this.#requests.has(name)) {
      this.#requests.set(name, this.#request(name));
    }
    return this.#requests.get(name);
  }

  #request(name) {
    return new Promise((resolve) => {
      const onLoad = (image) => {
        this.#applyPixelArtFiltering(image);
        this.#textures.set(name, image);
        this.#missing.delete(name);
        resolve(image);
      };
      const onError = () => {
        this.#missing.add(name);
        resolve(null);
      };

      try {
        this.p.loadImage(this.catalog.textureUrl(name), onLoad, onError);
      } catch {
        onError();
      }
    });
  }

  /**
   * NEAREST en ambos sentidos: sin esto WebGL interpola los texels y el pixel
   * art de 16x16 se ve borroso de cerca. p5 1.x no expone un filtro global,
   * así que se configura sobre el p5.Texture que el renderer asocia a la imagen
   * (el mismo que después usa p.texture()).
   */
  #applyPixelArtFiltering(image) {
    try {
      this.p._renderer?.getTexture?.(image)?.setInterpolation?.(this.p.NEAREST, this.p.NEAREST);
    } catch (error) {
      console.warn('[TextureManager] No se pudo aplicar filtro NEAREST.', error);
    }
  }

  get(name) {
    return this.#textures.get(name) ?? null;
  }

  has(name) {
    return this.#textures.has(name);
  }
}
