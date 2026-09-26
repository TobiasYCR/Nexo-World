import { GameConfig } from '../game/GameConfig.js';
import { MathUtils } from '../utils/MathUtils.js';

/**
 * Panel de diagnóstico: FPS, posición, chunk, bloques y estado.
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
    if (!container) return;
    if (!this.element.parentNode) {
      container.appendChild(this.element);
    }
  }

  get isVisible() {
    return !this.element.hidden;
  }

  toggle() {
    this.element.hidden = !this.element.hidden;
  }

  setVisible(visible) {
    this.element.hidden = !visible;
  }

  /**
   * @param {number} deltaTime segundos desde el frame anterior
   * @param {{fps:number, position:{x:number,y:number,z:number}, renderedBlocks:number, state:string}} stats
   */
  update(deltaTime, stats) {
    if (this.element.hidden || !stats) return;

    this.#elapsedSinceRefresh += deltaTime;
    if (this.#elapsedSinceRefresh < this.config.OVERLAY_REFRESH_INTERVAL) return;
    this.#elapsedSinceRefresh = 0;

    const { x, y, z } = stats.position ?? { x: 0, y: 0, z: 0 };
    const blockSize = GameConfig.world.BLOCK_SIZE || 20;
    const chunkSizeX = GameConfig.chunk.SIZE_X || 16;
    const chunkSizeZ = GameConfig.chunk.SIZE_Z || 16;

    const blockX = Math.floor(x / blockSize);
    const blockY = Math.floor(y / blockSize);
    const blockZ = Math.floor(z / blockSize);

    const chunkX = MathUtils.floorDiv(blockX, chunkSizeX);
    const chunkZ = MathUtils.floorDiv(blockZ, chunkSizeZ);

    const targeted = stats.targetedBlock
      ? `[${stats.targetedBlock.x}, ${stats.targetedBlock.y}, ${stats.targetedBlock.z}]`
      : 'Ninguno';

    const selectedSlot = stats.selectedSlot !== undefined
      ? stats.selectedSlot + 1
      : (stats.selectedIndex !== undefined ? stats.selectedIndex + 1 : (stats.hotbar?.selectedIndex !== undefined ? stats.hotbar.selectedIndex + 1 : 1));

    const renderedChunks = stats.renderedChunks !== undefined
      ? stats.renderedChunks
      : (stats.chunksRendered !== undefined ? stats.chunksRendered : (stats.chunkCount ?? 'N/A'));

    this.element.textContent = [
      'Nexo World — F3 para alternar',
      `FPS: ${Math.round(stats.fps ?? 60)}`,
      `Pos: X: ${MathUtils.roundTo(x, 1)} | Y: ${MathUtils.roundTo(y, 1)} | Z: ${MathUtils.roundTo(z, 1)}`,
      `Bloque: [${blockX}, ${blockY}, ${blockZ}]`,
      `Chunk: [${chunkX}, ${chunkZ}]`,
      `Chunks dibujados: ${renderedChunks}`,
      `Bloques renderizados: ${stats.renderedBlocks ?? 0}`,
      `Bloque apuntado: ${targeted}`,
      `Slot seleccionado: ${selectedSlot}`,
      `Estado: ${stats.state ?? 'running'}`
    ].join('\n');
  }
}
