import { Screen } from './Screen.js';
import { ScreenType } from './ScreenType.js';
import { IntentBus } from './IntentBus.js';

/**
 * Pantalla del Menú Principal.
 * Presenta el título del juego y las acciones principales:
 * Jugar / Seleccionar Mundos, Configuración y Controles.
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

    this.playBtn = document.createElement('button');
    this.playBtn.type = 'button';
    this.playBtn.className = 'nx-btn nx-btn-primary nx-btn-large';
    this.playBtn.id = 'menu-btn-play';
    this.playBtn.innerHTML = `
      <span class="nx-btn-icon">▶</span>
      <span class="nx-btn-text">JUGAR / MUNDOS</span>
    `;
    this.playBtn.addEventListener('click', () => this.handlePlay());

    this.settingsBtn = document.createElement('button');
    this.settingsBtn.type = 'button';
    this.settingsBtn.className = 'nx-btn nx-btn-secondary nx-btn-large';
    this.settingsBtn.id = 'menu-btn-settings';
    this.settingsBtn.innerHTML = `
      <span class="nx-btn-icon">⚙</span>
      <span class="nx-btn-text">CONFIGURACIÓN</span>
    `;
    this.settingsBtn.addEventListener('click', () => this.handleSettings());

    this.controlsBtn = document.createElement('button');
    this.controlsBtn.type = 'button';
    this.controlsBtn.className = 'nx-btn nx-btn-secondary nx-btn-large';
    this.controlsBtn.id = 'menu-btn-controls';
    this.controlsBtn.innerHTML = `
      <span class="nx-btn-icon">⌨</span>
      <span class="nx-btn-text">CONTROLES</span>
    `;
    this.controlsBtn.addEventListener('click', () => this.handleControls());

    nav.appendChild(this.playBtn);
    nav.appendChild(this.settingsBtn);
    nav.appendChild(this.controlsBtn);

    // Footer de versión y atajos
    const footer = document.createElement('div');
    footer.className = 'nx-menu-footer';
    footer.textContent = 'v0.2.0 • Usa el mouse o teclado para navegar';

    card.appendChild(titleContainer);
    card.appendChild(nav);
    card.appendChild(footer);

    this.element.appendChild(card);
  }

  show(params = {}) {
    super.show(params);
    setTimeout(() => this.playBtn?.focus?.(), 50);
  }

  handlePlay() {
    if (this.intentBus) {
      this.intentBus.emit(IntentBus.Events.OPEN_SCREEN, { screen: ScreenType.WORLD_SELECTION });
    }
    if (this.screenManager) {
      this.screenManager.open(ScreenType.WORLD_SELECTION);
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
    if (event.key === 'Escape') {
      event.preventDefault?.();
      return;
    }
    super.onKeyDown(event);
  }
}
