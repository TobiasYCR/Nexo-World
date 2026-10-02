import { LightingManager } from './LightingManager.js';
import { GameConfig } from '../game/GameConfig.js';

/**
 * Orquesta el dibujado de un frame: limpia el fondo, aplica cámara e iluminación
 * y delega la geometría en los renderizadores especializados.
 * No conoce reglas del juego ni modifica el estado del mundo.
 */
export class Renderer {
  constructor(p, blockRenderer, config = GameConfig.rendering) {
    this.p = p;
    this.blockRenderer = blockRenderer;
    this.lighting = new LightingManager(p, config);
    this.backgroundColor = config.BACKGROUND_COLOR;
    this.overlays = new Set();
  }

  /**
   * Registra un overlay que se dibuja después del mundo.
   * @param {{draw: (p: object, camera: object) => void}} overlay
   * @returns {() => boolean} función para retirar el overlay
   */
  addOverlay(overlay) {
    if (typeof overlay?.draw !== 'function') {
      throw new TypeError('Renderer.addOverlay requiere un objeto con draw(p, camera).');
    }
    this.overlays.add(overlay);
    return () => this.overlays.delete(overlay);
  }

  render(world, camera) {
    const p = this.p;
    p.background(...this.backgroundColor);
    camera.applyTo(p);
    this.lighting.apply();
    this.blockRenderer.render(world, camera.position);
    for (const overlay of this.overlays) overlay.draw(p, camera);
  }

  /** Punto de entrada para Configuración: radio en bloques, sin recargar. */
  get renderDistance() {
    return this.blockRenderer.renderDistance;
  }

  setRenderDistance(blocks) {
    return this.blockRenderer.setRenderDistance(blocks);
  }

  get stats() {
    return {
      renderedBlocks: this.blockRenderer.renderedBlocks,
      renderDistance: this.blockRenderer.renderDistance
    };
  }
}
