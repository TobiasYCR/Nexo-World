/**
 * Visualización de la Hotbar in-game (9 slots).
 * Muestra las ranuras de acceso rápido, texturas reales de bloques,
 * cantidades, transición visual en cambio de slot y etiqueta flotante con temporizador.
 * Optimizado para evitar escrituras al DOM cuando no hay cambios.
 */
export class HotbarView {
  #slots = [];
  #selectedIndex = 0;
  #currentBlockName = '';
  #lastSlotStates = [];
  #labelFadeTimeout = null;

  constructor(size = 9) {
    this.size = size;
    this.element = document.createElement('div');
    this.element.className = 'hud-hotbar-container';

    this.#buildDOM();
  }

  get selectedIndex() {
    return this.#selectedIndex;
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
    this.barElement.setAttribute('role', 'toolbar');
    this.barElement.setAttribute('aria-label', 'Barra de acceso rápido');

    this.#slots = [];
    this.#lastSlotStates = [];

    for (let i = 0; i < this.size; i++) {
      const slot = document.createElement('div');
      slot.className = `hud-hotbar-slot ${i === 0 ? 'is-selected' : ''}`;
      if (slot.dataset) slot.dataset.slotIndex = String(i);
      slot.setAttribute('data-slot-index', String(i));
      slot.setAttribute('role', 'button');
      slot.setAttribute('aria-label', `Ranura ${i + 1}`);

      const number = document.createElement('span');
      number.className = 'hud-slot-number';
      number.textContent = String(i + 1);

      const icon = document.createElement('div');
      icon.className = 'hud-slot-icon';
      icon.hidden = true;

      const count = document.createElement('span');
      count.className = 'hud-slot-count';
      count.textContent = '';

      slot.appendChild(number);
      slot.appendChild(icon);
      slot.appendChild(count);

      this.barElement.appendChild(slot);
      this.#slots.push({ element: slot, icon, count, number });
      this.#lastSlotStates.push({ isSelected: i === 0, blockId: null, count: 0, texture: null, color: null });
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
   * Actualiza el estado visual del hotbar sin reconstruir el DOM.
   * @param {Object} [hotbarState]
   * @param {number} [hotbarState.selectedIndex]
   * @param {Array<{blockType: {id: number, name: string, label?: string, color: number[], texture?: string, textures?: Object}, count: number}>} [hotbarState.slots]
   */
  update(hotbarState = {}) {
    let indexChanged = false;
    if (typeof hotbarState.selectedIndex === 'number' && hotbarState.selectedIndex !== this.#selectedIndex) {
      this.#selectedIndex = hotbarState.selectedIndex;
      indexChanged = true;
    }

    const slotsData = hotbarState.slots ?? [];

    for (let i = 0; i < this.size; i++) {
      const slotUI = this.#slots[i];
      const slotData = slotsData[i];
      const lastState = this.#lastSlotStates[i];
      const isSelected = i === this.#selectedIndex;

      // Actualizar selección sólo si cambió
      if (lastState.isSelected !== isSelected) {
        lastState.isSelected = isSelected;
        if (slotUI.element.classList?.toggle) {
          slotUI.element.classList.toggle('is-selected', isSelected);
          if (isSelected) {
            slotUI.element.classList.add('has-changed');
            setTimeout(() => slotUI.element.classList.remove('has-changed'), 200);
          }
        } else {
          slotUI.element.className = `hud-hotbar-slot ${isSelected ? 'is-selected' : ''}`;
        }
      }

      const blockType = slotData?.blockType;
      const count = (slotData && blockType && slotData.count > 0) ? slotData.count : 0;
      const blockId = count > 0 ? blockType.id : null;
      const texture = count > 0 ? (blockType.textures?.top || blockType.texture || null) : null;
      const color = count > 0 ? (blockType.color ?? [200, 200, 200]) : null;

      // Actualizar contenido del slot sólo si cambió
      if (lastState.blockId !== blockId || lastState.count !== count || lastState.texture !== texture) {
        lastState.blockId = blockId;
        lastState.count = count;
        lastState.texture = texture;
        lastState.color = color;

        if (count > 0) {
          if (texture && slotUI.icon.style) {
            slotUI.icon.style.backgroundImage = `url('assets/textures/blocks/${texture}')`;
            slotUI.icon.style.backgroundColor = color ? `rgb(${color[0]}, ${color[1]}, ${color[2]})` : 'transparent';
          } else if (color && slotUI.icon.style) {
            slotUI.icon.style.backgroundImage = 'none';
            slotUI.icon.style.backgroundColor = `rgb(${color[0]}, ${color[1]}, ${color[2]})`;
          }
          slotUI.icon.hidden = false;
          slotUI.count.textContent = count > 1 ? String(count) : '';
          const blockLabel = blockType.label || blockType.name || `Bloque ${blockId}`;
          slotUI.element.setAttribute('aria-label', `Ranura ${i + 1}: ${blockLabel} (${count})`);
        } else {
          if (slotUI.icon.style) {
            slotUI.icon.style.backgroundImage = 'none';
            slotUI.icon.style.backgroundColor = 'transparent';
          }
          slotUI.icon.hidden = true;
          slotUI.count.textContent = '';
          slotUI.element.setAttribute('aria-label', `Ranura ${i + 1}: Vacía`);
        }
      }
    }

    // Actualizar nombre del bloque seleccionado
    const activeSlot = slotsData[this.#selectedIndex];
    const block = activeSlot?.blockType;
    const blockDisplayName = (activeSlot && block && activeSlot.count > 0)
      ? (block.label || block.name || '')
      : '';

    if (blockDisplayName !== this.#currentBlockName || indexChanged) {
      this.#currentBlockName = blockDisplayName;
      this.#showFloatingLabel(blockDisplayName);
    }
  }

  #showFloatingLabel(name) {
    if (!name) {
      this.labelElement.hidden = true;
      this.labelElement.textContent = '';
      return;
    }

    this.labelElement.textContent = name;
    this.labelElement.hidden = false;
    this.labelElement.classList.remove('is-fading');

    if (this.#labelFadeTimeout) {
      clearTimeout(this.#labelFadeTimeout);
    }

    // Mostrar durante 2.5 segundos y luego desvanecer
    this.#labelFadeTimeout = setTimeout(() => {
      this.labelElement.classList.add('is-fading');
      this.#labelFadeTimeout = setTimeout(() => {
        this.labelElement.hidden = true;
        this.labelElement.classList.remove('is-fading');
      }, 500);
    }, 2000);
  }
}
