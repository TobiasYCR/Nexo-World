import { Screen } from '../../ui/Screen.js';
import { ScreenType } from '../../ui/ScreenType.js';
import { IntentBus } from '../../ui/IntentBus.js';
import { Modal } from '../components/Modal.js';
import { Button } from '../components/Button.js';
import { InventoryView } from '../../ui/InventoryView.js';
import { createDefaultBlockRegistry } from '../../blocks/BlockRegistry.js';

/**
 * Pantalla de Inventario Creativo Avanzado.
 * Presenta el catálogo completo de bloques registrados clasificados por categorías,
 * buscador interactivo, previsualización de texturas, metadatos e inserción en hotbar.
 */
export class InventoryScreen extends Screen {
  /**
   * @param {import('../../blocks/BlockRegistry.js').BlockRegistry} [blockRegistry]
   * @param {import('../../ui/ScreenManager.js').ScreenManager} [screenManager]
   * @param {IntentBus} [intentBus]
   */
  constructor(blockRegistry = null, screenManager = null, intentBus = null) {
    super(ScreenType.INVENTORY, screenManager, intentBus);
    this.blockRegistry = blockRegistry || createDefaultBlockRegistry();
    this.#buildDOM();
  }

  #buildDOM() {
    this.element.className = 'screen screen-inventory nx-modal-backdrop';

    this.modal = new Modal({
      title: 'Inventario Creativo',
      className: 'nx-inventory-dialog',
      onClose: () => this.handleBack()
    });

    this.inventoryView = new InventoryView({
      blockRegistry: this.blockRegistry,
      onSelect: (block) => this.#onBlockSelected(block)
    });

    this.modal.addBodyItem(this.inventoryView.element);

    this.backBtn = new Button({
      text: 'VOLVER AL JUEGO',
      variant: 'primary',
      id: 'inventory-btn-back',
      onClick: () => this.handleBack()
    });

    this.modal.addFooterItem(this.backBtn);
    this.element.appendChild(this.modal.element);
  }

  #onBlockSelected(block) {
    if (this.intentBus) {
      this.intentBus.emit(IntentBus.Events.SET_HOTBAR_BLOCK, {
        blockType: block,
        count: 64
      });
    }
  }

  /**
   * Selecciona un bloque por índice o referencia (para compatibilidad de tests).
   */
  selectIndex(index) {
    const placeable = this.blockRegistry.placeableTypes();
    if (placeable[index]) {
      this.inventoryView.selectBlock(placeable[index]);
    }
  }

  handleBack() {
    if (this.screenManager) {
      this.screenManager.back();
    }
  }

  show(params = {}) {
    super.show(params);
    this.inventoryView.refresh();
    setTimeout(() => {
      this.inventoryView.focus();
    }, 50);
  }
}
