/**
 * Mira central de juego.
 * Elemento DOM puro con diseño pixelado, tamaño y opacidad configurables
 * y alta visibilidad sobre cualquier superficie.
 */
export class Crosshair {
  #size = 20;
  #opacity = 1.0;

  constructor(options = {}) {
    this.#size = options.size ?? 20;
    this.#opacity = options.opacity ?? 1.0;

    this.element = document.createElement('div');
    this.element.className = 'hud-crosshair';
    this.element.setAttribute('aria-hidden', 'true');

    this.#applyStyles();
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

  setSize(size) {
    if (typeof size !== 'number' || size <= 0) return;
    this.#size = size;
    this.#applyStyles();
  }

  setOpacity(opacity) {
    if (typeof opacity !== 'number') return;
    this.#opacity = Math.max(0, Math.min(1, opacity));
    this.#applyStyles();
  }

  #applyStyles() {
    if (this.element.style) {
      this.element.style.width = `${this.#size}px`;
      this.element.style.height = `${this.#size}px`;
      this.element.style.opacity = `${this.#opacity}`;
      this.element.style.marginLeft = `-${Math.round(this.#size / 2)}px`;
      this.element.style.marginTop = `-${Math.round(this.#size / 2)}px`;
    }
  }
}
