import { GameStates } from '../../game/GameState.js';

/**
 * PARCHE TEMPORAL — borrar cuando Game escuche el IntentBus directamente.
 *
 * Hoy no existe ningún método público para pausar/reanudar el motor: la
 * única vía es la tecla mapeada a PAUSE (ver GameConfig.input.KEY_BINDINGS).
 * Mientras tanto, este puente:
 *   1) observa el estado del motor a través de las stats que Game ya le pasa
 *      a HUD.update() en cada frame (notifyState), y avisa cuando cambia;
 *   2) traduce intenciones de la UI en la tecla ya mapeada, simulando su
 *      pulsación (resumeIfPaused / pauseIfRunning);
 *   3) pide/libera el Pointer Lock directamente sobre el canvas del DOM,
 *      ya que HUD no tiene una referencia al InputManager del motor.
 *
 * Nada de esto importa ni modifica archivos de src/game/ ni src/input/: solo
 * lee el enum de estados (contrato ya público) y dispara eventos DOM estándar.
 */
export class EngineBridge {
  // Game.start() deja el estado en RUNNING antes de que llegue el primer
  // frame, así que arrancamos asumiendo eso para no disparar una transición
  // falsa en el primer notifyState().
  #lastKnownState = GameStates.RUNNING;
  #stateChangeListeners = new Set();

  notifyState(state) {
    if (state === this.#lastKnownState) return;
    const previous = this.#lastKnownState;
    this.#lastKnownState = state;
    for (const listener of this.#stateChangeListeners) listener(state, previous);
  }

  /** @returns {() => void} función para desuscribirse */
  onStateChange(listener) {
    this.#stateChangeListeners.add(listener);
    return () => this.#stateChangeListeners.delete(listener);
  }

  get isPaused() {
    return this.#lastKnownState === GameStates.PAUSED;
  }

  resumeIfPaused() {
    if (this.isPaused) this.#dispatchPauseKey();
  }

  pauseIfRunning() {
    if (!this.isPaused) this.#dispatchPauseKey();
  }

  /** Requiere gesto del usuario: llamar solo desde un handler de click real. */
  requestPointerLock() {
    const canvas = document.querySelector?.('#game-root canvas');
    canvas?.requestPointerLock?.();
  }

  releasePointerLock() {
    document.exitPointerLock?.();
  }

  /** Simula la tecla de pausa ya mapeada en GameConfig.input.KEY_BINDINGS. */
  #dispatchPauseKey() {
    if (typeof window?.dispatchEvent !== 'function') return;
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Escape' }));
    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'Escape' }));
  }
}
