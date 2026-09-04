import { GameConfig } from '../game/GameConfig.js';
import { MathUtils } from '../utils/MathUtils.js';

/**
 * Panel de diagnóstico: FPS y posición del jugador.
 * Se refresca a intervalos en vez de cada frame para no ensuciar la medición
 * con escrituras al DOM.
 */
export class DebugOverlay {
  #elapsedSinceRefresh = 0;

  constructor(config = GameConfig.debug) {
    this.config = config;
    this.element = document.createElement('div');
    this.element.className = 'hud-debug';
    this.element.hidden = !config.SHOW_OVERLAY_ON_START;
  }

  mount(container) {
    container.appendChild(this.element);
  }

  get isVisible() {
    return !this.element.hidden;
  }

  toggle() {
    this.element.hidden = !this.element.hidden;
  }

  /**
   * @param {number} deltaTime segundos desde el frame anterior
   * @param {{fps:number, position:{x:number,y:number,z:number}, renderedBlocks:number, state:string}} stats
   */
  update(deltaTime, stats) {
    if (this.element.hidden) return;

    this.#elapsedSinceRefresh += deltaTime;
    if (this.#elapsedSinceRefresh < this.config.OVERLAY_REFRESH_INTERVAL) return;
    this.#elapsedSinceRefresh = 0;

    const { x, y, z } = stats.position;
    this.element.textContent = [
      'Nexo World — F3 para ocultar',
      `FPS: ${Math.round(stats.fps)}`,
      `X: ${MathUtils.roundTo(x, 1)}`,
      `Y: ${MathUtils.roundTo(y, 1)}`,
      `Z: ${MathUtils.roundTo(z, 1)}`,
      `Bloques dibujados: ${stats.renderedBlocks}`,
      `Estado: ${stats.state}`
    ].join('\n');
  }
}
