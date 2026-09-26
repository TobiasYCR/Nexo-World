import { Screen } from '../../ui/Screen.js';
import { ScreenType } from '../../ui/ScreenType.js';
import { IntentBus } from '../../ui/IntentBus.js';
import { Modal } from '../components/Modal.js';
import { Button } from '../components/Button.js';
import { createDefaultBlockRegistry } from '../../blocks/BlockRegistry.js';
import { AssetCatalog } from '../../utils/AssetCatalog.js';
import { GameConfig } from '../../game/GameConfig.js';

/**
 * Pantalla de Inventario (modo creativo).
 * Muestra únicamente los bloques colocables registrados en BlockRegistry,
 * con selección accesible por teclado y carga de pilas completas al slot activo.
 */
export class InventoryScreen extends Screen {
  #selectedIndex = 0;
  #cards = [];
  #columns = 6;
  #blockRegistry = null;

  /**
   * @param {import('../../blocks/BlockRegistry.js').BlockRegistry} [blockRegistry]
   * @param {import('../../ui/ScreenManager.js').ScreenManager} [screenManager]
   * @param {IntentBus} [intentBus]
   * @param {AssetCatalog} [assetCatalog]
   */
  constructor(blockRegistry = null, screenManager = null, intentBus = null, assetCatalog = null) {
    super(ScreenType.INVENTORY, screenManager, intentBus);
    this.assetCatalog = assetCatalog || new AssetCatalog(GameConfig.assets);
    this.#blockRegistry = blockRegistry || createDefaultBlockRegistry();
    this.blocks = this.#prepareBlocks();
    this.#buildDOM();
  }

  get blockRegistry() {
    return this.#blockRegistry;
  }

  set blockRegistry(registry) {
    if (registry && registry !== this.#blockRegistry) {
      this.#blockRegistry = registry;
      this.refresh();
    }
  }

  #prepareBlocks() {
    return this.#blockRegistry?.placeableTypes ? this.#blockRegistry.placeableTypes() : [];
  }

  refresh() {
    this.blocks = this.#prepareBlocks();
    if (this.#selectedIndex >= this.blocks.length) {
      this.#selectedIndex = Math.max(0, this.blocks.length - 1);
    }
    this.#rebuildGrid();
  }

  #rebuildGrid() {
    if (!this.gridElem) return;
    this.gridElem.innerHTML = '';
    this.#cards = [];

    this.blocks.forEach((block, index) => {
      const card = document.createElement('div');
      const isSelected = index === this.#selectedIndex;
      card.className = `nx-block-card ${isSelected ? 'is-selected' : ''}`;
      card.setAttribute?.('role', 'radio');
      card.setAttribute?.('aria-checked', String(isSelected));
      card.setAttribute?.('aria-label', block.label || block.name);
      card.tabIndex = isSelected ? 0 : -1;
      if (card.dataset) card.dataset.index = String(index);

      // Muestra de color / textura
      const swatch = document.createElement('div');
      swatch.className = 'nx-block-swatch';
      const rgb = block.color ?? [180, 180, 180];
      if (swatch.style) {
        swatch.style.backgroundColor = `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;
        if (block.texture) {
          const url = this.assetCatalog.textureUrl(block.texture);
          swatch.style.backgroundImage = `url("${url}")`;
          swatch.style.backgroundSize = 'cover';
          swatch.style.backgroundPosition = 'center';
          swatch.style.imageRendering = 'pixelated';
        }
      }

      // Etiqueta del bloque
      const label = document.createElement('span');
      label.className = 'nx-block-name';
      label.textContent = block.label || block.name;

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

    this.#rebuildGrid();
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
        blockType: selectedBlock,
        count: 64
      });
    }
  }

  #handleCardKey(e, currentIndex) {
    let nextIndex = currentIndex;
    const total = this.blocks.length;
    if (total === 0) return;

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
