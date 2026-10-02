import { KeyboardInput } from './KeyboardInput.js';
import { MouseInput } from './MouseInput.js';
import { GameConfig } from '../game/GameConfig.js';
import { MouseButtons } from '../utils/Constants.js';

/**
 * Fachada de entrada del juego. Traduce teclas y botones crudos a ACCIONES
 * lógicas usando el mapa de GameConfig. No contiene lógica de mundo: solo
 * detecta entradas y las expone para que otros sistemas decidan qué hacer.
 */
export class InputManager {
  constructor(config = GameConfig.input) {
    this.config = config;
    this.keyboard = new KeyboardInput();
    this.mouse = new MouseInput();

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
    return (this.actionToKeys.get(action) ?? []).some((code) => this.keyboard.isDown(code));
  }

  wasActionJustPressed(action) {
    return (this.actionToKeys.get(action) ?? []).some((code) => this.keyboard.wasJustPressed(code));
  }

  /** Eje en [-1, 1] a partir de dos acciones opuestas. */
  axis(negativeAction, positiveAction) {
    return (this.isActionDown(positiveAction) ? 1 : 0) - (this.isActionDown(negativeAction) ? 1 : 0);
  }

  /**
   * Pedido de romper bloque en este frame (borde de subida del clic izquierdo).
   * El input solo expone la intención; decidir qué hacer es del orquestador.
   */
  wasBreakRequested() {
    return this.mouse.leftJustPressed;
  }

  isBreakDown() {
    return this.mouse.isButtonDown(MouseButtons.LEFT);
  }

  /**
   * Pedido de colocar bloque en este frame (borde de subida del clic derecho).
   */
  wasPlaceRequested() {
    return this.mouse.rightJustPressed;
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

  get lookDeltaX() {
    return this.mouse.deltaX;
  }

  get lookDeltaY() {
    return this.mouse.deltaY;
  }

  get isPointerLocked() {
    return this.mouse.isPointerLocked;
  }

  /** Cierra el frame de entrada. Game lo llama después de que todos los sistemas leyeron. */
  endFrame() {
    this.keyboard.endFrame();
    this.mouse.endFrame();
  }
}
