import { InventorySlot } from './InventorySlot.js';

/**
 * Colección de ranuras con reglas de apilado. Base del inventario completo:
 * por ahora solo cubre agregar, quitar y consultar.
 */
export class Inventory {
  constructor(size) {
    this.slots = Array.from({ length: size }, () => new InventorySlot());
  }

  get size() {
    return this.slots.length;
  }

  getSlot(index) {
    return this.slots[index] ?? null;
  }

  /** Apila primero en ranuras compatibles y recién después ocupa vacías. */
  add(blockType, amount = 1) {
    let remaining = amount;

    for (const slot of this.slots) {
      if (remaining === 0) break;
      if (!slot.isEmpty && slot.accepts(blockType)) remaining = slot.add(blockType, remaining);
    }
    for (const slot of this.slots) {
      if (remaining === 0) break;
      if (slot.isEmpty) remaining = slot.add(blockType, remaining);
    }

    return remaining;
  }

  removeAt(index, amount = 1) {
    return this.getSlot(index)?.remove(amount) ?? 0;
  }

  /**
   * Reemplaza directamente el contenido de una ranura con el bloque y cantidad dados.
   * @param {number} index
   * @param {import('../blocks/BlockType.js').BlockType|null} blockType
   * @param {number} [amount=1]
   * @returns {boolean}
   */
  set(index, blockType, amount = 1) {
    const slot = this.getSlot(index);
    if (!slot) return false;
    slot.set(blockType, amount);
    return true;
  }

  countOf(blockType) {
    if (!blockType) return 0;
    return this.slots.reduce(
      (total, slot) => total + (
        slot.blockType && (slot.blockType === blockType || slot.blockType.id === blockType.id)
          ? slot.count
          : 0
      ),
      0
    );
  }

  clear() {
    for (const slot of this.slots) slot.clear();
  }
}
