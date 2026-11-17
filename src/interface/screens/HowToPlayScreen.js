import { Screen } from '../../ui/Screen.js';
import { ScreenType } from '../../ui/ScreenType.js';
import { Modal } from '../components/Modal.js';
import { Button } from '../components/Button.js';
import { GameConfig } from '../../game/GameConfig.js';
import { KeyNames } from '../../chatbot/KeyNames.js';

/**
 * "¿Cómo jugar?": diapositivas con capturas del juego y una explicación corta.
 * Se pasan con las flechas (botones o teclado ← →) o con los puntos de abajo.
 * Las imágenes están en assets/images/how-to-play/.
 */
export class HowToPlayScreen extends Screen {
  static IMAGE_BASE_PATH = '/images/how-to-play/';

  /**
   * @param {string} chatKeyLabel tecla del asistente, para mostrarla en el texto
   * @returns {Array<{image:string, title:string, text:string}>}
   */
  static defaultSlides(chatKeyLabel = 'T') {
    return [
      {
        image: 'mover.jpg',
        title: 'Moverse y mirar',
        text: 'Hacé clic sobre el juego para controlar la cámara. Mirá con el mouse, caminá con W A S D, saltá con Espacio y corré con Shift. En modo creativo, F activa el vuelo.'
      },
      {
        image: 'bloques.jpg',
        title: 'Romper y colocar bloques',
        text: 'Apuntá con la cruz del centro: mantené el clic izquierdo para romper un bloque y hacé clic derecho para colocar el que tenés en la mano. Elegilo con las teclas 1 a 9 o la rueda del mouse.'
      },
      {
        image: 'inventario.jpg',
        title: 'Inventario',
        text: 'Con E abrís todos los bloques, ordenados por categoría. Cada uno se puede escuchar separado en sílabas y tiene una descripción. Elegí uno para ponerlo en tu barra.'
      },
      {
        image: 'planos.jpg',
        title: 'Planos de construcción',
        text: 'Con P elegís un plano: una casa, una torre o un puente. Te dice qué materiales vas a usar. La torre de piedra es la más fácil para empezar.'
      },
      {
        image: 'guia.jpg',
        title: 'Seguir la guía',
        text: 'Los bloques transparentes muestran dónde va cada pieza y el panel indica cuál sigue. Lo que tenés en la mano se ilumina en el plano. Completalo para ganar.'
      },
      {
        image: 'asistente.jpg',
        title: 'El asistente',
        text: `Con ${chatKeyLabel} abrís a Nexo, el asistente. Preguntale lo que quieras del juego, por ejemplo "¿cómo vuelo?" o "¿dónde hay diamantes?".`
      },
      {
        image: 'menu.jpg',
        title: 'Pausa y guardado',
        text: 'Con Esc pausás el juego. Desde ahí guardás tu mundo con su nombre, cargás otro, cambiás la configuración o repetís el tutorial.'
      }
    ];
  }

  #slides;
  #index = 0;

  constructor(screenManager = null, intentBus = null, { slides = null } = {}) {
    super(ScreenType.HOW_TO_PLAY, screenManager, intentBus);
    this.#slides = slides ?? HowToPlayScreen.defaultSlides(KeyNames.of(GameConfig.chatbot.TOGGLE_KEY));
    this.#buildDOM();
    this.#render();
  }

  get slideIndex() {
    return this.#index;
  }

  get slideCount() {
    return this.#slides.length;
  }

  next() {
    this.goTo(this.#index + 1);
  }

  previous() {
    this.goTo(this.#index - 1);
  }

  /** Va a la diapositiva pedida, sin pasarse de la primera ni de la última. */
  goTo(index) {
    const clamped = Math.max(0, Math.min(this.#slides.length - 1, index));
    if (clamped === this.#index) return;
    this.#index = clamped;
    this.#render();
  }

  #buildDOM() {
    this.element.className = 'screen screen-how-to-play nx-modal-backdrop';

    this.modal = new Modal({
      title: '¿Cómo jugar?',
      className: 'nx-how-to-play-dialog',
      onClose: () => this.handleBack()
    });

    const stage = document.createElement('div');
    stage.className = 'nx-htp-stage';

    this.previousBtn = HowToPlayScreen.#arrow('‹', 'Anterior', 'nx-htp-arrow-previous', () => this.previous());
    this.nextBtn = HowToPlayScreen.#arrow('›', 'Siguiente', 'nx-htp-arrow-next', () => this.next());

    this.imageElement = document.createElement('img');
    this.imageElement.className = 'nx-htp-image';
    this.imageElement.decoding = 'async';

    stage.appendChild(this.previousBtn);
    stage.appendChild(this.imageElement);
    stage.appendChild(this.nextBtn);

    this.titleElement = document.createElement('h3');
    this.titleElement.className = 'nx-htp-title';
    this.textElement = document.createElement('p');
    this.textElement.className = 'nx-htp-text';

    this.dotsElement = document.createElement('div');
    this.dotsElement.className = 'nx-htp-dots';
    this.dots = this.#slides.map((slide, index) => {
      const dot = document.createElement('button');
      dot.type = 'button';
      dot.className = 'nx-htp-dot';
      dot.setAttribute('aria-label', `Ir a "${slide.title}"`);
      dot.addEventListener('click', () => this.goTo(index));
      this.dotsElement.appendChild(dot);
      return dot;
    });

    this.modal.addBodyItem(stage);
    this.modal.addBodyItem(this.titleElement);
    this.modal.addBodyItem(this.textElement);
    this.modal.addBodyItem(this.dotsElement);

    this.backBtn = new Button({
      text: 'VOLVER',
      variant: 'primary',
      id: 'how-to-play-btn-back',
      onClick: () => this.handleBack()
    });
    this.modal.addFooterItem(this.backBtn);
    this.element.appendChild(this.modal.element);
  }

  #render() {
    const slide = this.#slides[this.#index];
    this.imageElement.src = `${HowToPlayScreen.IMAGE_BASE_PATH}${slide.image}`;
    this.imageElement.alt = slide.title;
    this.titleElement.textContent = `${this.#index + 1}/${this.#slides.length} · ${slide.title}`;
    this.textElement.textContent = slide.text;
    this.previousBtn.disabled = this.#index === 0;
    this.nextBtn.disabled = this.#index === this.#slides.length - 1;
    this.dots.forEach((dot, index) => {
      const current = index === this.#index;
      dot.classList.toggle('is-active', current);
      dot.setAttribute('aria-current', current ? 'step' : 'false');
    });
  }

  handleBack() {
    this.screenManager?.back();
  }

  show(params = {}) {
    super.show(params);
    this.goTo(0);
    setTimeout(() => this.nextBtn?.focus?.(), 50);
  }

  onKeyDown(event) {
    if (event.key === 'ArrowRight') {
      event.preventDefault?.();
      this.next();
      return;
    }
    if (event.key === 'ArrowLeft') {
      event.preventDefault?.();
      this.previous();
      return;
    }
    super.onKeyDown(event);
  }

  static #arrow(symbol, label, className, onClick) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `nx-htp-arrow ${className}`;
    button.setAttribute('aria-label', label);
    button.textContent = symbol;
    button.addEventListener('click', onClick);
    return button;
  }
}
