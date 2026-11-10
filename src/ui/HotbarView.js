import { resolveBlockSyllables } from '../blocks/BlockType.js';
import { SpeechService } from '../audio/SpeechService.js';
import { Icons } from './Icons.js';

/**
 * Visualización de la Hotbar in-game (9 slots).
 * Muestra las ranuras de acceso rápido, texturas reales de bloques,
 * cantidades, transición visual en cambio de slot, etiqueta flotante con sílabas
 * y botón de pronunciación con audio (TTS).
 * Optimizado para evitar escrituras al DOM cuando no hay cambios.
 */
export class HotbarView {
  #slots = [];
  #selectedIndex = 0;
  #currentBlockName = '';
  #currentBlock = null;
  #lastSlotStates = [];
  #labelFadeTimeout = null;
  /** Desde Configuración: mostrar o no el nombre del bloque al cambiar de ranura. */
  #showBlockName = true;
  #speechService = null;

  constructor(size = 9, options = {}) {
    this.size = size;
    this.#speechService = options.speechService ?? SpeechService.getInstance();
    this.element = document.createElement('div');
    this.element.className = 'hud-hotbar-container';

    this.#buildDOM();
  }

  get selectedIndex() {
    return this.#selectedIndex;
  }

  get currentBlock() {
    return this.#currentBlock;
  }

  #buildDOM() {
    // Indicador flotante del nombre y separación silábica del bloque seleccionado
    this.labelElement = document.createElement('div');
    this.labelElement.className = 'hud-hotbar-label';
    this.labelElement.hidden = true;

    this.nameSpan = document.createElement('span');
    this.nameSpan.className = 'hud-hotbar-name';

    this.syllablesSpan = document.createElement('span');
    this.syllablesSpan.className = 'hud-hotbar-syllables';

    this.speakBtn = document.createElement('button');
    this.speakBtn.type = 'button';
    this.speakBtn.className = 'hud-hotbar-speak-btn';
    this.speakBtn.innerHTML = Icons.speaker;
    this.speakBtn.setAttribute('aria-label', 'Escuchar pronunciación del bloque activo');
    this.speakBtn.addEventListener('click', (e) => {
      e.stopPropagation?.();
      this.speakActiveBlock('syllabic');
    });

    this.labelElement.appendChild(this.nameSpan);
    this.labelElement.appendChild(this.syllablesSpan);
    this.labelElement.appendChild(this.speakBtn);

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

    // Actualizar nombre y sílabas del bloque seleccionado
    const activeSlot = slotsData[this.#selectedIndex];
    const block = (activeSlot && activeSlot.blockType && activeSlot.count > 0)
      ? activeSlot.blockType
      : null;
    const blockDisplayName = block ? (block.label || block.name || '') : '';

    if (blockDisplayName !== this.#currentBlockName || indexChanged) {
      this.#currentBlockName = blockDisplayName;
      this.#currentBlock = block;
      this.#showFloatingLabel(blockDisplayName, block);
    }
  }

  /**
   * Pronuncia el bloque actualmente seleccionado en la hotbar y resalta cada sílaba.
   * @param {'syllabic'|'word'} [mode='syllabic']
   */
  speakActiveBlock(mode = 'syllabic') {
    if (!this.#currentBlock || !this.#speechService) return;

    // Mantener visible el indicador mientras se pronuncia
    if (this.#labelFadeTimeout) {
      clearTimeout(this.#labelFadeTimeout);
      this.#labelFadeTimeout = null;
    }
    this.labelElement.hidden = false;
    this.labelElement.classList.remove('is-fading');

    const parts = this.syllablesSpan.querySelectorAll('.hud-syllable-part');

    this.#speechService.speak(this.#currentBlock, {
      mode,
      onSyllable: (index) => {
        parts.forEach((p, idx) => {
          p.classList.toggle('is-speaking', idx === index);
        });
      },
      onCompleteWord: () => {
        parts.forEach((p) => p.classList.add('is-speaking'));
      },
      onEnd: () => {
        parts.forEach((p) => p.classList.remove('is-speaking'));
        this.#scheduleLabelFade();
      }
    });
  }

  setShowBlockName(show) {
    this.#showBlockName = Boolean(show);
    if (!this.#showBlockName) this.labelElement.hidden = true;
  }

  #showFloatingLabel(name, block = null) {
    if (!name || !this.#showBlockName) {
      this.labelElement.hidden = true;
      this.nameSpan.textContent = '';
      this.syllablesSpan.innerHTML = '';
      return;
    }

    this.nameSpan.textContent = name;
    this.syllablesSpan.innerHTML = '';

    const { syllables } = resolveBlockSyllables(block || { label: name, name });
    syllables.forEach((syl, idx) => {
      if (idx > 0) {
        const sep = document.createElement('span');
        sep.className = 'hud-syllable-sep';
        sep.textContent = '-';
        this.syllablesSpan.appendChild(sep);
      }
      const part = document.createElement('span');
      part.className = 'hud-syllable-part';
      part.dataset.syllableIndex = String(idx);
      part.textContent = syl;
      this.syllablesSpan.appendChild(part);
    });

    this.labelElement.hidden = false;
    this.labelElement.classList.remove('is-fading');

    this.#scheduleLabelFade();
  }

  #scheduleLabelFade() {
    if (this.#labelFadeTimeout) {
      clearTimeout(this.#labelFadeTimeout);
    }

    // Mostrar durante 3.5 segundos y luego desvanecer
    this.#labelFadeTimeout = setTimeout(() => {
      this.labelElement.classList.add('is-fading');
      this.#labelFadeTimeout = setTimeout(() => {
        this.labelElement.hidden = true;
        this.labelElement.classList.remove('is-fading');
      }, 500);
    }, 3500);
  }
}
