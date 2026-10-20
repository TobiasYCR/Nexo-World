/**
 * Bus de intenciones desacoplado de la interfaz.
 * Permite que los componentes y pantallas emitan intenciones de usuario
 * sin tener conocimiento directo del motor de juego ni de otros subsistemas.
 */
export class IntentBus {
  static Events = Object.freeze({
    START_GAME: 'intent:startGame',
    RESUME_GAME: 'intent:resumeGame',
    PAUSE_GAME: 'intent:pauseGame',
    BACK_TO_MENU: 'intent:backToMenu',
    OPEN_SCREEN: 'intent:openScreen',
    CLOSE_SCREEN: 'intent:closeScreen',
    GO_BACK: 'intent:goBack',
    TOGGLE_DEBUG: 'intent:toggleDebug',
    SET_HOTBAR_SLOT: 'intent:setHotbarSlot',
    SET_HOTBAR_BLOCK: 'intent:setHotbarBlock',
    SETTINGS_CHANGED: 'intent:settingsChanged',
    RESTORE_DEFAULTS: 'intent:restoreDefaults',
    SAVE_GAME: 'intent:saveGame',
    LOAD_GAME: 'intent:loadGame',
    DELETE_WORLD: 'intent:deleteWorld',
    CREATE_WORLD: 'intent:createWorld',
    SHOW_TOAST: 'intent:showToast',
    AUTH_STATE_CHANGED: 'intent:authStateChanged',
    AUTH_SESSION_EXPIRED: 'intent:authSessionExpired',
    LOGIN_REQUESTED: 'intent:loginRequested',
    LOGOUT_REQUESTED: 'intent:logoutRequested'
  });

  #listeners = new Map();

  /**
   * Suscribe un listener a un evento de intención.
   * @param {string} event
   * @param {Function} callback
   * @returns {Function} Función para desuscribir el listener.
   */
  on(event, callback) {
    if (typeof callback !== 'function') {
      throw new TypeError(`El listener para "${event}" debe ser una función.`);
    }

    if (!this.#listeners.has(event)) {
      this.#listeners.set(event, new Set());
    }
    this.#listeners.get(event).add(callback);

    return () => this.off(event, callback);
  }

  /**
   * Desuscribe un listener previamente registrado.
   * @param {string} event
   * @param {Function} callback
   */
  off(event, callback) {
    const set = this.#listeners.get(event);
    if (set) {
      set.delete(callback);
      if (set.size === 0) {
        this.#listeners.delete(event);
      }
    }
  }

  /**
   * Emite una intención hacia todos los suscriptores.
   * @param {string} event
   * @param {*} [payload]
   */
  emit(event, payload = undefined) {
    const set = this.#listeners.get(event);
    if (!set) return;

    for (const callback of set) {
      try {
        callback(payload);
      } catch (err) {
        console.error(`[IntentBus] Error al procesar evento "${event}":`, err);
      }
    }
  }

  /** Limpia todos los listeners. */
  clear() {
    this.#listeners.clear();
  }
}
