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
    const chunk = this.#computeChunk(x, z);

    this.element.textContent = [
      'Nexo World — F3 para ocultar',
      `FPS: ${Math.round(stats.fps)}`,
      `X: ${MathUtils.roundTo(x, 1)}`,
      `Y: ${MathUtils.roundTo(y, 1)}`,
      `Z: ${MathUtils.roundTo(z, 1)}`,
      `Chunk: ${chunk.x}, ${chunk.z}`,
      `Bloques dibujados: ${stats.renderedBlocks}`,
      `Estado: ${stats.state}`
    ].join('\n');
  }

  /**
   * Deriva el chunk actual a partir de la posición del jugador, usando los
   * mismos valores de GameConfig que World usa internamente. No consulta a
   * World ni a ningún otro sistema: es matemática pura sobre datos ya dados.
   */
  #computeChunk(worldX, worldZ) {
    const { BLOCK_SIZE } = GameConfig.world;
    const { SIZE_X, SIZE_Z } = GameConfig.chunk;
    const blockX = MathUtils.floorDiv(worldX, BLOCK_SIZE);
    const blockZ = MathUtils.floorDiv(worldZ, BLOCK_SIZE);
    return {
      x: MathUtils.floorDiv(blockX, SIZE_X),
      z: MathUtils.floorDiv(blockZ, SIZE_Z)
    };
  }
}
