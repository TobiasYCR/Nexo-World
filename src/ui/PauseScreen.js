import { Screen } from './Screen.js';
import { ScreenType } from './ScreenType.js';
import { IntentBus } from './IntentBus.js';
import { Icons } from './Icons.js';

/**
 * Overlay del Menú de Pausa Mejorado.
 * Permite reanudar la partida, guardar en slot actual, cargar/seleccionar mundos,
 * acceder a configuración/controles y volver al menú principal.
 */
export class PauseScreen extends Screen {
  constructor(screenManager = null, intentBus = null) {
    super(ScreenType.PAUSE, screenManager, intentBus);
    this.#buildDOM();
  }

  #buildDOM() {
    this.element.className = 'screen screen-pause nx-pause-backdrop';

    const card = document.createElement('div');
    card.className = 'nx-pause-card';

    const header = document.createElement('div');
    header.className = 'nx-pause-header';

    const title = document.createElement('h2');
    title.className = 'nx-pause-title';
    title.textContent = 'JUEGO EN PAUSA';

    header.appendChild(title);

    const actions = document.createElement('div');
    actions.className = 'nx-pause-actions';

    // 1. Reanudar
    this.resumeBtn = document.createElement('button');
    this.resumeBtn.type = 'button';
    this.resumeBtn.className = 'nx-btn nx-btn-primary nx-btn-large';
    this.resumeBtn.id = 'pause-btn-resume';
    this.resumeBtn.innerHTML = `
      <span class="nx-btn-icon">${Icons.play}</span>
      <span class="nx-btn-text">REANUDAR PARTIDA</span>
    `;
    this.resumeBtn.addEventListener('click', () => this.handleResume());

    // 2. Guardar Partida
    this.saveBtn = document.createElement('button');
    this.saveBtn.type = 'button';
    this.saveBtn.className = 'nx-btn nx-btn-secondary nx-btn-large';
    this.saveBtn.id = 'pause-btn-save';
    this.saveBtn.innerHTML = `
      <span class="nx-btn-icon">${Icons.save}</span>
      <span class="nx-btn-text">GUARDAR PARTIDA</span>
    `;
    this.saveBtn.addEventListener('click', () => this.handleSave());

    // 3. Cargar Partida / Selección de Mundos
    this.loadBtn = document.createElement('button');
    this.loadBtn.type = 'button';
    this.loadBtn.className = 'nx-btn nx-btn-secondary nx-btn-large';
    this.loadBtn.id = 'pause-btn-load';
    this.loadBtn.innerHTML = `
      <span class="nx-btn-icon">${Icons.load}</span>
      <span class="nx-btn-text">CARGAR PARTIDA</span>
    `;
    this.loadBtn.addEventListener('click', () => this.handleLoad());

    // 4. Configuración
    this.settingsBtn = document.createElement('button');
    this.settingsBtn.type = 'button';
    this.settingsBtn.className = 'nx-btn nx-btn-secondary nx-btn-large';
    this.settingsBtn.id = 'pause-btn-settings';
    this.settingsBtn.innerHTML = `
      <span class="nx-btn-icon">${Icons.settings}</span>
      <span class="nx-btn-text">CONFIGURACIÓN</span>
    `;
    this.settingsBtn.addEventListener('click', () => this.handleSettings());

    // 5. Controles
    this.controlsBtn = document.createElement('button');
    this.controlsBtn.type = 'button';
    this.controlsBtn.className = 'nx-btn nx-btn-secondary nx-btn-large';
    this.controlsBtn.id = 'pause-btn-controls';
    this.controlsBtn.innerHTML = `
      <span class="nx-btn-icon">${Icons.controls}</span>
      <span class="nx-btn-text">CONTROLES</span>
    `;
    this.controlsBtn.addEventListener('click', () => this.handleControls());

    // 6. Volver al Menú Principal
    this.menuBtn = document.createElement('button');
    this.menuBtn.type = 'button';
    this.menuBtn.className = 'nx-btn nx-btn-danger nx-btn-large';
    this.menuBtn.id = 'pause-btn-menu';
    this.menuBtn.innerHTML = `
      <span class="nx-btn-icon">${Icons.logout}</span>
      <span class="nx-btn-text">VOLVER AL MENÚ</span>
    `;
    this.menuBtn.addEventListener('click', () => this.handleBackToMenu());

    actions.appendChild(this.resumeBtn);
    actions.appendChild(this.saveBtn);
    actions.appendChild(this.loadBtn);
    actions.appendChild(this.settingsBtn);
    actions.appendChild(this.controlsBtn);
    actions.appendChild(this.menuBtn);

    const hint = document.createElement('div');
    hint.className = 'nx-pause-hint';
    hint.textContent = 'Presiona ESC para reanudar';

    card.appendChild(header);
    card.appendChild(actions);
    card.appendChild(hint);

    this.element.appendChild(card);
  }

  show(params = {}) {
    super.show(params);
    setTimeout(() => this.resumeBtn?.focus?.(), 50);
  }

  handleResume() {
    if (this.intentBus) {
      this.intentBus.emit(IntentBus.Events.RESUME_GAME);
    }
    if (this.screenManager) {
      this.screenManager.open(ScreenType.PLAYING);
    }
  }

  handleSave() {
    if (this.intentBus) {
      this.intentBus.emit(IntentBus.Events.SAVE_GAME, { slot: 'default' });
    }
  }

  handleLoad() {
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

  handleBackToMenu() {
    if (this.intentBus) {
      this.intentBus.emit(IntentBus.Events.BACK_TO_MENU);
    }
    if (this.screenManager) {
      this.screenManager.open(ScreenType.MENU);
    }
  }

  onKeyDown(event) {
    if (event.key === 'Escape') {
      event.preventDefault?.();
      this.handleResume();
      return;
    }
    super.onKeyDown(event);
  }
}
