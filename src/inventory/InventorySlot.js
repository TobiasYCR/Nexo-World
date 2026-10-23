import { GameConfig } from '../game/GameConfig.js';

/**
 * Ranura de inventario: guarda un tipo de bloque y una cantidad.
 * No conoce la UI ni el mundo.
 */
export class InventorySlot {
  constructor(maxStack = GameConfig.inventory.SLOT_MAX_STACK) {
    this.maxStack = maxStack;
    this.blockType = null;
    this.count = 0;
  }

  get isEmpty() {
    return this.blockType === null || this.count === 0;
  }

  get isFull() {
    return this.count >= this.maxStack;
  }

  accepts(blockType) {
    if (this.isEmpty) return true;
    if (this.isFull) return false;
    if (!this.blockType || !blockType) return false;
    return this.blockType === blockType || this.blockType.id === blockType.id;
  }

  /** Agrega unidades y devuelve el sobrante que no entró. */
  add(blockType, amount = 1) {
    if (!this.accepts(blockType)) return amount;
    if (this.isEmpty) this.blockType = blockType;
    const free = this.maxStack - this.count;
    const added = Math.min(free, amount);
    this.count += added;
    return amount - added;
  }

  /** Quita unidades y devuelve cuántas se quitaron efectivamente. */
  remove(amount = 1) {
    const removed = Math.min(this.count, amount);
    this.count -= removed;
    if (this.count === 0) this.blockType = null;
    return removed;
  }

  clear() {
    this.blockType = null;
    this.count = 0;
  }

  set(blockType, amount = 1) {
    this.clear();
    if (blockType && amount > 0) {
      return this.add(blockType, amount);
    }
    return 0;
  }
}
