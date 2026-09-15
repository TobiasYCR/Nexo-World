import { Screen } from './Screen.js';

/**
 * Pantalla de respaldo / placeholder para pantallas en construcción.
 */
export class PlaceholderScreen extends Screen {
  constructor(id, title = 'Pantalla', screenManager = null, intentBus = null) {
    super(id, screenManager, intentBus);
    this.titleText = title;
    this.#buildDOM();
  }

  #buildDOM() {
    this.element.className = `screen screen-${this.id} nx-modal-backdrop`;

    const modal = document.createElement('div');
    modal.className = 'nx-modal-dialog';

    const header = document.createElement('div');
    header.className = 'nx-modal-header';

    const title = document.createElement('h2');
    title.className = 'nx-modal-title';
    title.textContent = this.titleText.toUpperCase();

    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'nx-modal-close';
    closeBtn.textContent = '✕';
    closeBtn.setAttribute?.('aria-label', 'Cerrar');
    closeBtn.addEventListener('click', () => this.screenManager?.back());

    header.appendChild(title);
    header.appendChild(closeBtn);

    const body = document.createElement('div');
    body.className = 'nx-modal-body';

    const msg = document.createElement('p');
    msg.style.cssText = 'color: #94a3b8; text-align: center; margin: 30px 0;';
    msg.textContent = 'Contenido en desarrollo por Frontend 2.';

    body.appendChild(msg);

    const footer = document.createElement('div');
    footer.className = 'nx-modal-footer';

    const backBtn = document.createElement('button');
    backBtn.type = 'button';
    backBtn.className = 'nx-btn nx-btn-primary';
    backBtn.textContent = 'VOLVER';
    backBtn.addEventListener('click', () => this.screenManager?.back());

    footer.appendChild(backBtn);

    modal.appendChild(header);
    modal.appendChild(body);
    modal.appendChild(footer);

    this.element.appendChild(modal);
  }
}
