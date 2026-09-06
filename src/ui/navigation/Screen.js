/**
 * Clase base de toda pantalla de interfaz (menú, pausa, configuración, etc.).
 * Ciclo de vida en tres pasos:
 *   - mount(container): construye el DOM una única vez (build()) y lo cuelga
 *     del contenedor. Queda en el árbol, oculto, listo para mostrarse rápido.
 *   - show() / hide(): solo alternan visibilidad, nunca reconstruyen nada.
 *
 * Las subclases NUNCA conocen al motor ni a ScreenManager: reciben un
 * IntentBus en su constructor y emiten intenciones (ver UIIntent.js).
 */
export class Screen {
  #built = false;

  constructor(id) {
    if (new.target === Screen) {
      throw new TypeError('Screen es abstracta: extendela para crear una pantalla concreta.');
    }
    this.id = id;
    this.element = document.createElement('div');
    this.element.className = `screen screen--${id}`;
    this.element.hidden = true;
  }

  /** Punto de extensión: arma el contenido de la pantalla. Se llama una sola vez. */
  build() {}

  mount(container) {
    if (!this.#built) {
      this.build();
      this.#built = true;
    }
    container.appendChild(this.element);
  }

  show() {
    this.element.hidden = false;
    this.onShow();
  }

  hide() {
    this.element.hidden = true;
    this.onHide();
  }

  /** Punto de extensión: reaccionar a que la pantalla se volvió visible. */
  onShow() {}

  /** Punto de extensión: reaccionar a que la pantalla dejó de verse. */
  onHide() {}
}
