import { ScreenType } from './ScreenType.js';
import { UiStateManager } from './UiStateManager.js';

/**
 * Gestor de navegación y ciclo de vida de pantallas de Nexo World.
 * Mantiene una sola pantalla activa a la vez, gestiona el historial de navegación,
 * coordina la liberación/captura de puntero, eventos del DOM y restauración de foco.
 */
export class ScreenManager {
  /**
   * @param {HTMLElement} container Contenedor donde se montan las pantallas (#ui-root)
   * @param {import('./IntentBus.js').IntentBus} [intentBus]
   * @param {UiStateManager} [stateManager]
   */
  constructor(container, intentBus = null, stateManager = null) {
    this.container = container;
    this.intentBus = intentBus;
    this.stateManager = stateManager || new UiStateManager();
    this.screens = new Map();
    this.history = [];
    this.currentScreenType = null;
    this.currentScreen = null;
    this.listeners = new Set();
    this.#lastFocusedElement = null;
  }

  #lastFocusedElement = null;

  /**
   * Registra una pantalla en el gestor.
   * @param {string} screenType Tipo de pantalla (de ScreenType)
   * @param {import('./Screen.js').Screen} screenInstance
   */
  register(screenType, screenInstance) {
    if (!screenType || !screenInstance) {
      throw new Error('register requiere screenType y una instancia válida de Screen.');
    }
    screenInstance.screenManager = this;
    if (this.intentBus && !screenInstance.intentBus) {
      screenInstance.intentBus = this.intentBus;
    }
    this.screens.set(screenType, screenInstance);

    if (this.container) {
      screenInstance.mount(this.container);
    }
    return screenInstance;
  }

  /**
   * Obtiene la instancia de una pantalla registrada.
   * @param {string} screenType
   * @returns {import('./Screen.js').Screen | undefined}
   */
  get(screenType) {
    return this.screens.get(screenType);
  }

  /**
   * Indica si hay una pantalla u overlay activa bloqueando la vista de juego.
   * @returns {boolean}
   */
  get hasActiveOverlay() {
    return this.currentScreenType !== null && this.currentScreenType !== ScreenType.PLAYING;
  }

  /**
   * Navega a una pantalla específica.
   * @param {string} screenType
   * @param {Object} [params]
   */
  open(screenType, params = {}) {
    if (this.currentScreenType === screenType) return;

    // Guardar foco previo
    if (typeof document !== 'undefined' && document.activeElement) {
      this.#lastFocusedElement = document.activeElement;
    }

    const previousType = this.currentScreenType;

    // Si pasamos de una pantalla con overlay a otra pantalla, registrar en historial
    if (previousType && previousType !== ScreenType.PLAYING && screenType !== ScreenType.PLAYING) {
      this.history.push(previousType);
    } else if (previousType === ScreenType.PLAYING && screenType !== ScreenType.PLAYING) {
      this.history = [ScreenType.PLAYING]; // Inicia historial volviendo a la partida
    }

    // Ocultar pantalla previa
    if (this.currentScreen) {
      this.currentScreen.hide();
      this.currentScreen = null;
    }

    this.currentScreenType = screenType;
    this.stateManager?.setActiveScreen(screenType);

    // Si es modo juego directo (sin overlay)
    if (screenType === ScreenType.PLAYING) {
      this.history = [];
      this.#updateContainerState(false);
      this.#notifyChange(ScreenType.PLAYING, previousType);
      return;
    }

    // Liberar puntero de mouse para poder interactuar con la interfaz
    if (typeof document !== 'undefined' && document.exitPointerLock) {
      try {
        document.exitPointerLock();
      } catch (_) {
        // Ignorar si no está capturado
      }
    }

    this.#updateContainerState(true);

    const targetScreen = this.screens.get(screenType);
    if (targetScreen) {
      this.currentScreen = targetScreen;
      targetScreen.show(params);
    } else {
      console.warn(`[ScreenManager] No hay pantalla registrada para "${screenType}".`);
    }

    this.#notifyChange(screenType, previousType);
  }

  /**
   * Regresa a la pantalla anterior del historial o a la pantalla base.
   */
  back() {
    if (this.currentScreenType === ScreenType.PAUSE || this.currentScreenType === ScreenType.INVENTORY) {
      this.open(ScreenType.PLAYING);
      return;
    }
    if (this.history.length > 0) {
      const prev = this.history.pop();
      this.#openWithoutHistory(prev);
    } else if (this.currentScreenType !== ScreenType.MENU) {
      this.open(ScreenType.MENU);
    }
  }

  #openWithoutHistory(screenType, params = {}) {
    const previousType = this.currentScreenType;
    if (this.currentScreen) {
      this.currentScreen.hide();
      this.currentScreen = null;
    }

    this.currentScreenType = screenType;
    this.stateManager?.setActiveScreen(screenType);

    if (screenType === ScreenType.PLAYING) {
      this.#updateContainerState(false);
      this.#notifyChange(ScreenType.PLAYING, previousType);
      return;
    }

    this.#updateContainerState(true);
    const targetScreen = this.screens.get(screenType);
    if (targetScreen) {
      this.currentScreen = targetScreen;
      targetScreen.show(params);
    }
    this.#notifyChange(screenType, previousType);
  }

  #updateContainerState(hasOverlay) {
    if (!this.container) return;
    if (hasOverlay) {
      if (this.container.classList?.add) {
        this.container.classList.add('has-active-screen');
      }
    } else {
      if (this.container.classList?.remove) {
        this.container.classList.remove('has-active-screen');
      }
    }
  }

  #notifyChange(current, previous) {
    for (const listener of this.listeners) {
      try {
        listener(current, previous);
      } catch (err) {
        console.error('[ScreenManager] Error en listener onChange:', err);
      }
    }
  }

  /**
   * Suscribe a cambios de pantalla activa.
   * @param {Function} listener
   * @returns {Function} Función para desuscribir.
   */
  onChange(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}
