import { GameConfig } from '../game/GameConfig.js';

/**
 * Panel de chat del asistente, en DOM sobre el canvas.
 *
 * Es DOM y no p5 por la misma razón que el resto de la interfaz: el texto
 * seleccionable, el input y el scroll los da el navegador gratis, y dibujarlos
 * en el canvas sería reimplementarlos.
 *
 * Mientras el input tiene el foco, el jugador no se mueve. No hace falta
 * desenganchar nada: KeyboardInput ya ignora los eventos cuyo destino es un
 * campo de texto y limpia las teclas presionadas al recibir el foco, así que
 * escribir "wasd" no camina ni deja teclas trabadas.
 *
 * El bot se carga la primera vez que se abre el chat, no al arrancar el juego.
 * Sus librerías (mathjs sobre todo) pesan más que todo el resto del chat junto,
 * y quien no abre el chat no tiene por qué descargarlas: el juego arranca con
 * el mismo bundle que antes.
 */
export class ChatPanel {
  #loadBot;
  #bot = null;
  #botPromise = null;
  #config;
  #messages;
  #list;
  #input;
  #form;
  #isOpen = false;

  /**
   * @param {Object} [options]
   * @param {() => Promise<Object>} [options.loadBot] carga perezosa del bot
   * @param {Object} [options.config] sección chatbot de GameConfig
   */
  constructor({ loadBot = ChatPanel.defaultLoader(), config = GameConfig.chatbot } = {}) {
    this.#loadBot = loadBot;
    this.#config = config;
    this.#messages = [];

    this.element = document.createElement('section');
    this.element.className = 'nx-chat';
    this.element.hidden = true;
    this.element.setAttribute('aria-label', `Asistente ${config.BOT_NAME}`);

    this.#buildDOM();
  }

  /**
   * Cargador por defecto: importa el bot al vuelo.
   * @param {(() => Object|null)|null} [contextProvider] estado vivo de la partida
   */
  static defaultLoader(contextProvider = null) {
    return async () => {
      const [{ ChatBot }, { GameKnowledge }] = await Promise.all([
        import('../chatbot/ChatBot.js'),
        import('../chatbot/GameKnowledge.js')
      ]);
      return new ChatBot({ gameKnowledge: new GameKnowledge({ contextProvider }) });
    };
  }

  get isOpen() {
    return this.#isOpen;
  }

  /** El bot, si ya se cargó. */
  get bot() {
    return this.#bot;
  }

  /** Mensajes mostrados, del más viejo al más nuevo. */
  get messages() {
    return [...this.#messages];
  }

  #buildDOM() {
    const header = document.createElement('header');
    header.className = 'nx-chat-header';

    const title = document.createElement('span');
    title.className = 'nx-chat-title';
    title.textContent = this.#config.BOT_NAME;

    const hint = document.createElement('span');
    hint.className = 'nx-chat-hint';
    // Solo Escape: la tecla de abrir no cierra mientras el input tiene el foco,
    // porque ahí se escribe en vez de disparar atajos.
    hint.textContent = 'Escape para cerrar';

    header.append(title, hint);

    this.#list = document.createElement('div');
    this.#list.className = 'nx-chat-log';
    this.#list.setAttribute('role', 'log');
    this.#list.setAttribute('aria-live', 'polite');

    this.#form = document.createElement('form');
    this.#form.className = 'nx-chat-form';

    this.#input = document.createElement('input');
    this.#input.type = 'text';
    this.#input.className = 'nx-chat-input';
    this.#input.placeholder = 'Preguntame algo del juego…';
    this.#input.maxLength = this.#config.MAX_QUESTION_LENGTH;
    this.#input.setAttribute('aria-label', 'Tu pregunta');
    this.#input.autocomplete = 'off';

    const send = document.createElement('button');
    send.type = 'submit';
    send.className = 'nx-chat-send';
    send.textContent = 'Enviar';

    this.#form.append(this.#input, send);
    this.element.append(header, this.#list, this.#form);

    this.#form.addEventListener('submit', (event) => {
      event.preventDefault?.();
      const question = this.#input.value;
      this.#input.value = '';
      this.submit(question);
    });

    this.element.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        event.preventDefault?.();
        this.close();
      }
    });
  }

  mount(container) {
    if (!container || this.element.parentNode) return;
    container.appendChild(this.element);
  }

  /** Carga el bot una sola vez, aunque se lo pida varias veces seguidas. */
  async ensureBot() {
    if (this.#bot) return this.#bot;
    if (!this.#botPromise) {
      this.#botPromise = Promise.resolve()
        .then(() => this.#loadBot())
        .then((bot) => {
          this.#bot = bot;
          return bot;
        })
        .catch((error) => {
          // Volver a null permite reintentar en el próximo mensaje en vez de
          // dejar el chat muerto por un fallo de red al traer el módulo.
          this.#botPromise = null;
          throw error;
        });
    }
    return this.#botPromise;
  }

  /**
   * Procesa una pregunta y agrega los dos mensajes al registro.
   * @param {string} question
   * @returns {Promise<Object|null>} la respuesta del bot, o null si no había pregunta
   */
  async submit(question) {
    const text = String(question ?? '').trim();
    if (text === '') return null;

    this.#append({ author: 'player', text });

    let bot;
    try {
      bot = await this.ensureBot();
    } catch {
      const failure = {
        author: 'bot',
        text: 'No pude cargar el asistente. Probá de nuevo en un momento.',
        isKnown: false
      };
      this.#append(failure);
      return null;
    }

    const response = bot.ask(text);
    this.#append({
      author: 'bot',
      text: response.text,
      source: response.source,
      isKnown: response.isKnown
    });
    return response;
  }

  /**
   * Abre el panel. El saludo llega cuando termina de cargar el bot, así que la
   * promesa que devuelve sirve para esperarlo en las pruebas.
   * @returns {Promise<void>}
   */
  async open() {
    if (this.#isOpen) return;
    this.#isOpen = true;
    this.element.hidden = false;

    // El puntero está capturado durante la partida: sin liberarlo no se puede
    // hacer clic en el input ni ver el cursor.
    if (typeof document !== 'undefined' && document.pointerLockElement) {
      document.exitPointerLock?.();
    }
    this.#input?.focus?.();

    if (this.#messages.length > 0) return;
    try {
      const bot = await this.ensureBot();
      if (this.#messages.length === 0) {
        this.#append({ author: 'bot', text: bot.greeting().text, isKnown: true });
      }
    } catch {
      this.#append({
        author: 'bot',
        text: 'No pude cargar el asistente. Probá de nuevo en un momento.',
        isKnown: false
      });
    }
  }

  close() {
    if (!this.#isOpen) return;
    this.#isOpen = false;
    this.element.hidden = true;
    this.#input?.blur?.();
  }

  /** @returns {Promise<void>} */
  async toggle() {
    if (this.#isOpen) {
      this.close();
      return;
    }
    await this.open();
  }

  #append(message) {
    this.#messages.push(message);
    // El tope existe para que una sesión larga no acumule miles de nodos: el
    // chat vive sobre el bucle de render y cada nodo cuesta.
    while (this.#messages.length > this.#config.MAX_HISTORY) {
      this.#messages.shift();
      this.#list.firstChild?.remove();
    }
    this.#list.appendChild(ChatPanel.#renderMessage(message));
    this.#list.scrollTop = this.#list.scrollHeight;
  }

  static #renderMessage({ author, text, source, isKnown }) {
    const item = document.createElement('div');
    item.className = `nx-chat-message nx-chat-${author}`;
    if (author === 'bot' && isKnown === false) item.classList.add('nx-chat-unsure');

    const body = document.createElement('p');
    body.className = 'nx-chat-text';
    body.textContent = text;
    item.appendChild(body);

    // La fuente se muestra siempre que exista: es lo que permite verificar el
    // dato contra el código, y lo que distingue una respuesta derivada de los
    // datos del juego de una escrita a mano.
    if (source) {
      const origin = document.createElement('p');
      origin.className = 'nx-chat-source';
      origin.textContent = `fuente: ${source}`;
      item.appendChild(origin);
    }
    return item;
  }
}
