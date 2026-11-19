import { GameConfig } from '../game/GameConfig.js';
import { InputActions } from '../utils/Constants.js';
import { TouchActions } from '../input/TouchInput.js';

const svg = (body) =>
  `<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;

/** Íconos de los botones táctiles (trazos simples, sin dependencias). */
const TouchIcons = Object.freeze({
  pause: svg('<rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/>'),
  inventory: svg('<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>'),
  blueprint: svg('<path d="M3 21h18L3 3v18z"/><path d="M7 17h6L7 11v6z"/>'),
  chat: svg('<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>'),
  fullscreen: svg('<path d="M8 3H5a2 2 0 0 0-2 2v3"/><path d="M21 8V5a2 2 0 0 0-2-2h-3"/><path d="M3 16v3a2 2 0 0 0 2 2h3"/><path d="M16 21h3a2 2 0 0 0 2-2v-3"/>'),
  breakBlock: svg('<path d="m14 12-8.5 8.5a2.12 2.12 0 0 1-3-3L11 9"/><path d="M15 13 9 7l4-4 6 6-4 4z"/>'),
  placeBlock: svg('<path d="M12 2 3 7v10l9 5 9-5V7z"/><path d="m3 7 9 5 9-5"/><path d="M12 12v10"/>'),
  up: svg('<path d="m6 15 6-6 6 6"/>'),
  down: svg('<path d="m6 9 6 6 6-6"/>'),
  fly: svg('<path d="M2 12c4-1 6-5 10-5s6 4 10 5c-4 1-6 5-10 5S6 13 2 12z"/>')
});

/**
 * Controles en pantalla para celulares y tablets:
 *
 * - Joystick abajo a la izquierda para caminar (al borde, corre).
 * - Arrastrar el dedo en el resto de la pantalla para mirar.
 * - Botones abajo a la derecha: romper (mantener), colocar, saltar; volar y
 *   bajar en creativo.
 * - Arriba a la derecha: pausa, inventario, planos, asistente y pantalla
 *   completa.
 *
 * Escribe en un TouchInput (que InputManager suma al teclado y al mouse) y
 * avisa con callbacks lo que abre pantallas. Usa Pointer Events, así varios
 * dedos funcionan a la vez (caminar, mirar y romper).
 */
export class TouchControls {
  #touch = null;
  #config;
  #enabled = false;
  #visible = false;
  #callbacks;
  #lookPointer = null;
  #stickPointer = null;
  #state = { canFly: null, isFlying: null };
  #buttons = [];

  /**
   * @param {Object} [options]
   * @param {Object} [options.config] GameConfig.touch
   * @param {() => void} [options.onInventory]
   * @param {() => void} [options.onBlueprints]
   * @param {() => void} [options.onChat]
   */
  constructor({ config = GameConfig.touch, onInventory = null, onBlueprints = null, onChat = null } = {}) {
    this.#config = config;
    this.#callbacks = { onInventory, onBlueprints, onChat };
    this.#build();
  }

  /** Conecta el estado táctil del juego (InputManager.touch). */
  connect(touchInput) {
    this.#touch = touchInput;
    this.#touch?.setActive(this.#enabled);
  }

  get enabled() {
    return this.#enabled;
  }

  get isVisible() {
    return this.#visible;
  }

  /** Activa o desactiva el modo táctil (marca el body con nx-touch-mode). */
  setEnabled(enabled) {
    this.#enabled = Boolean(enabled);
    this.#touch?.setActive(this.#enabled);
    document.body?.classList?.toggle('nx-touch-mode', this.#enabled);
    this.#syncVisibility();
  }

  /** Visibles solo jugando: en menús no se ven y se suelta todo. */
  setVisible(visible) {
    this.#visible = Boolean(visible);
    this.#syncVisibility();
  }

  mount(container) {
    if (!container || this.element.parentNode) return;
    // Primero en el contenedor: el resto del HUD (barra, tutorial, plano, chat)
    // queda encima y se puede tocar.
    if (typeof container.prepend === 'function') container.prepend(this.element);
    else container.appendChild(this.element);
  }

  /**
   * Estado del jugador que cambia qué botones se ven: volar solo en creativo y
   * bajar solo volando.
   */
  sync({ canFly = false, isFlying = false } = {}) {
    if (canFly === this.#state.canFly && isFlying === this.#state.isFlying) return;
    this.#state = { canFly, isFlying };
    this.flyButton.hidden = !canFly;
    this.flyButton.classList.toggle('is-active', isFlying);
    this.flyButton.setAttribute('aria-pressed', String(isFlying));
    this.descendButton.hidden = !isFlying;
    this.jumpLabel.textContent = isFlying ? 'Subir' : 'Saltar';
    if (!isFlying) this.#touch?.release(TouchActions.DESCEND);
  }

  #syncVisibility() {
    const shown = this.#enabled && this.#visible;
    this.element.hidden = !shown;
    if (!shown) this.#releaseAll();
  }

  #releaseAll() {
    this.#lookPointer = null;
    this.#stickPointer = null;
    this.#moveKnob(0, 0);
    this.#touch?.reset();
    for (const button of this.#buttons) button.classList.remove('is-pressed');
  }

  #build() {
    this.element = document.createElement('div');
    this.element.className = 'nx-touch';
    this.element.hidden = true;

    this.lookZone = document.createElement('div');
    this.lookZone.className = 'nx-touch-look';
    this.#bindLook(this.lookZone);

    this.stick = document.createElement('div');
    this.stick.className = 'nx-touch-stick';
    this.stick.setAttribute('aria-label', 'Joystick para caminar');
    this.stickBase = document.createElement('div');
    this.stickBase.className = 'nx-touch-stick-base';
    this.stickKnob = document.createElement('div');
    this.stickKnob.className = 'nx-touch-stick-knob';
    this.stickBase.appendChild(this.stickKnob);
    this.stick.appendChild(this.stickBase);
    this.#bindStick(this.stick);

    const actions = document.createElement('div');
    actions.className = 'nx-touch-actions';
    this.breakButton = this.#holdButton('Romper', TouchIcons.breakBlock, TouchActions.BREAK, 'nx-touch-break');
    this.placeButton = this.#tapButton('Colocar', TouchIcons.placeBlock, 'nx-touch-place', () => this.#touch?.tap(TouchActions.PLACE));
    this.jumpButton = this.#holdButton('Saltar', TouchIcons.up, InputActions.JUMP, 'nx-touch-jump');
    this.jumpLabel = this.jumpButton.labelElement;
    this.descendButton = this.#holdButton('Bajar', TouchIcons.down, TouchActions.DESCEND, 'nx-touch-descend');
    this.descendButton.hidden = true;
    this.flyButton = this.#tapButton('Volar', TouchIcons.fly, 'nx-touch-fly', () => this.#touch?.tap(InputActions.TOGGLE_FLY));
    this.flyButton.hidden = true;
    for (const button of [this.flyButton, this.descendButton, this.jumpButton, this.placeButton, this.breakButton]) {
      actions.appendChild(button);
    }

    const menu = document.createElement('div');
    menu.className = 'nx-touch-menu';
    this.pauseButton = this.#tapButton('Pausa', TouchIcons.pause, 'nx-touch-pause', () => this.#touch?.tap(InputActions.PAUSE));
    this.inventoryButton = this.#tapButton('Bloques', TouchIcons.inventory, 'nx-touch-inventory', () => this.#callbacks.onInventory?.());
    this.blueprintsButton = this.#tapButton('Planos', TouchIcons.blueprint, 'nx-touch-blueprints', () => this.#callbacks.onBlueprints?.());
    this.chatButton = this.#tapButton('Ayuda', TouchIcons.chat, 'nx-touch-chat', () => this.#callbacks.onChat?.());
    this.fullscreenButton = this.#tapButton('Pantalla', TouchIcons.fullscreen, 'nx-touch-fullscreen', () => this.#toggleFullscreen());
    this.fullscreenButton.hidden = !document.fullscreenEnabled;
    for (const button of [this.fullscreenButton, this.chatButton, this.blueprintsButton, this.inventoryButton, this.pauseButton]) {
      menu.appendChild(button);
    }

    this.rotateHint = document.createElement('div');
    this.rotateHint.className = 'nx-touch-rotate';
    this.rotateHint.textContent = 'Girá el celular para jugar más cómodo';

    for (const part of [this.lookZone, this.stick, actions, menu, this.rotateHint]) this.element.appendChild(part);
  }

  #bindLook(zone) {
    zone.addEventListener('pointerdown', (event) => {
      if (this.#lookPointer) return;
      this.#lookPointer = { id: event.pointerId, x: event.clientX, y: event.clientY };
      zone.setPointerCapture?.(event.pointerId);
    });
    zone.addEventListener('pointermove', (event) => {
      const pointer = this.#lookPointer;
      if (!pointer || pointer.id !== event.pointerId) return;
      this.#touch?.addLook(event.clientX - pointer.x, event.clientY - pointer.y);
      pointer.x = event.clientX;
      pointer.y = event.clientY;
    });
    const end = (event) => {
      if (this.#lookPointer?.id === event.pointerId) this.#lookPointer = null;
    };
    zone.addEventListener('pointerup', end);
    zone.addEventListener('pointercancel', end);
  }

  #bindStick(area) {
    area.addEventListener('pointerdown', (event) => {
      event.preventDefault?.();
      if (this.#stickPointer) return;
      const rect = this.stickBase.getBoundingClientRect?.() ?? { left: 0, top: 0, width: 0, height: 0 };
      this.#stickPointer = { id: event.pointerId, cx: rect.left + rect.width / 2, cy: rect.top + rect.height / 2 };
      area.setPointerCapture?.(event.pointerId);
      this.#updateStick(event.clientX, event.clientY);
    });
    area.addEventListener('pointermove', (event) => {
      if (this.#stickPointer?.id === event.pointerId) this.#updateStick(event.clientX, event.clientY);
    });
    const end = (event) => {
      if (this.#stickPointer?.id !== event.pointerId) return;
      this.#stickPointer = null;
      this.#moveKnob(0, 0);
      this.#touch?.setMove(0, 0);
    };
    area.addEventListener('pointerup', end);
    area.addEventListener('pointercancel', end);
  }

  #updateStick(clientX, clientY) {
    const { cx, cy } = this.#stickPointer;
    const radius = this.#config.JOYSTICK_RADIUS;
    let dx = clientX - cx;
    let dy = clientY - cy;
    const distance = Math.hypot(dx, dy);
    if (distance > radius) {
      dx = (dx / distance) * radius;
      dy = (dy / distance) * radius;
    }
    this.#moveKnob(dx, dy);
    const strength = Math.min(distance, radius) / radius;
    if (strength < this.#config.JOYSTICK_DEAD_ZONE) {
      this.#touch?.setMove(0, 0);
      return;
    }
    // Pantalla: y crece hacia abajo; el juego: adelante es positivo.
    this.#touch?.setMove(dx / radius, -dy / radius);
  }

  #moveKnob(dx, dy) {
    if (this.stickKnob?.style) this.stickKnob.style.transform = `translate(${dx}px, ${dy}px)`;
  }

  #holdButton(label, icon, action, className) {
    const button = TouchControls.#button(label, icon, className);
    this.#buttons.push(button);
    button.addEventListener('pointerdown', (event) => {
      event.preventDefault?.();
      button.setPointerCapture?.(event.pointerId);
      button.classList.add('is-pressed');
      this.#touch?.press(action);
    });
    const end = () => {
      button.classList.remove('is-pressed');
      this.#touch?.release(action);
    };
    button.addEventListener('pointerup', end);
    button.addEventListener('pointercancel', end);
    return button;
  }

  /**
   * La acción va en "click" y no en "pointerdown": si el toque abre una
   * pantalla (pausa, inventario) apenas se apoya el dedo, el click que el
   * navegador manda al levantarlo cae sobre un botón de esa pantalla.
   */
  #tapButton(label, icon, className, onTap) {
    const button = TouchControls.#button(label, icon, className);
    this.#buttons.push(button);
    button.addEventListener('pointerdown', (event) => {
      event.preventDefault?.();
      button.classList.add('is-pressed');
    });
    const end = () => button.classList.remove('is-pressed');
    button.addEventListener('pointerup', end);
    button.addEventListener('pointercancel', end);
    button.addEventListener('click', (event) => {
      event.preventDefault?.();
      onTap();
    });
    return button;
  }

  async #toggleFullscreen() {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen?.();
        return;
      }
      await document.documentElement?.requestFullscreen?.({ navigationUI: 'hide' });
      // Android permite fijar la orientación en pantalla completa; iOS no.
      await globalThis.screen?.orientation?.lock?.('landscape');
    } catch {
      // Sin permiso o sin soporte: se sigue jugando igual.
    }
  }

  static #button(label, icon, className) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `nx-touch-btn ${className}`;
    button.setAttribute('aria-label', label);
    const iconSpan = document.createElement('span');
    iconSpan.className = 'nx-touch-icon';
    iconSpan.innerHTML = icon;
    const labelSpan = document.createElement('span');
    labelSpan.className = 'nx-touch-label';
    labelSpan.textContent = label;
    button.appendChild(iconSpan);
    button.appendChild(labelSpan);
    button.labelElement = labelSpan;
    return button;
  }
}
