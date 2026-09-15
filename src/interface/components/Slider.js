/**
 * Componente Slider reutilizable con indicador de valor dinámico,
 * pista con relleno de acento esmeralda, y soporte para estado deshabilitado con nota técnica.
 */
export class Slider {
  /**
   * @param {Object} options
   * @param {string} options.label Etiqueta visible
   * @param {number} [options.min=0]
   * @param {number} [options.max=100]
   * @param {number} [options.step=1]
   * @param {number} [options.value=50]
   * @param {Function} [options.formatter] Función para dar formato al valor mostrado (ej. v => `${v}%`)
   * @param {boolean} [options.disabled=false]
   * @param {string} [options.disabledNote] Nota aclaratoria si está deshabilitado
   * @param {Function} [options.onChange] Callback invocado al mover el slider
   */
  constructor({
    label = '',
    min = 0,
    max = 100,
    step = 1,
    value = 50,
    formatter = (v) => String(v),
    disabled = false,
    disabledNote = null,
    onChange = null
  } = {}) {
    this.min = min;
    this.max = max;
    this.step = step;
    this.value = value;
    this.formatter = formatter;
    this.disabled = disabled;
    this.disabledNote = disabledNote;
    this.onChange = onChange;

    this.#buildDOM(label);
  }

  #buildDOM(label) {
    this.element = document.createElement('div');
    this.element.className = `nx-slider-container ${this.disabled ? 'is-disabled' : ''}`;

    // Encabezado de fila: Label a la izquierda, Valor a la derecha
    const header = document.createElement('div');
    header.className = 'nx-slider-header';

    const labelElem = document.createElement('label');
    labelElem.className = 'nx-slider-label';
    labelElem.textContent = label;

    this.valueElem = document.createElement('span');
    this.valueElem.className = 'nx-slider-value';
    this.valueElem.textContent = this.formatter(this.value);

    header.appendChild(labelElem);
    header.appendChild(this.valueElem);

    // Input range
    this.input = document.createElement('input');
    this.input.type = 'range';
    this.input.className = 'nx-slider-input';
    this.input.min = String(this.min);
    this.input.max = String(this.max);
    this.input.step = String(this.step);
    this.input.value = String(this.value);
    this.input.disabled = this.disabled;
    this.input.setAttribute?.('aria-label', label);

    this.#updateTrackFill();

    this.input.addEventListener('input', (e) => {
      const numericVal = parseFloat(e.target.value);
      this.setValue(numericVal, false);
      if (this.onChange) {
        this.onChange(numericVal);
      }
    });

    this.element.appendChild(header);
    this.element.appendChild(this.input);

    // Nota opcional si está deshabilitado
    if (this.disabledNote) {
      const note = document.createElement('p');
      note.className = 'nx-control-note';
      note.textContent = this.disabledNote;
      this.element.appendChild(note);
    }
  }

  #updateTrackFill() {
    if (!this.input.style) return;
    const percentage = ((this.value - this.min) / (this.max - this.min)) * 100;
    const clamped = Math.max(0, Math.min(100, percentage));
    if (this.disabled) {
      this.input.style.setProperty?.('--fill-percent', `${clamped}%`);
      this.input.style.background = `linear-gradient(to right, #64748b 0%, #64748b ${clamped}%, #1e293b ${clamped}%, #1e293b 100%)`;
    } else {
      this.input.style.setProperty?.('--fill-percent', `${clamped}%`);
      this.input.style.background = `linear-gradient(to right, #10b981 0%, #34d399 ${clamped}%, #1e293b ${clamped}%, #1e293b 100%)`;
    }
  }

  setValue(val, updateInput = true) {
    this.value = val;
    this.valueElem.textContent = this.formatter(val);
    if (updateInput && this.input) {
      this.input.value = String(val);
    }
    this.#updateTrackFill();
  }

  setDisabled(disabled, note = null) {
    this.disabled = disabled;
    if (this.input) this.input.disabled = disabled;
    if (this.element.classList?.toggle) {
      this.element.classList.toggle('is-disabled', disabled);
    }
    if (note) {
      this.disabledNote = note;
    }
    this.#updateTrackFill();
  }

  mount(container) {
    if (container && !this.element.parentNode) {
      container.appendChild(this.element);
    }
    return this.element;
  }
}
