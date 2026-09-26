import { Icons } from './Icons.js';

/**
 * Sistema de notificaciones Toast accesibles y no bloqueantes.
 * Reemplaza los diálogos invasivos tipo alert() con avisos temporales.
 */
export class Toast {
  #container = null;
  #activeToasts = new Set();

  /**
   * @param {HTMLElement} [parentContainer] Contenedor padre donde se monta la bandeja de toasts
   */
  constructor(parentContainer = null) {
    this.parentContainer = parentContainer;
    this.#ensureContainer();
  }

  #ensureContainer() {
    if (this.#container && this.#container.parentNode) return;

    if (typeof document === 'undefined') return;

    let existing = typeof document.querySelector === 'function' ? document.querySelector('.nx-toast-container') : null;
    if (existing) {
      this.#container = existing;
      return;
    }

    this.#container = document.createElement('div');
    this.#container.className = 'nx-toast-container';
    this.#container.setAttribute?.('role', 'region');
    this.#container.setAttribute?.('aria-label', 'Notificaciones');

    const mountTarget = this.parentContainer || (typeof document.getElementById === 'function' ? document.getElementById('ui-root') : null) || document.body;
    if (mountTarget?.appendChild) {
      mountTarget.appendChild(this.#container);
    }
  }

  /**
   * Muestra un mensaje temporal.
   * @param {string} message
   * @param {'info'|'success'|'error'} [type]
   * @param {number} [durationMs]
   * @returns {HTMLElement|null}
   */
  show(message, type = 'info', durationMs = 3000) {
    if (!message || typeof document === 'undefined') return null;
    this.#ensureContainer();
    if (!this.#container) return null;

    const toast = document.createElement('div');
    toast.className = `nx-toast nx-toast-${type} is-${type}`;
    toast.setAttribute?.('role', type === 'error' ? 'alert' : 'status');
    toast.setAttribute?.('aria-live', type === 'error' ? 'assertive' : 'polite');

    const iconSpan = document.createElement('span');
    iconSpan.className = 'nx-toast-icon';
    iconSpan.innerHTML = type === 'success' ? Icons.SUCCESS : (type === 'error' ? Icons.ERROR : Icons.INFO);

    const textSpan = document.createElement('span');
    textSpan.className = 'nx-toast-message';
    textSpan.textContent = String(message);

    toast.appendChild(iconSpan);
    toast.appendChild(textSpan);

    this.#container.appendChild(toast);
    this.#activeToasts.add(toast);

    const removeToast = () => {
      if (!this.#activeToasts.has(toast)) return;
      this.#activeToasts.delete(toast);
      if (toast.classList?.add) {
        toast.classList.add('is-leaving');
      }
      setTimeout(() => {
        if (toast.parentNode) {
          toast.parentNode.removeChild(toast);
        }
      }, 250);
    };

    if (durationMs > 0) {
      setTimeout(removeToast, durationMs);
    }

    return toast;
  }

  success(message, durationMs = 3000) {
    return this.show(message, 'success', durationMs);
  }

  error(message, durationMs = 4000) {
    return this.show(message, 'error', durationMs);
  }

  info(message, durationMs = 3000) {
    return this.show(message, 'info', durationMs);
  }

  clear() {
    for (const toast of this.#activeToasts) {
      if (toast.parentNode) {
        toast.parentNode.removeChild(toast);
      }
    }
    this.#activeToasts.clear();
  }
}
