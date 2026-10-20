import { GameConfig } from '../game/GameConfig.js';
import { MathUtils } from '../utils/MathUtils.js';

/**
 * Contorno del bloque apuntado. Solo lee el Block que le pasan por update()
 * (o null si no hay nada apuntado) y lo dibuja como caja sin relleno,
 * levemente más grande que el bloque para no parpadear contra sus caras.
 *
 * No conoce a World ni a Raycast: quien orqueste le pasa
 * blockInteraction.targetedBlock (o equivalente) cada frame.
 */
export class BlockHighlight {
  constructor(config = GameConfig.viewmodel.highlight, blockSize = GameConfig.world.BLOCK_SIZE) {
    this.config = config;
    this.blockSize = blockSize;
    this.targetedBlock = null;
    this.#transition = 0;
  }

  #transition;

  /** @param {{x:number,y:number,z:number}|null} targetedBlock */
  update(targetedBlock) {
    if (!BlockHighlight.#sameBlock(targetedBlock, this.targetedBlock)) {
      this.#transition = targetedBlock ? 0 : this.config.TRANSITION_DURATION;
    }
    this.targetedBlock = targetedBlock;
    if (!targetedBlock) this.#transition = this.config.TRANSITION_DURATION;
  }

  advance(deltaTime) {
    if (this.#transition < this.config.TRANSITION_DURATION) {
      this.#transition = Math.min(
        this.config.TRANSITION_DURATION,
        this.#transition + Math.max(0, deltaTime)
      );
    }
  }

  /** Overlay: se dibuja después del mundo. No usa `camera` pero lo recibe por contrato. */
  draw(p, _camera) {
    if (!this.targetedBlock) return;

    const size = this.blockSize;
    const half = size / 2;
    const expanded = size * (1 + this.config.EXPANSION);
    const { x, y, z } = this.targetedBlock;

    p.push();
    p.noFill();
    const progress = this.config.TRANSITION_DURATION > 0
      ? MathUtils.clamp01(this.#transition / this.config.TRANSITION_DURATION)
      : 1;
    const color = [...this.config.STROKE_COLOR];
    if (color.length > 3) color[3] = Math.round(color[3] * (0.72 + progress * 0.28));
    p.stroke(...color);
    p.strokeWeight(this.config.STROKE_WEIGHT);
    p.translate(x * size + half, y * size + half, z * size + half);
    p.box(expanded);
    p.pop();
  }

  static #sameBlock(first, second) {
    return first === second || (
      first !== null && second !== null &&
      first.x === second.x && first.y === second.y && first.z === second.z
    );
  }
}
