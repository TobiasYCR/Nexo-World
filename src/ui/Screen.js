/**
 * Clase base para todas las pantallas del juego (Frontend 1 y Frontend 2).
 * Define el ciclo de vida estándar: mount, show, hide y manejo de teclado.
 */
export class Screen {
  /**
   * @param {string} id Identificador único de la pantalla (ej. ScreenType.MENU)
   * @param {import('./ScreenManager.js').ScreenManager} [screenManager]
   * @param {import('./IntentBus.js').IntentBus} [intentBus]
   */
  constructor(id, screenManager = null, intentBus = null) {
    if (!id) {
      throw new Error('Toda pantalla debe declarar un identificador (id).');
    }
    this.id = id;
    this.screenManager = screenManager;
    this.intentBus = intentBus;

    this.element = document.createElement('div');
    this.element.className = `screen screen-${id}`;
    this.element.hidden = true;
    if (this.element.style) {
      this.element.style.display = 'none';
    }

    this._boundKeyDown = (e) => this.onKeyDown(e);
  }

  get isVisible() {
    return !this.element.hidden;
  }

  /**
   * Monta la pantalla en el contenedor DOM.
   * @param {HTMLElement} container
   */
  mount(container) {
    if (!container) return;
    if (!this.element.parentNode) {
      container.appendChild(this.element);
    }
  }

  /**
   * Muestra y activa la pantalla.
   * @param {Object} [params] Parámetros opcionales para la apertura.
   */
  show(params = {}) {
    this.element.hidden = false;
    if (this.element.style) {
      this.element.style.display = 'flex';
    }
    if (this.element.classList?.add) {
      this.element.classList.add('is-active');
    }
    window.addEventListener?.('keydown', this._boundKeyDown);
  }

  /**
   * Oculta y desactiva la pantalla.
   */
  hide() {
    this.element.hidden = true;
    if (this.element.style) {
      this.element.style.display = 'none';
    }
    if (this.element.classList?.remove) {
      this.element.classList.remove('is-active');
    }
    window.removeEventListener?.('keydown', this._boundKeyDown);
  }

  /**
   * Manejador de teclado para la pantalla activa.
   * @param {KeyboardEvent} event
   */
  onKeyDown(event) {
    if (event.key === 'Escape' || event.code === 'Escape') {
      if (this.screenManager) {
        this.screenManager.back();
      }
    }
  }

  /**
   * Desmonta y libera recursos si es necesario.
   */
  destroy() {
    this.hide();
    if (this.element.parentNode) {
      if (this.element.remove) {
        this.element.remove();
      } else if (this.element.parentNode.removeChild) {
        this.element.parentNode.removeChild(this.element);
      }
    }
  }
}
