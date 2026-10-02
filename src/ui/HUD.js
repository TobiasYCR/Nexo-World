import { Crosshair } from './Crosshair.js';
import { DebugOverlay } from './DebugOverlay.js';
import { HotbarView } from './HotbarView.js';
import { IntentBus } from './IntentBus.js';
import { ScreenManager } from './ScreenManager.js';
import { ScreenType } from './ScreenType.js';
import { MenuScreen } from './MenuScreen.js';
import { PauseScreen } from './PauseScreen.js';
import { SettingsScreen } from '../interface/screens/SettingsScreen.js';
import { ControlsScreen } from '../interface/screens/ControlsScreen.js';
import { InventoryScreen } from '../interface/screens/InventoryScreen.js';
import { SettingsModel } from '../interface/models/SettingsModel.js';

/**
 * Capa de interfaz de usuario de Nexo World.
 * Coordina el HUD durante el juego (Crosshair, Hotbar, DebugOverlay),
 * el gestor de pantallas (ScreenManager), el bus de intenciones (IntentBus)
 * y la navegación entre menús y modales.
 */
export class HUD {
  #lastKnownState = 'running';

  constructor(containerId = 'ui-root') {
    this.container = document.getElementById(containerId);
    if (!this.container) {
      throw new Error(`No existe el contenedor de interfaz "#${containerId}".`);
    }

    this.intentBus = new IntentBus();
    this.screenManager = new ScreenManager(this.container, this.intentBus);
    this.settingsModel = new SettingsModel();

    this.crosshair = new Crosshair();
    this.hotbarView = new HotbarView(9);
    this.debugOverlay = new DebugOverlay();

    this.#registerScreens();
    this.#setupIntentListeners();
    this.#setupKeyboardShortcuts();
  }

  #registerScreens() {
    // Registro de pantallas base (Frontend 1)
    this.menuScreen = new MenuScreen(this.screenManager, this.intentBus);
    this.pauseScreen = new PauseScreen(this.screenManager, this.intentBus);

    // Registro de pantallas completas (Frontend 2)
    this.settingsScreen = new SettingsScreen(this.settingsModel, this.screenManager, this.intentBus);
    this.controlsScreen = new ControlsScreen(this.screenManager, this.intentBus);
    this.inventoryScreen = new InventoryScreen(null, this.screenManager, this.intentBus);

    this.screenManager.register(ScreenType.MENU, this.menuScreen);
    this.screenManager.register(ScreenType.PAUSE, this.pauseScreen);
    this.screenManager.register(ScreenType.SETTINGS, this.settingsScreen);
    this.screenManager.register(ScreenType.CONTROLS, this.controlsScreen);
    this.screenManager.register(ScreenType.INVENTORY, this.inventoryScreen);
  }

  #setupIntentListeners() {
    this.intentBus.on(IntentBus.Events.START_GAME, () => {
      this.screenManager.open(ScreenType.PLAYING);
    });

    this.intentBus.on(IntentBus.Events.RESUME_GAME, () => {
      this.screenManager.open(ScreenType.PLAYING);
      if (this.#lastKnownState === 'paused' && typeof window !== 'undefined' && window.dispatchEvent) {
        window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Escape', key: 'Escape' }));
      }
    });

    this.intentBus.on(IntentBus.Events.BACK_TO_MENU, () => {
      this.screenManager.open(ScreenType.MENU);
      if (this.#lastKnownState === 'running' && typeof window !== 'undefined' && window.dispatchEvent) {
        window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Escape', key: 'Escape' }));
      }
    });

    this.intentBus.on(IntentBus.Events.OPEN_SCREEN, (payload) => {
      if (payload?.screen) {
        this.screenManager.open(payload.screen, payload.params);
      }
    });

    this.intentBus.on(IntentBus.Events.GO_BACK, () => {
      this.screenManager.back();
    });

    this.intentBus.on(IntentBus.Events.TOGGLE_DEBUG, () => {
      this.toggleDebug();
    });

    this.intentBus.on(IntentBus.Events.SETTINGS_CHANGED, ({ key, value }) => {
      if (key === 'showDebug') {
        this.debugOverlay.setVisible(value);
      }
    });

    // Escuchar cambios de visibilidad en el gestor para alternar crosshair y hotbar
    this.screenManager.onChange((current) => {
      const isPlaying = current === ScreenType.PLAYING;
      this.crosshair.setVisible(isPlaying);
      this.hotbarView.setVisible(isPlaying);
    });
  }

  #setupKeyboardShortcuts() {
    if (typeof window === 'undefined' || !window.addEventListener) return;

    window.addEventListener('keydown', (e) => {
      // Atajos activos únicamente durante el juego
      if (this.screenManager.currentScreenType === ScreenType.PLAYING) {
        if (e.code === 'KeyE') {
          e.preventDefault?.();
          this.screenManager.open(ScreenType.INVENTORY);
        } else if (e.code === 'KeyO') {
          e.preventDefault?.();
          this.screenManager.open(ScreenType.SETTINGS);
        } else if (e.code === 'F1') {
          e.preventDefault?.();
          this.screenManager.open(ScreenType.CONTROLS);
        }
      }
    });
  }

  /**
   * Monta todos los componentes en el contenedor DOM e inicia en el Menú Principal.
   */
  mount() {
    this.crosshair.mount(this.container);
    this.hotbarView.mount(this.container);
    this.debugOverlay.mount(this.container);

    // Inicializar con el Menú Principal
    this.screenManager.open(ScreenType.MENU);

    // Estado inicial de visibilidad del HUD in-game
    this.crosshair.setVisible(false);
    this.hotbarView.setVisible(false);

  }

  toggleDebug() {
    this.debugOverlay.toggle();
  }

  /**
   * Actualización periódica desde Game.update.
   * @param {number} deltaTime
   * @param {{fps:number, position:{x:number,y:number,z:number}, renderedBlocks:number, state:string}} stats
   * @param {{selectedIndex:number, slots:Array<{blockType:Object|null,count:number}>}} hotbar
   */
  update(deltaTime, stats, hotbar) {
    this.debugOverlay.update(deltaTime, stats);
    this.hotbarView.update(hotbar);

    if (stats?.state) {
      this.#lastKnownState = stats.state;
      if (stats.state === 'paused' && this.screenManager.currentScreenType === ScreenType.PLAYING) {
        this.screenManager.open(ScreenType.PAUSE);
      } else if (stats.state === 'running' && this.screenManager.currentScreenType === ScreenType.PAUSE) {
        this.screenManager.open(ScreenType.PLAYING);
      }
    }
  }
}
