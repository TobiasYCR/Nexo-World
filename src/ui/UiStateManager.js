import { ScreenType } from './ScreenType.js';

/**
 * Gestor centralizado del estado de la interfaz de usuario.
 * Coordina la pantalla activa, la pila de diálogos/modales,
 * la restauración de foco accesible y los estados temporales de la UI.
 */
export class UiStateManager {
  #activeScreen = null;
  #previousScreen = null;
  #activeDialog = null;
  #lastFocusedElement = null;
  #temporaryStates = new Map();
  #listeners = new Set();

  constructor(initialScreen = ScreenType.MENU) {
    this.#activeScreen = initialScreen;
  }

  get activeScreen() {
    return this.#activeScreen;
  }

  get previousScreen() {
    return this.#previousScreen;
  }

  get activeDialog() {
    return this.#activeDialog;
  }

  get isPlaying() {
    return this.#activeScreen === ScreenType.PLAYING && this.#activeDialog === null;
  }

  /**
   * Cambia la pantalla activa registrando el foco previo para posterior restauración.
   * @param {string} screenType
   */
  setActiveScreen(screenType) {
    if (this.#activeScreen === screenType) return;

    // Guardar elemento actualmente enfocado antes de cambiar
    if (typeof document !== 'undefined' && document.activeElement) {
      this.#lastFocusedElement = document.activeElement;
    }

    this.#previousScreen = this.#activeScreen;
    this.#activeScreen = screenType;
    this.#notify('screenChange', { current: screenType, previous: this.#previousScreen });
  }

  /**
   * Abre un diálogo modal de confirmación o acción.
   * @param {Object} dialogConfig
   */
  openDialog(dialogConfig) {
    if (typeof document !== 'undefined' && document.activeElement) {
      this.#lastFocusedElement = document.activeElement;
    }
    this.#activeDialog = dialogConfig;
    this.#notify('dialogOpen', dialogConfig);
  }

  /**
   * Cierra el diálogo modal activo y restaura el foco.
   */
  closeDialog() {
    const closed = this.#activeDialog;
    this.#activeDialog = null;
    this.restoreFocus();
    this.#notify('dialogClose', closed);
  }

  /**
   * Restaura el foco en el elemento previo guardado.
   */
  restoreFocus() {
    if (this.#lastFocusedElement && typeof this.#lastFocusedElement.focus === 'function') {
      try {
        this.#lastFocusedElement.focus();
      } catch (_) {
        // Ignorar si el elemento ya no está en el DOM
      }
    }
  }

  /**
   * Guarda un estado temporal en memoria.
   * @param {string} key
   * @param {*} value
   */
  setTempState(key, value) {
    this.#temporaryStates.set(key, value);
    this.#notify('tempStateChange', { key, value });
  }

  /**
   * Recupera un estado temporal.
   * @param {string} key
   * @returns {*}
   */
  getTempState(key) {
    return this.#temporaryStates.get(key);
  }

  /**
   * Limpia un estado temporal.
   * @param {string} key
   */
  clearTempState(key) {
    this.#temporaryStates.delete(key);
  }

  subscribe(listener) {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  #notify(event, data) {
    for (const listener of this.#listeners) {
      try {
        listener(event, data);
      } catch (err) {
        console.error('[UiStateManager] Error en listener:', err);
      }
    }
  }
}
