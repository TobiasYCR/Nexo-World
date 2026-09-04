import { MouseButtons } from '../utils/Constants.js';

/**
 * Estado crudo del mouse, incluido el acumulado de movimiento relativo.
 * Deja lista la integración con Pointer Lock: mientras el puntero está bloqueado
 * se usan movementX/movementY, que es lo que necesita la vista en primera persona.
 */
export class MouseInput {
  #buttons = new Set();
  #justPressed = new Set();
  #deltaX = 0;
  #deltaY = 0;
  #wheelDelta = 0;
  #element = null;
  #pointerLocked = false;

  #handleMouseMove = (event) => {
    this.#deltaX += event.movementX ?? 0;
    this.#deltaY += event.movementY ?? 0;
  };

  #handleMouseDown = (event) => {
    if (!this.#buttons.has(event.button)) this.#justPressed.add(event.button);
    this.#buttons.add(event.button);
  };

  #handleMouseUp = (event) => {
    this.#buttons.delete(event.button);
  };

  #handleWheel = (event) => {
    this.#wheelDelta += event.deltaY;
  };

  /** El menú contextual rompe el clic derecho, que el juego usará para colocar bloques. */
  #handleContextMenu = (event) => {
    event.preventDefault();
  };

  #handlePointerLockChange = () => {
    this.#pointerLocked = document.pointerLockElement === this.#element;
    this.#deltaX = 0;
    this.#deltaY = 0;
  };

  attach(element) {
    this.detach();
    this.#element = element;

    element.addEventListener('mousemove', this.#handleMouseMove);
    element.addEventListener('mousedown', this.#handleMouseDown);
    element.addEventListener('contextmenu', this.#handleContextMenu);
    element.addEventListener('wheel', this.#handleWheel, { passive: true });
    window.addEventListener('mouseup', this.#handleMouseUp);
    document.addEventListener('pointerlockchange', this.#handlePointerLockChange);
  }

  detach() {
    if (!this.#element) return;
    this.#element.removeEventListener('mousemove', this.#handleMouseMove);
    this.#element.removeEventListener('mousedown', this.#handleMouseDown);
    this.#element.removeEventListener('contextmenu', this.#handleContextMenu);
    this.#element.removeEventListener('wheel', this.#handleWheel);
    window.removeEventListener('mouseup', this.#handleMouseUp);
    document.removeEventListener('pointerlockchange', this.#handlePointerLockChange);
    this.#element = null;
  }

  get isPointerLocked() {
    return this.#pointerLocked;
  }

  /** El navegador exige que Pointer Lock se dispare desde un gesto del usuario. */
  requestPointerLock() {
    this.#element?.requestPointerLock?.();
  }

  exitPointerLock() {
    if (this.#pointerLocked) document.exitPointerLock?.();
  }

  isButtonDown(button) {
    return this.#buttons.has(button);
  }

  wasButtonJustPressed(button) {
    return this.#justPressed.has(button);
  }

  get leftJustPressed() {
    return this.wasButtonJustPressed(MouseButtons.LEFT);
  }

  get rightJustPressed() {
    return this.wasButtonJustPressed(MouseButtons.RIGHT);
  }

  get deltaX() {
    return this.#deltaX;
  }

  get deltaY() {
    return this.#deltaY;
  }

  get wheelDelta() {
    return this.#wheelDelta;
  }

  /** Los deltas son acumulados por frame: se limpian al cerrar el frame. */
  endFrame() {
    this.#deltaX = 0;
    this.#deltaY = 0;
    this.#wheelDelta = 0;
    this.#justPressed.clear();
  }
}
