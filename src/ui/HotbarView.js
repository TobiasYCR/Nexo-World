import { AssetCatalog } from '../utils/AssetCatalog.js';
import { GameConfig } from '../game/GameConfig.js';

/**
 * Visualización del Hotbar in-game (9 slots).
 * Muestra las ranuras de acceso rápido, el slot seleccionado y el nombre legible
 * del bloque activo. Solo modifica el DOM cuando el estado cambia.
 */
export class HotbarView {
  #slots = [];
  #selectedIndex = 0;
  #currentBlockName = '';
  #slotSignatures = [];

  /**
   * @param {number} [size]
   * @param {AssetCatalog} [assetCatalog]
   */
  constructor(size = 9, assetCatalog = null) {
    this.size = size;
    this.assetCatalog = assetCatalog || new AssetCatalog(GameConfig.assets);
    this.element = document.createElement('div');
    this.element.className = 'hud-hotbar-container';

    this.#buildDOM();
  }

  #buildDOM() {
    // Indicador flotante del nombre del bloque seleccionado
    this.labelElement = document.createElement('div');
    this.labelElement.className = 'hud-hotbar-label';
    this.labelElement.textContent = '';
    this.labelElement.hidden = true;

    // Barra de slots
    this.barElement = document.createElement('div');
    this.barElement.className = 'hud-hotbar-bar';

    this.#slots = [];
    this.#slotSignatures = [];

    for (let i = 0; i < this.size; i++) {
      const slot = document.createElement('div');
      slot.className = `hud-hotbar-slot ${i === 0 ? 'is-selected' : ''}`;
      if (slot.dataset) slot.dataset.slotIndex = String(i);
      slot.setAttribute?.('data-slot-index', String(i));

      const number = document.createElement('span');
      number.className = 'hud-slot-number';
      number.textContent = String(i + 1);

      const icon = document.createElement('div');
      icon.className = 'hud-slot-icon';

      const count = document.createElement('span');
      count.className = 'hud-slot-count';
      count.textContent = '';

      slot.appendChild(number);
      slot.appendChild(icon);
      slot.appendChild(count);

      this.barElement.appendChild(slot);
      this.#slots.push({ element: slot, icon, count });
      this.#slotSignatures.push('');
    }

    this.element.appendChild(this.labelElement);
    this.element.appendChild(this.barElement);
  }

  mount(container) {
    if (!container) return;
    if (!this.element.parentNode) {
      container.appendChild(this.element);
    }
  }

  setVisible(visible) {
    this.element.hidden = !visible;
  }

  /**
   * Actualiza el estado visual del hotbar con diffing estricto.
   * Solo toca el DOM si la firma id:count o el slot seleccionado cambiaron.
   * @param {Object|import('../inventory/Hotbar.js').Hotbar} [hotbarState]
   */
  update(hotbarState = {}) {
    let selectedIndex = this.#selectedIndex;
    if (typeof hotbarState.selectedIndex === 'number') {
      selectedIndex = hotbarState.selectedIndex;
    }

    const slotsData = hotbarState.slots ?? [];

    for (let i = 0; i < this.size; i++) {
      const slotUI = this.#slots[i];
      const slotData = slotsData[i] ?? null;
      const isSelected = i === selectedIndex;

      const blockType = slotData?.blockType ?? null;
      const blockId = blockType?.id ?? 'empty';
      const count = (blockType && slotData?.count > 0) ? slotData.count : 0;
      const signature = `${blockId}:${count}:${isSelected}`;

      // Si la firma no cambió, no tocar el DOM de este slot
      if (this.#slotSignatures[i] === signature) {
        continue;
      }
      this.#slotSignatures[i] = signature;

      // Estado de selección
      if (slotUI.element.classList?.toggle) {
        slotUI.element.classList.toggle('is-selected', isSelected);
      } else {
        slotUI.element.className = `hud-hotbar-slot ${isSelected ? 'is-selected' : ''}`;
      }

      // Renderizado del contenido del slot
      if (blockType && count > 0) {
        const color = blockType.color ?? [200, 200, 200];
        if (slotUI.icon.style) {
          slotUI.icon.style.backgroundColor = `rgb(${color[0]}, ${color[1]}, ${color[2]})`;
          if (blockType.texture) {
            const url = this.assetCatalog ? this.assetCatalog.textureUrl(blockType.texture) : `/textures/blocks/${blockType.texture}`;
            slotUI.icon.style.backgroundImage = `url("${url}")`;
            slotUI.icon.style.backgroundSize = 'contain';
            slotUI.icon.style.backgroundRepeat = 'no-repeat';
            slotUI.icon.style.backgroundPosition = 'center';
            slotUI.icon.style.imageRendering = 'pixelated';
          } else {
            slotUI.icon.style.backgroundImage = '';
          }
        }
        slotUI.icon.hidden = false;
        slotUI.count.textContent = count > 1 ? String(count) : '';
      } else {
        if (slotUI.icon.style) {
          slotUI.icon.style.backgroundImage = '';
          slotUI.icon.style.backgroundColor = 'transparent';
        }
        slotUI.icon.hidden = true;
        slotUI.count.textContent = '';
      }
    }

    this.#selectedIndex = selectedIndex;

    // Actualizar nombre del bloque seleccionado
    const activeSlot = slotsData[this.#selectedIndex];
    const activeBlock = activeSlot?.blockType ?? null;
    const blockName = activeBlock ? (activeBlock.label || activeBlock.name || '') : '';
    if (blockName !== this.#currentBlockName) {
      this.#currentBlockName = blockName;
      this.labelElement.textContent = blockName;
      this.labelElement.hidden = !blockName;
    }
  }
}
