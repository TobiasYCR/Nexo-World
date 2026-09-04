import { GameConfig } from '../game/GameConfig.js';

/**
 * Administración centralizada de texturas: es el único módulo que conoce las
 * rutas de los assets gráficos. El resto del código pide texturas por nombre.
 *
 * Estado actual: la carga está implementada pero no hay archivos PNG en el
 * repositorio, así que get() devuelve null y BlockRenderer usa el color de
 * respaldo de cada BlockType. Al agregar los PNG, el render pasa a texturas sin
 * cambios en otras clases.
 */
export class TextureManager {
  #textures = new Map();
  #loaded = false;

  constructor(p, config = GameConfig.assets) {
    this.p = p;
    this.basePath = config.TEXTURE_BASE_PATH;
  }

  get isLoaded() {
    return this.#loaded;
  }

  get hasTextures() {
    return this.#textures.size > 0;
  }

  /**
   * Carga las texturas indicadas. Los faltantes no rompen el arranque: se
   * registran como ausentes y el render cae en el color del bloque.
   * @param {string[]} names nombres de archivo, ej. ["grass.png"]
   */
  async loadAll(names) {
    const results = await Promise.allSettled(
      names.map((name) => this.#loadOne(name))
    );

    const failed = names.filter((_, index) => results[index].status === 'rejected');
    if (failed.length > 0) {
      console.info(`[TextureManager] Texturas no disponibles todavía: ${failed.join(', ')}`);
    }

    this.#loaded = true;
    return this.#textures;
  }

  #loadOne(name) {
    return new Promise((resolve, reject) => {
      this.p.loadImage(
        `${this.basePath}${name}`,
        (image) => {
          this.#textures.set(name, image);
          resolve(image);
        },
        () => reject(new Error(`No se pudo cargar la textura "${name}".`))
      );
    });
  }

  get(name) {
    return this.#textures.get(name) ?? null;
  }

  has(name) {
    return this.#textures.has(name);
  }
}
