import { Screen } from '../../ui/Screen.js';
import { ScreenType } from '../../ui/ScreenType.js';
import { IntentBus } from '../../ui/IntentBus.js';
import { Modal } from '../components/Modal.js';
import { Button } from '../components/Button.js';
import { createDefaultBlockRegistry } from '../../blocks/BlockRegistry.js';

/**
 * Catálogo expandido de bloques para demostración visual completa del inventario (Mockup 3).
 */
const EXTENDED_BLOCK_CATALOG = [
  { id: 1, name: 'Pasto', color: [106, 170, 80] },
  { id: 2, name: 'Tierra', color: [134, 96, 67] },
  { id: 3, name: 'Piedra', color: [128, 128, 132] },
  { id: 4, name: 'Madera', color: [168, 114, 52] },
  { id: 5, name: 'Tablones', color: [198, 148, 80] },
  { id: 6, name: 'Hojas', color: [84, 150, 52] },
  { id: 7, name: 'Agua', color: [54, 118, 206] },
  { id: 8, name: 'Lava', color: [222, 92, 28] },
  { id: 9, name: 'Vidrio', color: [186, 226, 240] },
  { id: 10, name: 'Hierro', color: [224, 224, 228] },
  { id: 11, name: 'Oro', color: [238, 186, 48] },
  { id: 12, name: 'Carbón', color: [48, 48, 48] },
  { id: 13, name: 'Ladrillo', color: [176, 78, 56] },
  { id: 14, name: 'Nieve', color: [240, 244, 248] },
  { id: 15, name: 'Hielo', color: [164, 214, 236] },
  { id: 16, name: 'Arcilla', color: [156, 166, 178] },
  { id: 17, name: 'Obsidiana', color: [32, 24, 44] }
];

/**
 * Pantalla de Inventario.
 * Presenta una grilla accesible de bloques disponibles, con selección interactiva,
 * navegación con flechas de teclado y reflejo en el hotbar.
 */
export class InventoryScreen extends Screen {
  #selectedIndex = 0;
  #cards = [];
  #columns = 6;

  /**
   * @param {import('../../blocks/BlockRegistry.js').BlockRegistry} [blockRegistry]
   * @param {import('../../ui/ScreenManager.js').ScreenManager} [screenManager]
   * @param {IntentBus} [intentBus]
   */
  constructor(blockRegistry = null, screenManager = null, intentBus = null) {
    super(ScreenType.INVENTORY, screenManager, intentBus);
    this.blockRegistry = blockRegistry || createDefaultBlockRegistry();
    this.blocks = this.#prepareBlocks();
    this.#buildDOM();
  }

  #prepareBlocks() {
    const registryBlocks = this.blockRegistry.placeableTypes ? this.blockRegistry.placeableTypes() : [];
    const blockMap = new Map();

    for (const b of EXTENDED_BLOCK_CATALOG) {
      blockMap.set(b.id, b);
    }
    for (const b of registryBlocks) {
      blockMap.set(b.id, {
        id: b.id,
        name: b.name,
        color: b.color || [200, 200, 200],
        texture: b.texture
      });
    }

    return Array.from(blockMap.values());
  }

  #buildDOM() {
    this.element.className = 'screen screen-inventory nx-modal-backdrop';

    this.modal = new Modal({
      title: 'Inventario',
      className: 'nx-inventory-dialog',
      onClose: () => this.handleBack()
    });

    this.gridElem = document.createElement('div');
    this.gridElem.className = 'nx-inventory-grid';
    this.gridElem.setAttribute?.('role', 'radiogroup');
    this.gridElem.setAttribute?.('aria-label', 'Selección de bloque');

    this.#cards = [];

    this.blocks.forEach((block, index) => {
      const card = document.createElement('div');
      card.className = `nx-block-card ${index === this.#selectedIndex ? 'is-selected' : ''}`;
      card.setAttribute?.('role', 'radio');
      card.setAttribute?.('aria-checked', String(index === this.#selectedIndex));
      card.setAttribute?.('aria-label', block.name);
      card.tabIndex = index === this.#selectedIndex ? 0 : -1;
      if (card.dataset) card.dataset.index = String(index);

      // Muestra de color / textura
      const swatch = document.createElement('div');
      swatch.className = 'nx-block-swatch';
      const rgb = block.color ?? [180, 180, 180];
      if (swatch.style) {
        swatch.style.backgroundColor = `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;
      }

      // Etiqueta del bloque
      const label = document.createElement('span');
      label.className = 'nx-block-name';
      label.textContent = block.name;

      card.appendChild(swatch);
      card.appendChild(label);

      card.addEventListener('click', () => {
        this.selectIndex(index);
      });

      card.addEventListener('keydown', (e) => {
        this.#handleCardKey(e, index);
      });

      this.gridElem.appendChild(card);
      this.#cards.push(card);
    });

    this.modal.addBodyItem(this.gridElem);

    this.backBtn = new Button({
      text: 'VOLVER',
      variant: 'primary',
      id: 'inventory-btn-back',
      onClick: () => this.handleBack()
    });

    this.modal.addFooterItem(this.backBtn);
    this.element.appendChild(this.modal.element);
  }

  selectIndex(index) {
    if (index < 0 || index >= this.blocks.length) return;

    this.#selectedIndex = index;
    const selectedBlock = this.blocks[index];

    this.#cards.forEach((card, idx) => {
      const isCur = idx === index;
      if (card.classList?.toggle) {
        card.classList.toggle('is-selected', isCur);
      } else {
        card.className = `nx-block-card ${isCur ? 'is-selected' : ''}`;
      }
      card.setAttribute?.('aria-checked', String(isCur));
      card.tabIndex = isCur ? 0 : -1;
      if (isCur) card.focus?.();
    });

    if (this.intentBus) {
      this.intentBus.emit(IntentBus.Events.SET_HOTBAR_BLOCK, {
        blockType: selectedBlock
      });
    }
  }

  #handleCardKey(e, currentIndex) {
    let nextIndex = currentIndex;
    const total = this.blocks.length;

    switch (e.key) {
      case 'ArrowRight':
        nextIndex = (currentIndex + 1) % total;
        e.preventDefault();
        break;
      case 'ArrowLeft':
        nextIndex = (currentIndex - 1 + total) % total;
        e.preventDefault();
        break;
      case 'ArrowDown':
        if (currentIndex + this.#columns < total) {
          nextIndex = currentIndex + this.#columns;
        }
        e.preventDefault();
        break;
      case 'ArrowUp':
        if (currentIndex - this.#columns >= 0) {
          nextIndex = currentIndex - this.#columns;
        }
        e.preventDefault();
        break;
      case 'Enter':
      case ' ':
        this.selectIndex(currentIndex);
        e.preventDefault();
        return;
      case 'Escape':
        this.handleBack();
        e.preventDefault();
        return;
      default:
        return;
    }

    if (nextIndex !== currentIndex) {
      this.selectIndex(nextIndex);
    }
  }

  handleBack() {
    if (this.screenManager) {
      this.screenManager.back();
    }
  }

  show(params = {}) {
    super.show(params);
    setTimeout(() => {
      const activeCard = this.#cards[this.#selectedIndex];
      if (activeCard) {
        activeCard.focus?.();
      } else {
        this.backBtn?.focus?.();
      }
    }, 50);
  }
}
