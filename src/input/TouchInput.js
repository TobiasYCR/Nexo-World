import { InputActions } from '../utils/Constants.js';

/** Acciones que solo existen en los controles táctiles. */
export const TouchActions = Object.freeze({
  /** Mantener apretado: romper el bloque apuntado. */
  BREAK: 'touchBreak',
  /** Tocar: colocar el bloque de la mano. */
  PLACE: 'touchPlace',
  /** Volando: bajar (en teclado es Shift). */
  DESCEND: 'touchDescend'
});

/**
 * Estado de los controles táctiles, sin DOM: TouchControls (la interfaz) lo
 * escribe e InputManager lo lee junto con teclado y mouse. Así PlayerController
 * y Game no saben si el jugador usa teclado o pantalla táctil.
 *
 * - Joystick: un eje analógico (x = derecha, y = adelante) en [-1, 1].
 * - Mirar: deltas en píxeles acumulados en el frame, como los del mouse.
 * - Botones: acciones mantenidas y "recién apretadas" (duran un frame).
 */
export class TouchInput {
  /** Con el joystick casi al borde se corre. */
  static SPRINT_THRESHOLD = 0.92;

  #active = false;
  #moveX = 0;
  #moveY = 0;
  #lookX = 0;
  #lookY = 0;
  #down = new Set();
  #justPressed = new Set();

  /** Los controles táctiles están en uso (pantalla táctil y jugando). */
  get isActive() {
    return this.#active;
  }

  setActive(active) {
    this.#active = Boolean(active);
    if (!this.#active) this.reset();
  }

  /**
   * @param {number} x derecha positiva
   * @param {number} y adelante positivo
   */
  setMove(x, y) {
    const length = Math.hypot(x, y);
    const scale = length > 1 ? 1 / length : 1;
    this.#moveX = x * scale;
    this.#moveY = y * scale;
  }

  get moveX() {
    return this.#moveX;
  }

  get moveY() {
    return this.#moveY;
  }

  /** Joystick llevado al borde: correr. */
  get isStickSprinting() {
    return Math.hypot(this.#moveX, this.#moveY) >= TouchInput.SPRINT_THRESHOLD;
  }

  addLook(deltaX, deltaY) {
    this.#lookX += deltaX;
    this.#lookY += deltaY;
  }

  get lookDeltaX() {
    return this.#lookX;
  }

  get lookDeltaY() {
    return this.#lookY;
  }

  press(action) {
    if (!this.#down.has(action)) this.#justPressed.add(action);
    this.#down.add(action);
  }

  release(action) {
    this.#down.delete(action);
  }

  /** Apretar y soltar en el mismo gesto (colocar, abrir el menú…). */
  tap(action) {
    this.press(action);
    this.release(action);
  }

  isDown(action) {
    return this.#down.has(action);
  }

  wasJustPressed(action) {
    return this.#justPressed.has(action);
  }

  /**
   * Valor del joystick para un par de acciones opuestas de movimiento; 0 para
   * cualquier otro par.
   */
  axis(negativeAction, positiveAction) {
    if (negativeAction === InputActions.MOVE_BACKWARD && positiveAction === InputActions.MOVE_FORWARD) return this.#moveY;
    if (negativeAction === InputActions.MOVE_LEFT && positiveAction === InputActions.MOVE_RIGHT) return this.#moveX;
    return 0;
  }

  /** Suelta todo: al salir del juego o al perder el foco no queda nada trabado. */
  reset() {
    this.#moveX = 0;
    this.#moveY = 0;
    this.#lookX = 0;
    this.#lookY = 0;
    this.#down.clear();
    this.#justPressed.clear();
  }

  endFrame() {
    this.#lookX = 0;
    this.#lookY = 0;
    this.#justPressed.clear();
  }
}
