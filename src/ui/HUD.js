import { Crosshair } from './Crosshair.js';
import { DebugOverlay } from './DebugOverlay.js';
import { HotbarView } from './HotbarView.js';
import { HealthBar } from './HealthBar.js';
import { Toast } from './Toast.js';
import { IntentBus } from './IntentBus.js';
import { ScreenManager } from './ScreenManager.js';
import { ScreenType } from './ScreenType.js';
import { UiStateManager } from './UiStateManager.js';
import { MenuScreen } from './MenuScreen.js';
import { PauseScreen } from './PauseScreen.js';
import { SettingsScreen } from '../interface/screens/SettingsScreen.js';
import { ControlsScreen } from '../interface/screens/ControlsScreen.js';
import { InventoryScreen } from '../interface/screens/InventoryScreen.js';
import { WorldSelectionScreen } from '../interface/screens/WorldSelectionScreen.js';
import { WorldCreationScreen } from '../interface/screens/WorldCreationScreen.js';
import { SettingsModel } from '../interface/models/SettingsModel.js';

/**
 * Capa de interfaz de usuario de Nexo World.
 * Coordina el HUD durante el juego (Crosshair, Hotbar, HealthBar, DebugOverlay, Toast),
 * el gestor de pantallas (ScreenManager), el bus de intenciones (IntentBus)
 * y la navegación entre menús, inventario y creación/selección de mundos.
 */
export class HUD {
  #lastKnownState = 'running';

  constructor(containerId = 'ui-root') {
    this.container = document.getElementById(containerId);
    if (!this.container) {
      throw new Error(`No existe el contenedor de interfaz "#${containerId}".`);
    }

    this.intentBus = new IntentBus();
    this.uiStateManager = new UiStateManager(ScreenType.MENU);
    this.screenManager = new ScreenManager(this.container, this.intentBus, this.uiStateManager);
    this.settingsModel = new SettingsModel();

    // Elementos del HUD in-game
    this.crosshair = new Crosshair({
      size: this.settingsModel.get('crosshairSize'),
      opacity: this.settingsModel.get('crosshairOpacity')
    });
    this.hotbarView = new HotbarView(9);
    this.healthBar = new HealthBar(20);
    this.debugOverlay = new DebugOverlay();
    this.toast = Toast.getInstance(this.container);

    this.#registerScreens();
    this.#setupIntentListeners();
    this.#setupKeyboardShortcuts();
  }

  #registerScreens() {
    this.menuScreen = new MenuScreen(this.screenManager, this.intentBus);
    this.pauseScreen = new PauseScreen(this.screenManager, this.intentBus);
    this.worldSelectionScreen = new WorldSelectionScreen(null, this.screenManager, this.intentBus);
    this.worldCreationScreen = new WorldCreationScreen(this.screenManager, this.intentBus);

    this.settingsScreen = new SettingsScreen(this.settingsModel, this.screenManager, this.intentBus);
    this.controlsScreen = new ControlsScreen(this.screenManager, this.intentBus);
    this.inventoryScreen = new InventoryScreen(null, this.screenManager, this.intentBus);

    this.screenManager.register(ScreenType.MENU, this.menuScreen);
    this.screenManager.register(ScreenType.WORLD_SELECTION, this.worldSelectionScreen);
    this.screenManager.register(ScreenType.WORLD_CREATION, this.worldCreationScreen);
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
    });

    this.intentBus.on(IntentBus.Events.PAUSE_GAME, () => {
      this.screenManager.open(ScreenType.PAUSE);
    });

    this.intentBus.on(IntentBus.Events.BACK_TO_MENU, () => {
      this.screenManager.open(ScreenType.MENU);
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

    this.intentBus.on(IntentBus.Events.SHOW_TOAST, (payload) => {
      if (payload?.message) {
        this.toast.show(payload.message, payload.type || 'info', payload.duration || 3000);
      }
    });

    this.intentBus.on(IntentBus.Events.SETTINGS_CHANGED, ({ key, value }) => {
      if (key === 'showDebug') {
        this.debugOverlay.setVisible(value);
      } else if (key === 'crosshairSize') {
        this.crosshair.setSize(value);
      } else if (key === 'crosshairOpacity') {
        this.crosshair.setOpacity(value);
      } else if (key === 'debugUpdateInterval') {
        this.debugOverlay.setUpdateInterval(value / 1000);
      } else if (key === 'showHealthBar') {
        this.healthBar.setVisible(value);
      }
    });

    // Sincronizar visibilidad de elementos in-game con el gestor de pantallas
    this.screenManager.onChange((current) => {
      const isPlaying = current === ScreenType.PLAYING;
      this.crosshair.setVisible(isPlaying);
      this.hotbarView.setVisible(isPlaying);
      this.healthBar.setVisible(isPlaying && this.settingsModel.get('showHealthBar'));
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
        } else if (e.code === 'F3') {
          e.preventDefault?.();
          this.toggleDebug();
        }
      } else if (this.screenManager.currentScreenType === ScreenType.INVENTORY) {
        if (e.code === 'KeyE' || e.code === 'Escape') {
          e.preventDefault?.();
          this.screenManager.open(ScreenType.PLAYING);
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
    this.healthBar.mount(this.container);
    this.debugOverlay.mount(this.container);
    this.toast.mount(this.container);

    // Inicializar con el Menú Principal
    this.screenManager.open(ScreenType.MENU);

    // Estado inicial de visibilidad del HUD in-game
    this.crosshair.setVisible(false);
    this.hotbarView.setVisible(false);
    this.healthBar.setVisible(false);
  }

  toggleDebug() {
    this.debugOverlay.toggle();
  }

  /**
   * Actualización periódica desde Game.update.
   * @param {number} deltaTime
   * @param {Object} [stats]
   * @param {Object} [hotbar]
   */
  update(deltaTime, stats, hotbar) {
    this.debugOverlay.update(deltaTime, stats);
    this.hotbarView.update(hotbar);

    // Actualizar salud si está disponible
    if (stats && 'health' in stats) {
      this.healthBar.update(stats.health, stats.maxHealth ?? 20);
    }

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
