/**
 * Componente contenedor Modal reutilizable para las pantallas de la interfaz.
 * Proporciona estructura de diálogo accesible (role="dialog", aria-modal="true"),
 * encabezado con título y botón de cierre, cuerpo con scrollbar estilizada y barra de acciones.
 */
export class Modal {
  /**
   * @param {Object} options
   * @param {string} options.title Título del diálogo
   * @param {string} [options.className=''] Clases CSS adicionales
   * @param {Function} [options.onClose] Callback al cerrar (botón ✕ o escape)
   */
  constructor({
    title = '',
    className = '',
    onClose = null
  } = {}) {
    this.title = title;
    this.onClose = onClose;

    this.#buildDOM(className);
  }

  #buildDOM(className) {
    this.element = document.createElement('div');
    this.element.className = `nx-modal-dialog ${className}`.trim();
    this.element.setAttribute?.('role', 'dialog');
    this.element.setAttribute?.('aria-modal', 'true');
    this.element.setAttribute?.('aria-label', this.title);

    // Header
    const header = document.createElement('div');
    header.className = 'nx-modal-header';

    this.titleElem = document.createElement('h2');
    this.titleElem.className = 'nx-modal-title';
    this.titleElem.textContent = this.title.toUpperCase();

    this.closeBtn = document.createElement('button');
    this.closeBtn.type = 'button';
    this.closeBtn.className = 'nx-modal-close';
    this.closeBtn.innerHTML = '&#10005;'; // ✕
    this.closeBtn.setAttribute?.('aria-label', 'Cerrar');
    this.closeBtn.addEventListener('click', () => this.handleClose());

    header.appendChild(this.titleElem);
    header.appendChild(this.closeBtn);

    // Body
    this.bodyElem = document.createElement('div');
    this.bodyElem.className = 'nx-modal-body nx-scrollbar';

    // Footer
    this.footerElem = document.createElement('div');
    this.footerElem.className = 'nx-modal-footer';

    this.element.appendChild(header);
    this.element.appendChild(this.bodyElem);
    this.element.appendChild(this.footerElem);
  }

  setTitle(title) {
    this.title = title;
    this.titleElem.textContent = title.toUpperCase();
    this.element.setAttribute?.('aria-label', title);
  }

  /**
   * Agrega un elemento o componente al cuerpo del modal.
   * @param {HTMLElement | { element: HTMLElement }} item
   */
  addBodyItem(item) {
    const el = item.element || item;
    this.bodyElem.appendChild(el);
  }

  /**
   * Agrega un botón o elemento al pie del modal.
   * @param {HTMLElement | { element: HTMLElement }} item
   */
  addFooterItem(item) {
    const el = item.element || item;
    this.footerElem.appendChild(el);
  }

  handleClose() {
    if (this.onClose) {
      this.onClose();
    }
  }

  mount(container) {
    if (container && !this.element.parentNode) {
      container.appendChild(this.element);
    }
    return this.element;
  }
}
