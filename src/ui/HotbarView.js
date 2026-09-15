/**
 * Visualización del Hotbar in-game (9 slots).
 * Muestra las ranuras de acceso rápido, el slot seleccionado y el nombre legible
 * del bloque activo sobre cualquier fondo del mundo.
 */
export class HotbarView {
  #slots = [];
  #selectedIndex = 0;
  #currentBlockName = '';

  constructor(size = 9) {
    this.size = size;
    this.element = document.createElement('div');
    this.element.className = 'hud-hotbar-container';

    this.#buildDOM();
  }

  #buildDOM() {
    // Indicador flotante del nombre del bloque seleccionado
    this.labelElement = document.createElement('div');
    this.labelElement.className = 'hud-hotbar-label';
    this.labelElement.textContent = '';

    // Barra de slots
    this.barElement = document.createElement('div');
    this.barElement.className = 'hud-hotbar-bar';

    this.#slots = [];
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
   * Actualiza el estado visual del hotbar.
   * @param {Object} [hotbarState]
   * @param {number} [hotbarState.selectedIndex]
   * @param {Array<{blockType: {name: string, color: number[], texture: string}, count: number}>} [hotbarState.slots]
   */
  update(hotbarState = {}) {
    if (typeof hotbarState.selectedIndex === 'number') {
      this.#selectedIndex = hotbarState.selectedIndex;
    }

    const slotsData = hotbarState.slots ?? [];

    for (let i = 0; i < this.size; i++) {
      const slotUI = this.#slots[i];
      const slotData = slotsData[i];
      const isSelected = i === this.#selectedIndex;

      if (slotUI.element.classList?.toggle) {
        slotUI.element.classList.toggle('is-selected', isSelected);
      } else {
        slotUI.element.className = `hud-hotbar-slot ${isSelected ? 'is-selected' : ''}`;
      }

      if (slotData && slotData.blockType && slotData.count > 0) {
        const color = slotData.blockType.color ?? [200, 200, 200];
        if (slotUI.icon.style) {
          slotUI.icon.style.backgroundColor = `rgb(${color[0]}, ${color[1]}, ${color[2]})`;
        }
        slotUI.icon.hidden = false;
        slotUI.count.textContent = slotData.count > 1 ? String(slotData.count) : '';
      } else {
        if (slotUI.icon.style) {
          slotUI.icon.style.backgroundColor = 'transparent';
        }
        slotUI.count.textContent = '';
      }
    }

    // Actualizar nombre de bloque seleccionado
    const activeSlot = slotsData[this.#selectedIndex];
    const blockName = activeSlot?.blockType?.name ?? '';
    if (blockName !== this.#currentBlockName) {
      this.#currentBlockName = blockName;
      this.labelElement.textContent = blockName;
      this.labelElement.hidden = !blockName;
    }
  }
}
