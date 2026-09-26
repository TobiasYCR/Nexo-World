import { Inventory } from './Inventory.js';
import { MathUtils } from '../utils/MathUtils.js';
import { GameConfig } from '../game/GameConfig.js';

/**
 * Barra de acceso rápido: un inventario chico con una ranura seleccionada.
 * Extiende Inventory porque comparte exactamente las reglas de apilado.
 */
export class Hotbar extends Inventory {
  #selectedIndex = 0;

  constructor(size = GameConfig.inventory.HOTBAR_SIZE) {
    super(size);
  }

  get selectedIndex() {
    return this.#selectedIndex;
  }

  get selectedSlot() {
    return this.getSlot(this.#selectedIndex);
  }

  get selectedBlockType() {
    return this.selectedSlot?.blockType ?? null;
  }

  select(index) {
    this.#selectedIndex = MathUtils.clamp(index, 0, this.size - 1);
  }

  /**
   * Carga o actualiza una ranura específica del hotbar.
   * @param {number} index
   * @param {import('../blocks/BlockType.js').BlockType|null} blockType
   * @param {number} [count]
   */
  setSlot(index, blockType, count = GameConfig.inventory.SLOT_MAX_STACK) {
    const slot = this.getSlot(index);
    if (!slot) return;

    if (!blockType || count <= 0) {
      slot.clear();
      return;
    }

    slot.blockType = blockType;
    slot.count = MathUtils.clamp(count, 1, slot.maxStack);
  }

  /** Selección cíclica, pensada para la rueda del mouse. */
  cycle(offset) {
    this.#selectedIndex = MathUtils.mod(this.#selectedIndex + offset, this.size);
  }
}
