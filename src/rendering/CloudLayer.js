import { GameConfig } from '../game/GameConfig.js';

/**
 * Nubes: un único cuadrado horizontal sobre el mundo, con una textura que se
 * repite. Sigue a la cámara pero las coordenadas de textura salen de la
 * posición en el mundo, así las nubes quedan fijas en el cielo (no "caminan"
 * con el jugador) y solo se mueven con el viento. Es una sola llamada de
 * dibujo y no tiene geometría propia: es solo textura.
 */
export class CloudLayer {
  #texture = null;
  #windOffset = 0;

  /**
   * @param {object} p instancia de p5
   * @param {object} [config] GameConfig.rendering.CLOUDS
   * @param {object} [options]
   * @param {number} [options.blockSize]
   * @param {number} [options.worldHeight] alto del mundo en bloques
   */
  constructor(p, config = GameConfig.rendering.CLOUDS, { blockSize = GameConfig.world.BLOCK_SIZE, worldHeight = GameConfig.world.WORLD_HEIGHT } = {}) {
    this.p = p;
    this.config = config;
    this.blockSize = blockSize;
    this.enabled = Boolean(config?.ENABLED);
    this.altitude = (worldHeight + (config?.HEIGHT_ABOVE_WORLD ?? 14)) * blockSize;
  }

  /** Carga la textura con el TextureManager del juego; sin textura no se dibuja nada. */
  async load(textureManager, url = GameConfig.assets.CLOUD_TEXTURE) {
    this.#texture = await textureManager?.load?.('sky:clouds', url) ?? null;
    return this.#texture !== null;
  }

  setTexture(texture) {
    this.#texture = texture;
  }

  setEnabled(enabled) {
    this.enabled = Boolean(enabled);
  }

  get windOffset() {
    return this.#windOffset;
  }

  /** @param {number} deltaTime segundos */
  update(deltaTime) {
    const tile = this.config.TILE_BLOCKS * this.blockSize;
    this.#windOffset = (this.#windOffset + this.config.WIND_BLOCKS_PER_SECOND * this.blockSize * Math.max(0, deltaTime)) % tile;
  }

  /**
   * @param {{x:number, z:number}} viewer posición de la cámara
   * @returns {boolean} true si se dibujó
   */
  draw(viewer) {
    const p = this.p;
    if (!this.enabled || !this.#texture || typeof p?.beginShape !== 'function') return false;
    const radius = this.config.RADIUS_BLOCKS * this.blockSize;
    const tile = this.config.TILE_BLOCKS * this.blockSize;
    const y = this.altitude;
    const minX = viewer.x - radius;
    const maxX = viewer.x + radius;
    const minZ = viewer.z - radius;
    const maxZ = viewer.z + radius;
    const u = (x) => (x + this.#windOffset) / tile;
    const v = (z) => z / tile;

    p.push();
    // Sin luces: las nubes no tienen sombra propia, son blancas desde abajo y desde arriba.
    p.noLights?.();
    p.noStroke?.();
    p.textureMode?.(p.NORMAL);
    p.textureWrap?.(p.REPEAT);
    p.texture(this.#texture);
    p.beginShape(p.QUADS ?? 0);
    p.vertex(minX, y, minZ, u(minX), v(minZ));
    p.vertex(maxX, y, minZ, u(maxX), v(minZ));
    p.vertex(maxX, y, maxZ, u(maxX), v(maxZ));
    p.vertex(minX, y, maxZ, u(minX), v(maxZ));
    p.endShape();
    p.pop();
    return true;
  }
}
