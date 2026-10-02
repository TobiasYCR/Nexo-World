import { GameConfig } from '../game/GameConfig.js';

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
  }

  /** @param {{x:number,y:number,z:number}|null} targetedBlock */
  update(targetedBlock) {
    this.targetedBlock = targetedBlock;
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
    p.stroke(...this.config.STROKE_COLOR);
    p.strokeWeight(this.config.STROKE_WEIGHT);
    p.translate(x * size + half, y * size + half, z * size + half);
    p.box(expanded);
    p.pop();
  }
}
