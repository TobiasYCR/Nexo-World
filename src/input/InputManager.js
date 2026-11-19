import { KeyboardInput } from './KeyboardInput.js';
import { MouseInput } from './MouseInput.js';
import { TouchInput, TouchActions } from './TouchInput.js';
import { GameConfig } from '../game/GameConfig.js';
import { InputActions, MouseButtons } from '../utils/Constants.js';

/**
 * Fachada de entrada del juego. Traduce teclas y botones crudos a ACCIONES
 * lógicas usando el mapa de GameConfig. No contiene lógica de mundo: solo
 * detecta entradas y las expone para que otros sistemas decidan qué hacer.
 *
 * Teclado/mouse y controles táctiles se suman: cualquiera de los dos mueve,
 * mira, rompe o coloca.
 */
export class InputManager {
  constructor(config = GameConfig.input, touchConfig = GameConfig.touch) {
    this.config = config;
    this.touchConfig = touchConfig;
    this.keyboard = new KeyboardInput();
    this.mouse = new MouseInput();
    this.touch = new TouchInput();

    /** Mapa inverso acción -> teclas, construido una sola vez. */
    this.actionToKeys = new Map();
    for (const [code, action] of Object.entries(config.KEY_BINDINGS)) {
      if (!this.actionToKeys.has(action)) this.actionToKeys.set(action, []);
      this.actionToKeys.get(action).push(code);
    }
  }

  attach(canvasElement, keyboardTarget = window) {
    this.keyboard.attach(keyboardTarget);
    this.mouse.attach(canvasElement);
  }

  detach() {
    this.keyboard.detach();
    this.mouse.detach();
  }

  isActionDown(action) {
    return (this.actionToKeys.get(action) ?? []).some((code) => this.keyboard.isDown(code)) || this.touch.isDown(action);
  }

  wasActionJustPressed(action) {
    return (this.actionToKeys.get(action) ?? []).some((code) => this.keyboard.wasJustPressed(code)) ||
      this.touch.wasJustPressed(action);
  }

  /** Eje en [-1, 1] a partir de dos acciones opuestas. Las teclas mandan sobre el joystick. */
  axis(negativeAction, positiveAction) {
    const keys = (this.isActionDown(positiveAction) ? 1 : 0) - (this.isActionDown(negativeAction) ? 1 : 0);
    return keys !== 0 ? keys : this.touch.axis(negativeAction, positiveAction);
  }

  /** Correr: Shift, o el joystick llevado al borde. */
  isSprintRequested() {
    return this.isActionDown(InputActions.SPRINT) || this.touch.isStickSprinting;
  }

  /**
   * Volando: subir (+1) o bajar (-1). En teclado, Espacio y Shift; en pantalla
   * táctil, los botones de saltar y bajar (el joystick al borde no baja).
   */
  flyVerticalAxis() {
    const up = this.isActionDown(InputActions.JUMP) ? 1 : 0;
    const down = this.isActionDown(InputActions.SPRINT) || this.touch.isDown(TouchActions.DESCEND) ? 1 : 0;
    return up - down;
  }

  /**
   * El jugador controla la vista y las acciones: mouse capturado o controles
   * táctiles activos.
   */
  get hasControl() {
    return this.mouse.isPointerLocked || this.touch.isActive;
  }

  /**
   * Pedido de romper bloque en este frame (borde de subida del clic izquierdo).
   * El input solo expone la intención; decidir qué hacer es del orquestador.
   */
  wasBreakRequested() {
    return this.mouse.leftJustPressed || this.touch.wasJustPressed(TouchActions.BREAK);
  }

  /** Indica si el botón izquierdo (o el de romper) sigue presionado en este frame. */
  isBreakDown() {
    return this.mouse.isButtonDown(MouseButtons.LEFT) || this.touch.isDown(TouchActions.BREAK);
  }

  /**
   * Pedido de colocar bloque en este frame (borde de subida del clic derecho o
   * toque del botón de colocar).
   */
  wasPlaceRequested() {
    return this.mouse.rightJustPressed || this.touch.wasJustPressed(TouchActions.PLACE);
  }

  /** Índice de slot de hotbar solicitado con las teclas 1-9, o -1 si no hubo pedido. */
  requestedHotbarSlot() {
    for (let slot = 1; slot <= 9; slot += 1) {
      if (this.keyboard.wasJustPressed(`${this.config.HOTBAR_KEY_PREFIX}${slot}`)) return slot - 1;
    }
    return -1;
  }

  /** Dirección de desplazamiento de la rueda para selección cíclica, o 0. */
  requestedHotbarCycle() {
    return Math.sign(this.mouse.wheelDelta);
  }

  /** Movimiento de la vista: mouse capturado más arrastre táctil (escalado). */
  get lookDeltaX() {
    return (this.mouse.isPointerLocked ? this.mouse.deltaX : 0) + this.touch.lookDeltaX * this.#touchLookScale;
  }

  get lookDeltaY() {
    return (this.mouse.isPointerLocked ? this.mouse.deltaY : 0) + this.touch.lookDeltaY * this.#touchLookScale;
  }

  get #touchLookScale() {
    return this.touchConfig?.LOOK_SCALE ?? 1;
  }

  get isPointerLocked() {
    return this.mouse.isPointerLocked;
  }

  /** Cierra el frame de entrada. Game lo llama después de que todos los sistemas leyeron. */
  endFrame() {
    this.keyboard.endFrame();
    this.mouse.endFrame();
    this.touch.endFrame();
  }
}
