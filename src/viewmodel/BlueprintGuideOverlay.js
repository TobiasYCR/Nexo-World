import { GameConfig } from '../game/GameConfig.js';

/**
 * Overlay 3D para los Desafíos de Construcción Guiada (Modo Educativo).
 * Dibuja las cajas guía (wireframe) de los bloques pendientes del plano activo
 * y destaca con mayor grosor y pulso la posición exacta del próximo bloque (`nextBlock`).
 */
export class BlueprintGuideOverlay {
  #challengeManager;
  #blockSize;
  #elapsed = 0;

  /**
   * @param {import('../education/BuildChallengeManager.js').BuildChallengeManager} challengeManager
   * @param {number} [blockSize]
   */
  constructor(challengeManager, blockSize = GameConfig.world.BLOCK_SIZE) {
    this.#challengeManager = challengeManager;
    this.#blockSize = blockSize;
  }

  update(deltaTime = 0) {
    if (typeof deltaTime === 'number' && deltaTime > 0) {
      this.#elapsed += deltaTime;
    }
  }

  /**
   * Dibuja las guías del plano activo después de renderizar el mundo.
   * @param {object} p instancia de p5
   * @param {object} _camera
   */
  draw(p, _camera) {
    const active = this.#challengeManager?.activeChallenge?.();
    if (!active || active.completed || !Array.isArray(active.pendingPositions)) return;

    const size = this.#blockSize;
    const half = size / 2;
    const pulse = 0.5 + 0.5 * Math.sin(this.#elapsed * 5);

    // Mostrar hasta 16 bloques pendientes cercanos para mantener claridad visual
    const maxVisibleGuides = 16;
    const list = active.pendingPositions.slice(0, maxVisibleGuides);

    for (const item of list) {
      p.push();
      p.noFill();

      if (item.isNext) {
        // El próximo bloque a colocar se resalta en verde esmeralda / dorado brillante
        const alpha = Math.round(180 + pulse * 75);
        p.stroke(52, 211, 153, alpha);
        p.strokeWeight(2.4);
        p.translate(item.x * size + half, item.y * size + half, item.z * size + half);
        p.box(size * (1.02 + pulse * 0.02));
      } else {
        // El resto del plano pendiente se muestra como guía sutil celeste
        p.stroke(56, 189, 248, 85);
        p.strokeWeight(1.0);
        p.translate(item.x * size + half, item.y * size + half, item.z * size + half);
        p.box(size * 0.98);
      }

      p.pop();
    }
  }
}

