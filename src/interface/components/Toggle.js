/**
 * Componente Toggle / Switch reutilizable con diseño de pastilla interactiva
 * y accesibilidad por teclado y lectores de pantalla.
 */
export class Toggle {
  /**
   * @param {Object} options
   * @param {string} options.label Etiqueta del interruptor
   * @param {boolean} [options.checked=false] Estado inicial
   * @param {boolean} [options.disabled=false]
   * @param {Function} [options.onChange] Callback invocado con el nuevo booleano
   */
  constructor({
    label = '',
    checked = false,
    disabled = false,
    onChange = null
  } = {}) {
    this.checked = checked;
    this.disabled = disabled;
    this.onChange = onChange;

    this.#buildDOM(label);
  }

  #buildDOM(label) {
    this.element = document.createElement('div');
    this.element.className = `nx-toggle-container ${this.disabled ? 'is-disabled' : ''}`;

    const labelElem = document.createElement('label');
    labelElem.className = 'nx-toggle-label';
    labelElem.textContent = label;

    this.switchElem = document.createElement('button');
    this.switchElem.type = 'button';
    this.switchElem.className = `nx-toggle-switch ${this.checked ? 'is-checked' : ''}`;
    this.switchElem.setAttribute?.('role', 'switch');
    this.switchElem.setAttribute?.('aria-checked', String(this.checked));
    this.switchElem.setAttribute?.('aria-label', label);
    if (this.disabled) this.switchElem.disabled = true;

    const knob = document.createElement('span');
    knob.className = 'nx-toggle-knob';
    this.switchElem.appendChild(knob);

    this.switchElem.addEventListener('click', () => {
      if (this.disabled) return;
      this.toggle();
    });

    this.element.appendChild(labelElem);
    this.element.appendChild(this.switchElem);
  }

  toggle() {
    this.setChecked(!this.checked);
    if (this.onChange) {
      this.onChange(this.checked);
    }
  }

  setChecked(checked) {
    this.checked = !!checked;
    this.switchElem.setAttribute?.('aria-checked', String(this.checked));
    if (this.switchElem.classList?.toggle) {
      this.switchElem.classList.toggle('is-checked', this.checked);
    } else {
      this.switchElem.className = `nx-toggle-switch ${this.checked ? 'is-checked' : ''}`;
    }
  }

  setDisabled(disabled) {
    this.disabled = !!disabled;
    if (this.switchElem) this.switchElem.disabled = this.disabled;
    if (this.element.classList?.toggle) {
      this.element.classList.toggle('is-disabled', this.disabled);
    }
  }

  mount(container) {
    if (container && !this.element.parentNode) {
      container.appendChild(this.element);
    }
    return this.element;
  }
}
