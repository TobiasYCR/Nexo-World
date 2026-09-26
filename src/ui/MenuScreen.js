import { Screen } from './Screen.js';
import { ScreenType } from './ScreenType.js';
import { IntentBus } from './IntentBus.js';
import { Icons } from './Icons.js';

/**
 * Pantalla del Menú Principal.
 * Muestra el título del juego y 3 botones apilados: Jugar, Configuración y Controles.
 * El mundo 3D se renderiza de fondo mientras el menú está abierto.
 */
export class MenuScreen extends Screen {
  constructor(screenManager = null, intentBus = null) {
    super(ScreenType.MENU, screenManager, intentBus);
    this.#buildDOM();
  }

  #buildDOM() {
    this.element.className = 'screen screen-menu nx-menu-backdrop';

    const card = document.createElement('div');
    card.className = 'nx-menu-card';

    // Logo y Título
    const titleContainer = document.createElement('div');
    titleContainer.className = 'nx-menu-header';

    const tag = document.createElement('div');
    tag.className = 'nx-menu-tag';
    tag.textContent = 'SANDBOX VOXEL 3D';

    const title = document.createElement('h1');
    title.className = 'nx-menu-title';
    title.textContent = 'NEXO WORLD';

    const subtitle = document.createElement('p');
    subtitle.className = 'nx-menu-subtitle';
    subtitle.textContent = 'Explora, construye y crea en un mundo infinito';

    titleContainer.appendChild(tag);
    titleContainer.appendChild(title);
    titleContainer.appendChild(subtitle);

    // Botones de acción
    const nav = document.createElement('div');
    nav.className = 'nx-menu-actions';

    this.continueBtn = document.createElement('button');
    this.continueBtn.type = 'button';
    this.continueBtn.className = 'nx-btn nx-btn-primary nx-btn-large';
    this.continueBtn.id = 'menu-btn-continue';
    this.continueBtn.innerHTML = `
      <span class="nx-btn-icon">${Icons.CONTINUE}</span>
      <span class="nx-btn-text">CONTINUAR</span>
    `;
    this.continueBtn.addEventListener('click', () => this.handleContinue());

    this.playBtn = document.createElement('button');
    this.playBtn.type = 'button';
    this.playBtn.className = 'nx-btn nx-btn-primary nx-btn-large';
    this.playBtn.id = 'menu-btn-play';
    this.playBtn.innerHTML = `
      <span class="nx-btn-icon">${Icons.PLAY}</span>
      <span class="nx-btn-text">NUEVA PARTIDA</span>
    `;
    this.playBtn.addEventListener('click', () => this.handlePlay());

    this.settingsBtn = document.createElement('button');
    this.settingsBtn.type = 'button';
    this.settingsBtn.className = 'nx-btn nx-btn-secondary nx-btn-large';
    this.settingsBtn.id = 'menu-btn-settings';
    this.settingsBtn.innerHTML = `
      <span class="nx-btn-icon">${Icons.SETTINGS}</span>
      <span class="nx-btn-text">CONFIGURACIÓN</span>
    `;
    this.settingsBtn.addEventListener('click', () => this.handleSettings());

    this.controlsBtn = document.createElement('button');
    this.controlsBtn.type = 'button';
    this.controlsBtn.className = 'nx-btn nx-btn-secondary nx-btn-large';
    this.controlsBtn.id = 'menu-btn-controls';
    this.controlsBtn.innerHTML = `
      <span class="nx-btn-icon">${Icons.CONTROLS}</span>
      <span class="nx-btn-text">CONTROLES</span>
    `;
    this.controlsBtn.addEventListener('click', () => this.handleControls());

    nav.appendChild(this.continueBtn);
    nav.appendChild(this.playBtn);
    nav.appendChild(this.settingsBtn);
    nav.appendChild(this.controlsBtn);

    // Footer de versión y atajos
    const footer = document.createElement('div');
    footer.className = 'nx-menu-footer';
    footer.textContent = 'v0.1.0 • Usa el mouse para interactuar • Navegación por teclado disponible';

    card.appendChild(titleContainer);
    card.appendChild(nav);
    card.appendChild(footer);

    this.element.appendChild(card);
  }

  show(params = {}) {
    super.show(params);
    this.updateSaveState();
    setTimeout(() => {
      if (!this.continueBtn.disabled) {
        this.continueBtn?.focus?.();
      } else {
        this.playBtn?.focus?.();
      }
    }, 50);
  }

  updateSaveState(slot = 'quicksave') {
    const exists = this.saveManager?.exists ? this.saveManager.exists(slot) : false;
    this.continueBtn.disabled = !exists;
    if (this.continueBtn.classList?.toggle) {
      this.continueBtn.classList.toggle('is-disabled', !exists);
    }
  }

  handleContinue(slot = 'quicksave') {
    if (this.continueBtn.disabled) return;
    if (this.intentBus) {
      this.intentBus.emit(IntentBus.Events.CONTINUE_GAME, { slot });
    }
  }

  handlePlay() {
    if (this.intentBus) {
      this.intentBus.emit(IntentBus.Events.START_GAME);
    }
    if (this.screenManager) {
      this.screenManager.open(ScreenType.PLAYING);
    }
  }

  handleSettings() {
    if (this.intentBus) {
      this.intentBus.emit(IntentBus.Events.OPEN_SCREEN, { screen: ScreenType.SETTINGS });
    }
    if (this.screenManager) {
      this.screenManager.open(ScreenType.SETTINGS);
    }
  }

  handleControls() {
    if (this.intentBus) {
      this.intentBus.emit(IntentBus.Events.OPEN_SCREEN, { screen: ScreenType.CONTROLS });
    }
    if (this.screenManager) {
      this.screenManager.open(ScreenType.CONTROLS);
    }
  }

  onKeyDown(event) {
    // Escape no sale del menú principal
    if (event.key === 'Escape') {
      event.preventDefault?.();
      return;
    }
    super.onKeyDown(event);
  }
}
