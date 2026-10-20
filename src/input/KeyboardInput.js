/**
 * Estado crudo del teclado. Traduce códigos físicos (KeyboardEvent.code) a un
 * conjunto de teclas presionadas; no conoce acciones ni lógica de juego.
 */
export class KeyboardInput {
  #pressed = new Set();
  #justPressed = new Set();
  #target = null;

  #isTextInput(target) {
    if (!target) return false;
    const tagName = target.tagName;
    return tagName === 'INPUT' || tagName === 'TEXTAREA' || Boolean(target.isContentEditable);
  }

  #handleKeyDown = (event) => {
    if (this.#isTextInput(event.target)) return;
    if (!this.#pressed.has(event.code)) this.#justPressed.add(event.code);
    this.#pressed.add(event.code);
  };

  #handleKeyUp = (event) => {
    if (this.#isTextInput(event.target)) return;
    this.#pressed.delete(event.code);
  };

  /** Perder el foco deja teclas "trabadas" si no se limpia el estado. */
  #handleBlur = () => {
    this.#pressed.clear();
    this.#justPressed.clear();
  };

  #handleFocusIn = (event) => {
    if (this.#isTextInput(event.target)) {
      this.#pressed.clear();
      this.#justPressed.clear();
    }
  };

  attach(target = window) {
    this.detach();
    this.#target = target;
    target.addEventListener('keydown', this.#handleKeyDown);
    target.addEventListener('keyup', this.#handleKeyUp);
    target.addEventListener('blur', this.#handleBlur);
    target.addEventListener?.('focusin', this.#handleFocusIn);
  }

  detach() {
    if (!this.#target) return;
    this.#target.removeEventListener('keydown', this.#handleKeyDown);
    this.#target.removeEventListener('keyup', this.#handleKeyUp);
    this.#target.removeEventListener('blur', this.#handleBlur);
    this.#target.removeEventListener?.('focusin', this.#handleFocusIn);
    this.#target = null;
  }

  isDown(code) {
    return this.#pressed.has(code);
  }

  wasJustPressed(code) {
    return this.#justPressed.has(code);
  }

  pressedCodes() {
    return [...this.#pressed];
  }

  justPressedCodes() {
    return [...this.#justPressed];
  }

  /** Debe llamarse al final de cada frame para que los "just pressed" duren un frame. */
  endFrame() {
    this.#justPressed.clear();
  }
}
