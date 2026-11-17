import { ScreenType } from './ScreenType.js';

/**
 * Fondo fijo de los menús: una imagen que tapa el canvas mientras no hay una
 * partida en juego (menú principal y las pantallas que se abren desde él:
 * mundos, perfil, clasificación, configuración…).
 *
 * Se muestra al abrir el menú principal y se oculta al empezar a jugar. La
 * pausa y lo que se abre desde ella siguen mostrando el mundo detrás.
 */
export class MenuScenery {
  static IMAGE_URL = '/images/menu-background.jpg';

  #visible = false;
  #listeners = [];

  constructor() {
    this.element = document.createElement('div');
    this.element.className = 'nx-menu-scenery';
    this.element.setAttribute('aria-hidden', 'true');
    this.element.style.backgroundImage = `url("${MenuScenery.IMAGE_URL}")`;
    this.setVisible(true);
  }

  get isVisible() {
    return this.#visible;
  }

  /** Lo pone debajo de todas las pantallas del contenedor. */
  mount(container) {
    if (!container || this.element.parentNode) return;
    if (typeof container.prepend === 'function') container.prepend(this.element);
    else container.appendChild(this.element);
  }

  /** Sigue los cambios de pantalla: el menú lo muestra y jugar lo oculta. */
  bind(screenManager) {
    screenManager?.onChange?.((current) => {
      if (current === ScreenType.MENU) this.setVisible(true);
      else if (current === ScreenType.PLAYING) this.setVisible(false);
    });
  }

  /** @param {(visible: boolean) => void} listener */
  onChange(listener) {
    this.#listeners.push(listener);
    listener(this.#visible);
  }

  setVisible(visible) {
    const next = Boolean(visible);
    const changed = next !== this.#visible;
    this.#visible = next;
    this.element.hidden = !next;
    if (changed) for (const listener of this.#listeners) listener(next);
  }
}
