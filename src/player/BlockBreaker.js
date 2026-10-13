import { GameConfig } from '../game/GameConfig.js';

/**
 * Estado y reglas de minado progresivo. Recibe el bloque apuntado cada frame y
 * devuelve cuando ya se completo el tiempo necesario para romperlo.
 */
export class BlockBreaker {
  #elapsed = 0;

  constructor(world, config = GameConfig) {
    this.world = world;
    this.config = config;
    this.breakingBlock = null;
    this.breakProgress = 0;
  }

  update(block, deltaTime, isHeld) {
    const type = block ? this.world.getBlockType(block.x, block.y, block.z) : null;
    if (!isHeld || !block || !type?.isBreakable) {
      this.reset();
      return false;
    }

    if (!this.#sameBlock(this.breakingBlock, block)) {
      this.reset();
      this.breakingBlock = { x: block.x, y: block.y, z: block.z };
    }

    this.#elapsed += deltaTime;
    const secondsPerHardness = this.config.blocks.BREAK_TIME_PER_HARDNESS
      ?? this.config.viewmodel.breakOverlay.BREAK_DURATION_PER_HARDNESS;
    const duration = Math.max(Number.EPSILON, type.hardness * secondsPerHardness);
    this.breakProgress = Math.min(1, this.#elapsed / duration);
    return this.breakProgress >= 1;
  }

  reset() {
    this.breakingBlock = null;
    this.breakProgress = 0;
    this.#elapsed = 0;
  }

  #sameBlock(first, second) {
    return first === second || (
      first !== null &&
      second !== null &&
      first.x === second.x &&
      first.y === second.y &&
      first.z === second.z
    );
  }
}
