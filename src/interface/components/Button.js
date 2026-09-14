/**
 * Componente botón reutilizable para la interfaz de Nexo World.
 * Soporta variantes visuales (primary, secondary, danger, icon) y accesibilidad.
 */
export class Button {
  /**
   * @param {Object} options
   * @param {string} [options.text]
   * @param {string} [options.variant='secondary'] 'primary' | 'secondary' | 'danger' | 'icon'
   * @param {string} [options.icon]
   * @param {string} [options.id]
   * @param {string} [options.ariaLabel]
   * @param {boolean} [options.disabled=false]
   * @param {Function} [options.onClick]
   */
  constructor({
    text = '',
    variant = 'secondary',
    icon = null,
    id = null,
    ariaLabel = null,
    disabled = false,
    onClick = null
  } = {}) {
    this.variant = variant;
    this.onClick = onClick;

    this.element = document.createElement('button');
    this.element.type = 'button';
    this.element.className = `nx-btn nx-btn-${variant}`;
    if (id) this.element.id = id;
    if (ariaLabel) this.element.setAttribute?.('aria-label', ariaLabel);
    if (disabled) this.element.disabled = true;

    this.render(text, icon);

    if (this.onClick) {
      this.element.addEventListener('click', (e) => {
        if (!this.element.disabled) {
          this.onClick(e);
        }
      });
    }
  }

  render(text, icon) {
    if (this.variant === 'icon') {
      this.element.textContent = icon || text;
      return;
    }

    if (icon) {
      this.element.innerHTML = `
        <span class="nx-btn-icon">${icon}</span>
        <span class="nx-btn-text">${text}</span>
      `;
    } else {
      this.element.textContent = text;
    }
  }

  setText(text) {
    this.element.textContent = text;
  }

  setDisabled(disabled) {
    this.element.disabled = !!disabled;
  }

  mount(container) {
    if (container && !this.element.parentNode) {
      container.appendChild(this.element);
    }
    return this.element;
  }

  focus() {
    this.element.focus?.();
  }
}
