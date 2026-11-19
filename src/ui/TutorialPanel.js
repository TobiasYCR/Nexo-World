/**
 * Tutorial para quien nunca jugó: una tarjeta arriba a la izquierda con un paso
 * por vez. Cada paso explica una cosa y avanza solo cuando el jugador la hace
 * (caminar, romper, colocar, abrir el menú, elegir un plano…), o con
 * "Siguiente". Se puede saltar un paso o el tutorial entero.
 *
 * No conoce al juego: HUD y GameUiBridge le avisan con notify(señal) y le pasan
 * la posición del jugador en update().
 */
export class TutorialPanel {
  /** Señales que completan un paso. */
  static Signals = Object.freeze({
    MOVED: 'moved',
    BLOCK_BROKEN: 'blockBroken',
    HOTBAR_CHANGED: 'hotbarChanged',
    INVENTORY_OPENED: 'inventoryOpened',
    BLOCK_PLACED: 'blockPlaced',
    PAUSE_OPENED: 'pauseOpened',
    PRESETS_OPENED: 'presetsOpened',
    CHALLENGE_STARTED: 'challengeStarted',
    CHALLENGE_COMPLETED: 'challengeCompleted',
    CHAT_OPENED: 'chatOpened'
  });

  /** Bloques que hay que caminar para completar el paso de moverse. */
  static MOVE_DISTANCE_BLOCKS = 3;

  /**
   * @param {string} chatKeyLabel tecla del chat, para mostrarla en el texto
   * @param {{touch?: boolean}} [options] touch: textos para controles táctiles
   * @returns {Array<{id:string, title:string, text:string, completeOn:string[]}>}
   */
  static defaultSteps(chatKeyLabel = 'T', { touch = false } = {}) {
    const S = TutorialPanel.Signals;
    const steps = [
      {
        id: 'welcome',
        title: 'Bienvenido a Nexo World',
        text: 'Es un mundo hecho de bloques: podés explorarlo, romper y colocar bloques, y construir siguiendo planos. Este tutorial te muestra lo básico en pocos pasos.',
        completeOn: []
      },
      {
        id: 'move',
        title: 'Mirar y caminar',
        text: 'Hacé clic sobre el juego para controlar la cámara. Mové el mouse para mirar, usá W A S D para caminar y Espacio para saltar.',
        completeOn: [S.MOVED]
      },
      {
        id: 'break',
        title: 'Romper un bloque',
        text: 'Apuntá a un bloque cercano con la cruz del centro y mantené apretado el clic izquierdo hasta que se rompa.',
        completeOn: [S.BLOCK_BROKEN]
      },
      {
        id: 'select',
        title: 'Elegir un bloque',
        text: 'La barra de abajo tiene tus bloques. Elegí uno con las teclas 1 a 9 o con la rueda del mouse. Con E abrís el inventario con todos los bloques.',
        completeOn: [S.HOTBAR_CHANGED, S.INVENTORY_OPENED]
      },
      {
        id: 'place',
        title: 'Colocar un bloque',
        text: 'Apuntá al suelo o a otro bloque y hacé clic derecho para colocar el bloque elegido.',
        completeOn: [S.BLOCK_PLACED]
      },
      {
        id: 'menu',
        title: 'El menú',
        text: 'Apretá Esc para abrir el menú: ahí podés guardar la partida, ver los controles y cambiar la configuración. Con Esc otra vez volvés al juego.',
        completeOn: [S.PAUSE_OPENED]
      },
      {
        id: 'blueprint',
        title: 'Elegir un plano',
        text: 'Apretá P para ver los planos de construcción y tocá "Empezar" en uno. La torre de piedra es la más fácil para arrancar.',
        completeOn: [S.CHALLENGE_STARTED]
      },
      {
        id: 'guide',
        title: 'Seguir la guía',
        text: 'Los bloques transparentes muestran dónde va cada pieza. Lo que tenés en la mano se ilumina y el próximo bloque tiene un marco blanco. Completá el plano.',
        completeOn: [S.CHALLENGE_COMPLETED]
      },
      {
        id: 'help',
        title: '¿Dudas?',
        text: `Apretá ${chatKeyLabel} para abrir el asistente y preguntale lo que quieras, por ejemplo "¿cómo vuelo?" o "¿dónde hay diamantes?".`,
        completeOn: [S.CHAT_OPENED]
      }
    ];
    if (!touch) return steps;
    const touchTexts = {
      move: 'Usá el joystick de la izquierda para caminar (llevalo al borde para correr) y arrastrá el dedo por el resto de la pantalla para mirar. Con el botón Saltar, saltás.',
      break: 'Apuntá a un bloque cercano con la cruz del centro y mantené apretado el botón Romper hasta que se rompa.',
      select: 'La barra de abajo tiene tus bloques: tocá uno para elegirlo. Con el botón Bloques (arriba a la derecha) ves todos.',
      place: 'Apuntá al suelo o a otro bloque con la cruz y tocá el botón Colocar.',
      menu: 'Tocá Pausa (arriba a la derecha) para abrir el menú: ahí podés guardar la partida, ver los controles y cambiar la configuración. Con "Reanudar partida" volvés al juego.',
      blueprint: 'Tocá el botón Planos para ver los planos de construcción y tocá "Empezar" en uno. La torre de piedra es la más fácil para arrancar.',
      help: 'Tocá el botón Ayuda para abrir el asistente y preguntale lo que quieras, por ejemplo "¿cómo vuelo?" o "¿dónde hay diamantes?".'
    };
    return steps.map((step) => (touchTexts[step.id] ? { ...step, text: touchTexts[step.id] } : step));
  }

  #steps;
  #index = 0;
  #active = false;
  #visible = false;
  #startPosition = null;
  #lastSelectedIndex = null;
  #onFinish;
  #chatKeyLabel;
  #customSteps;
  #touch = false;

  /**
   * @param {Object} [options]
   * @param {Array} [options.steps]
   * @param {string} [options.chatKeyLabel]
   * @param {(reason: 'completed'|'skipped') => void} [options.onFinish]
   */
  constructor({ steps = null, chatKeyLabel = 'T', onFinish = null } = {}) {
    this.#customSteps = Boolean(steps);
    this.#chatKeyLabel = chatKeyLabel;
    this.#steps = steps ?? TutorialPanel.defaultSteps(chatKeyLabel);
    this.#onFinish = onFinish;
    this.#build();
  }

  /** Con controles táctiles los textos hablan de botones y no de teclas. */
  setTouchMode(touch) {
    this.#touch = Boolean(touch);
    if (!this.#customSteps) this.#steps = TutorialPanel.defaultSteps(this.#chatKeyLabel, { touch: this.#touch });
    if (this.#active) this.#render();
  }

  get isActive() {
    return this.#active;
  }

  get stepIndex() {
    return this.#index;
  }

  get currentStep() {
    return this.#active ? this.#steps[this.#index] : null;
  }

  get stepCount() {
    return this.#steps.length;
  }

  mount(container) {
    if (container && !this.element.parentNode) container.appendChild(this.element);
  }

  /** Empieza desde el primer paso. */
  start() {
    this.#active = true;
    this.#goTo(0);
  }

  /** Visible solo mientras se juega (no sobre los menús). */
  setVisible(visible) {
    this.#visible = Boolean(visible);
    this.#syncVisibility();
  }

  next() {
    if (!this.#active) return;
    if (this.#index >= this.#steps.length - 1) {
      this.#finish('completed');
      return;
    }
    this.#goTo(this.#index + 1);
  }

  previous() {
    if (this.#active && this.#index > 0) this.#goTo(this.#index - 1);
  }

  skipAll() {
    if (this.#active) this.#finish('skipped');
  }

  /** El jugador hizo algo: si es lo que pide el paso actual, avanza. */
  notify(signal) {
    const step = this.currentStep;
    if (step && step.completeOn.includes(signal)) this.next();
  }

  /**
   * Cada frame: detecta que el jugador caminó y que cambió el bloque elegido.
   * @param {{position?: {x:number, z:number}}|null} stats
   * @param {{selectedIndex?: number}|null} hotbar
   * @param {number} blockSize
   */
  update(stats, hotbar, blockSize = 1) {
    if (!this.#active) return;
    const position = stats?.position;
    if (position) {
      if (!this.#startPosition) this.#startPosition = { x: position.x, z: position.z };
      const walked = Math.hypot(position.x - this.#startPosition.x, position.z - this.#startPosition.z) / blockSize;
      if (walked >= TutorialPanel.MOVE_DISTANCE_BLOCKS) this.notify(TutorialPanel.Signals.MOVED);
    }
    const selected = hotbar?.selectedIndex;
    if (Number.isInteger(selected)) {
      if (this.#lastSelectedIndex !== null && selected !== this.#lastSelectedIndex) {
        this.notify(TutorialPanel.Signals.HOTBAR_CHANGED);
      }
      this.#lastSelectedIndex = selected;
    }
  }

  #goTo(index) {
    this.#index = index;
    // Cada paso mide su propio recorrido y su propio cambio de bloque.
    this.#startPosition = null;
    this.#lastSelectedIndex = null;
    this.#render();
    this.#syncVisibility();
  }

  #finish(reason) {
    this.#active = false;
    this.#syncVisibility();
    this.#onFinish?.(reason);
  }

  #syncVisibility() {
    this.element.hidden = !(this.#active && this.#visible);
  }

  #build() {
    this.element = document.createElement('section');
    this.element.className = 'hud-tutorial';
    this.element.setAttribute('aria-live', 'polite');
    this.element.setAttribute('aria-label', 'Tutorial');
    this.element.hidden = true;

    const header = document.createElement('div');
    header.className = 'hud-tutorial-header';
    this.progressElement = document.createElement('span');
    this.progressElement.className = 'hud-tutorial-progress';
    this.skipAllButton = TutorialPanel.#button('Saltar tutorial', 'hud-tutorial-skip-all', () => this.skipAll());
    header.appendChild(this.progressElement);
    header.appendChild(this.skipAllButton);

    this.titleElement = document.createElement('h3');
    this.titleElement.className = 'hud-tutorial-title';
    this.textElement = document.createElement('p');
    this.textElement.className = 'hud-tutorial-text';

    const actions = document.createElement('div');
    actions.className = 'hud-tutorial-actions';
    this.previousButton = TutorialPanel.#button('‹ Anterior', 'hud-tutorial-previous', () => this.previous());
    this.nextButton = TutorialPanel.#button('Siguiente ›', 'hud-tutorial-next', () => this.next());
    actions.appendChild(this.previousButton);
    actions.appendChild(this.nextButton);

    this.element.appendChild(header);
    this.element.appendChild(this.titleElement);
    this.element.appendChild(this.textElement);
    this.element.appendChild(actions);
  }

  #render() {
    const step = this.#steps[this.#index];
    const last = this.#index === this.#steps.length - 1;
    this.progressElement.textContent = `Paso ${this.#index + 1} de ${this.#steps.length}`;
    this.titleElement.textContent = step.title;
    this.textElement.textContent = step.text;
    this.previousButton.hidden = this.#index === 0;
    // Un paso con acción se puede saltar; uno de lectura solo se lee.
    const label = last ? 'Terminar' : step.completeOn.length > 0 ? 'Saltar paso' : 'Siguiente';
    // Con teclado, Enter avanza (el mouse está capturado); en pantalla táctil se toca.
    this.nextButton.textContent = this.#touch ? label : `${label} (Enter)`;
  }

  static #button(text, className, onClick) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `hud-tutorial-btn ${className}`;
    button.textContent = text;
    button.addEventListener('click', (event) => {
      event?.stopPropagation?.();
      onClick();
    });
    return button;
  }
}
