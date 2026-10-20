import { GameConfig } from '../game/GameConfig.js';
import { MathUtils } from '../utils/MathUtils.js';

/**
 * Panel de diagnóstico avanzado F3:
 * Métricas de rendimiento, datos del jugador y parámetros del mundo.
 * Se refresca con frecuencia limitada y evita mutaciones de DOM redundantes.
 */
export class DebugOverlay {
  #elapsedSinceRefresh = 0;
  #lastContent = '';
  #refreshInterval = 0.25;

  constructor(config = GameConfig.debug) {
    this.config = config;
    this.#refreshInterval = config?.OVERLAY_REFRESH_INTERVAL ?? 0.25;

    this.element = document.createElement('div');
    this.element.className = 'hud-debug';
    this.element.setAttribute('aria-label', 'Panel de diagnóstico');
    this.element.hidden = !config?.SHOW_OVERLAY_ON_START;
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

  setUpdateInterval(intervalSeconds) {
    if (typeof intervalSeconds === 'number' && intervalSeconds > 0) {
      this.#refreshInterval = intervalSeconds;
    }
  }

  /**
   * Actualiza el panel F3 si transcurrió el intervalo configurado.
   * @param {number} deltaTime
   * @param {Object} [stats]
   */
  update(deltaTime, stats) {
    if (this.element.hidden || !stats) return;

    this.#elapsedSinceRefresh += deltaTime;
    if (this.#elapsedSinceRefresh < this.#refreshInterval) return;
    this.#elapsedSinceRefresh = 0;

    const fps = Math.round(stats.fps ?? 60);
    const frameTimeMs = stats.fps && stats.fps > 0 ? (1000 / stats.fps).toFixed(1) : '16.6';

    const { x, y, z } = stats.position ?? { x: 0, y: 0, z: 0 };
    const blockSize = GameConfig.world?.BLOCK_SIZE || 20;
    const chunkSizeX = GameConfig.chunk?.SIZE_X || 16;
    const chunkSizeZ = GameConfig.chunk?.SIZE_Z || 16;

    const blockX = Math.floor(x / blockSize);
    const blockY = Math.floor(y / blockSize);
    const blockZ = Math.floor(z / blockSize);

    const chunkX = MathUtils.floorDiv(blockX, chunkSizeX);
    const chunkZ = MathUtils.floorDiv(blockZ, chunkSizeZ);

    // Dirección cardinal aproximada si está disponible
    let facing = 'N/D';
    if (stats.cameraLookDirection) {
      const { x: lx, z: lz } = stats.cameraLookDirection;
      if (Math.abs(lx) > Math.abs(lz)) {
        facing = lx > 0 ? '+X (Este)' : '-X (Oeste)';
      } else {
        facing = lz > 0 ? '+Z (Sur)' : '-Z (Norte)';
      }
    }

    // Bloque apuntado
    let targetedInfo = 'Ninguno';
    if (stats.targetedBlock) {
      const tb = stats.targetedBlock;
      const bName = tb.blockType?.label || tb.blockType?.name || `ID ${tb.blockType?.id || tb.blockId || '?'}`;
      targetedInfo = `${bName} en [${tb.x ?? tb.blockX}, ${tb.y ?? tb.blockY}, ${tb.z ?? tb.blockZ}]`;
    }

    const worldWidth = GameConfig.world?.WIDTH ?? 64;
    const worldHeight = GameConfig.world?.HEIGHT ?? 32;
    const worldDepth = GameConfig.world?.DEPTH ?? 64;
    const renderDist = GameConfig.rendering?.RENDER_DISTANCE_CHUNKS ?? 8;

    const lines = [
      '=== NEXO WORLD — F3 (Diagnóstico) ===',
      `[Rendimiento]`,
      `  FPS: ${fps} | Tiempo frame: ${frameTimeMs} ms`,
      `  Bloques renderizados: ${stats.renderedBlocks ?? 0}`,
      `  Caras visibles: ${stats.visibleFaces ?? 'N/D'} | Draw calls: ${stats.drawCalls ?? 'N/D'}`,
      `  Chunks descartados: ${stats.culledChunks ?? 'N/D'} | Reconstrucciones: ${stats.meshRebuilds ?? 'N/D'}`,
      `[Jugador]`,
      `  XYZ: ${MathUtils.roundTo(x, 2)} / ${MathUtils.roundTo(y, 2)} / ${MathUtils.roundTo(z, 2)}`,
      `  Bloque: [${blockX}, ${blockY}, ${blockZ}] | Chunk: [${chunkX}, ${chunkZ}]`,
      `  En suelo: ${stats.onGround ? 'Sí' : 'No'} | Mirando hacia: ${facing}`,
      `  Bloque apuntado: ${targetedInfo}`,
      `  Slot seleccionado: ${typeof stats.selectedSlot === 'number' ? stats.selectedSlot + 1 : 'N/D'}`,
      `[Mundo]`,
      `  Semilla: ${stats.seed ?? 'N/D'} | Bioma: ${stats.biome ?? 'Plains'}`,
      `  Dimensiones: ${worldWidth}x${worldHeight}x${worldDepth} | Distancia render: ${renderDist} chunks`,
      `  Estado juego: ${stats.state ?? 'running'}`
    ];

    const newContent = lines.join('\n');
    if (newContent !== this.#lastContent) {
      this.#lastContent = newContent;
      this.element.textContent = newContent;
    }
  }
}
