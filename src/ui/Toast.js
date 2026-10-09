/**
 * Sistema de notificaciones Toast de Nexo World.
 * Muestra avisos temporales de éxito, error, advertencia o información
 * con estilo pixel art / dark voxel sin interferir con el juego.
 */
export class Toast {
  static #instance = null;

  /**
   * @param {HTMLElement} [container] Contenedor donde se inserta el toast stack
   */
  constructor(container = null) {
    this.container = container;
    this.element = document.createElement('div');
    this.element.className = 'nx-toast-container';
    this.element.setAttribute('role', 'region');
    this.element.setAttribute('aria-label', 'Notificaciones');
    this.element.setAttribute('aria-live', 'polite');

    if (container) {
      this.mount(container);
    }
  }

  /**
   * Obtiene o crea la instancia global de Toast.
   * @param {HTMLElement} [container]
   * @returns {Toast}
   */
  static getInstance(container = null) {
    if (!Toast.#instance) {
      Toast.#instance = new Toast(container);
    } else if (container && !Toast.#instance.element.parentNode) {
      Toast.#instance.mount(container);
    }
    return Toast.#instance;
  }

  mount(container) {
    if (!container) return;
    this.container = container;
    if (!this.element.parentNode) {
      container.appendChild(this.element);
    }
  }

  /**
   * Muestra un mensaje flotante.
   * @param {string} message Mensaje a mostrar
   * @param {'info'|'success'|'warning'|'error'} [type='info']
   * @param {number} [duration=3000] Tiempo en milisegundos antes de desaparecer
   */
  show(message, type = 'info', duration = 3000) {
    if (!message) return;

    const toastItem = document.createElement('div');
    toastItem.className = `nx-toast-item nx-toast-${type}`;
    toastItem.setAttribute('role', type === 'error' ? 'alert' : 'status');

    const icon = document.createElement('span');
    icon.className = 'nx-toast-icon';
    icon.textContent = Toast.#iconForType(type);

    const text = document.createElement('span');
    text.className = 'nx-toast-message';
    text.textContent = message;

    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'nx-toast-close';
    closeBtn.setAttribute('aria-label', 'Cerrar aviso');
    closeBtn.textContent = '✕';

    toastItem.appendChild(icon);
    toastItem.appendChild(text);
    toastItem.appendChild(closeBtn);

    const dismiss = () => {
      if (toastItem.classList.contains('is-leaving')) return;
      toastItem.classList.add('is-leaving');
      setTimeout(() => {
        if (toastItem.parentNode) {
          toastItem.parentNode.removeChild(toastItem);
        }
      }, 250);
    };

    closeBtn.addEventListener('click', dismiss);

    if (duration > 0) {
      setTimeout(dismiss, duration);
    }

    this.element.appendChild(toastItem);
  }

  success(message, duration = 3000) {
    this.show(message, 'success', duration);
  }

  error(message, duration = 4000) {
    this.show(message, 'error', duration);
  }

  info(message, duration = 3000) {
    this.show(message, 'info', duration);
  }

  warning(message, duration = 3500) {
    this.show(message, 'warning', duration);
  }

  static #iconForType(type) {
    switch (type) {
      case 'success':
        return '✔';
      case 'error':
        return '✖';
      case 'warning':
        return '⚠';
      case 'info':
      default:
        return 'ℹ';
    }
  }
}
