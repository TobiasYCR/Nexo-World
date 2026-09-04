/** Mira central. Elemento DOM puro: no interfiere con el pipeline WEBGL. */
export class Crosshair {
  constructor() {
    this.element = document.createElement('div');
    this.element.className = 'hud-crosshair';
  }

  mount(container) {
    container.appendChild(this.element);
  }

  setVisible(visible) {
    this.element.hidden = !visible;
  }
}
