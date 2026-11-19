import { Crosshair } from './Crosshair.js';
import { MenuScenery } from './MenuScenery.js';
import { TutorialPanel } from './TutorialPanel.js';
import { TouchControls } from './TouchControls.js';
import { TouchSupport } from '../input/TouchSupport.js';
import { KeyNames } from '../chatbot/KeyNames.js';
import { DebugOverlay } from './DebugOverlay.js';
import { HotbarView } from './HotbarView.js';
import { HealthBar } from './HealthBar.js';
import { Toast } from './Toast.js';
import { ChatPanel } from './ChatPanel.js';
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
import { HowToPlayScreen } from '../interface/screens/HowToPlayScreen.js';
import { SettingsModel } from '../interface/models/SettingsModel.js';
import { AuthService } from '../auth/AuthService.js';
import { LocalAuthClient } from '../users/LocalAuthClient.js';
import { BackendAuthClient } from '../auth/BackendAuthClient.js';
import { ProgressionLocalStore } from '../progression/ProgressionLocalStore.js';
import { GameConfig } from '../game/GameConfig.js';
import { LoginScreen } from '../interface/screens/LoginScreen.js';
import { RegisterScreen } from '../interface/screens/RegisterScreen.js';
import { ProfileScreen } from '../interface/screens/ProfileScreen.js';
import { PasswordRecoveryScreen } from '../interface/screens/PasswordRecoveryScreen.js';
import { PresetsScreen } from '../interface/screens/PresetsScreen.js';
import { BuildChallengeHUD } from './BuildChallengeHUD.js';
import { LeaderboardScreen } from '../interface/screens/LeaderboardScreen.js';

/**
 * Capa de interfaz de usuario de Nexo World.
 * Coordina el HUD durante el juego (Crosshair, Hotbar, HealthBar, DebugOverlay, Toast, ChatPanel),
 * el gestor de pantallas (ScreenManager), el bus de intenciones (IntentBus),
 * la autenticación y la navegación entre menús, inventario y creación/selección de mundos.
 */
export class HUD {
  #lastKnownState = 'running';

  constructor(containerId = 'ui-root', options = {}) {
    this.container = document.getElementById(containerId);
    if (!this.container) {
      throw new Error(`No existe el contenedor de interfaz "#${containerId}".`);
    }

    this.intentBus = new IntentBus();
    this.uiStateManager = new UiStateManager(ScreenType.MENU);
    this.screenManager = new ScreenManager(this.container, this.intentBus, this.uiStateManager);
    this.settingsModel = new SettingsModel();
    this.authService = options.authService
      ?? new AuthService({ intentBus: this.intentBus, client: HUD.#createAuthClient() });
    this.backend2Service = options.backend2Service ?? null;

    // Elementos del HUD in-game
    this.crosshair = new Crosshair({
      size: this.settingsModel.get('crosshairSize'),
      opacity: this.settingsModel.get('crosshairOpacity')
    });
    this.hotbarView = new HotbarView(9);
    this.healthBar = new HealthBar(20);
    this.debugOverlay = new DebugOverlay();
    this.buildChallengeHud = new BuildChallengeHUD({ intentBus: this.intentBus });
    this.toast = Toast.getInstance(this.container);

    // El asistente responde con los datos del juego, así que necesita leer el
    // estado vivo de la partida. Game pasa el proveedor; sin él el bot sigue
    // contestando todo lo que sale de GameConfig y avisa que lo de la partida
    // en curso no lo puede saber.
    //
    // Se carga al abrir el chat por primera vez, no al arrancar: así el peso de
    // sus librerías no lo paga quien nunca lo usa.
    this.chatPanel = new ChatPanel({
      loadBot: options.loadBot ?? ChatPanel.defaultLoader(options.gameContextProvider ?? null)
    });

    this.chatHintElement = document.createElement('div');
    this.chatHintElement.className = 'hud-chat-hint';
    this.chatHintElement.textContent = 'Presiona T para abrir chatbot';
    this.chatHintElement.hidden = true;

    // Jugando sin el mouse capturado (al empezar, o al volver con Esc, que el
    // navegador no deja usar para capturarlo): un clic lo captura.
    this.clickToPlayElement = document.createElement('div');
    this.clickToPlayElement.className = 'hud-click-to-play';
    this.clickToPlayElement.textContent = 'Hacé clic para jugar';
    this.clickToPlayElement.hidden = true;

    // Tutorial para quien nunca jugó. Al terminarlo o saltarlo no vuelve a
    // aparecer, salvo que se active de nuevo en Configuración → Interfaz.
    this.tutorial = new TutorialPanel({
      chatKeyLabel: KeyNames.of(GameConfig.chatbot.TOGGLE_KEY),
      onFinish: () => this.settingsModel.set('showTutorial', false)
    });

    // Celulares y tablets: joystick, arrastrar para mirar y botones.
    this.touchControls = new TouchControls({
      onInventory: () => this.screenManager.open(ScreenType.INVENTORY),
      onBlueprints: () => this.screenManager.open(ScreenType.PRESETS),
      onChat: () => this.toggleChat()
    });
    if (this.settingsModel.get('showTutorial')) this.tutorial.start();

    // Imagen fija detrás de los menús, en vez del mundo.
    this.menuScenery = new MenuScenery();
    this.menuScenery.mount(this.container);
    this.menuScenery.bind(this.screenManager);

    this.#registerScreens();
    // Después de crear las pantallas: algunas cambian sus textos en modo táctil.
    this.setTouchMode(TouchSupport.shouldUseTouch());
    this.#setupIntentListeners();
    this.#setupKeyboardShortcuts();
  }

  /**
   * Cuentas en el servidor (PostgreSQL) o en el navegador, según GameConfig.users.AUTH_SOURCE.
   * Con servidor se envía el token del invitado de este navegador, para que la
   * cuenta nueva se quede con su progreso.
   */
  static #createAuthClient() {
    if (GameConfig.users.AUTH_SOURCE === 'local') return new LocalAuthClient();
    const progressionStore = new ProgressionLocalStore();
    return new BackendAuthClient({ guestTokenProvider: () => progressionStore.loadIdentity()?.token });
  }

  #registerScreens() {
    this.menuScreen = new MenuScreen(this.screenManager, this.intentBus, this.authService);
    this.pauseScreen = new PauseScreen(this.screenManager, this.intentBus);
    this.worldSelectionScreen = new WorldSelectionScreen(null, this.screenManager, this.intentBus);
    this.worldCreationScreen = new WorldCreationScreen(this.screenManager, this.intentBus);

    this.settingsScreen = new SettingsScreen(this.settingsModel, this.screenManager, this.intentBus);
    this.controlsScreen = new ControlsScreen(this.screenManager, this.intentBus);
    this.inventoryScreen = new InventoryScreen(null, this.screenManager, this.intentBus, { settingsModel: this.settingsModel });
    this.presetsScreen = new PresetsScreen(this.screenManager, this.intentBus);

    this.loginScreen = new LoginScreen(this.authService, this.screenManager, this.intentBus);
    this.registerScreen = new RegisterScreen(this.authService, this.screenManager, this.intentBus);
    this.profileScreen = new ProfileScreen(this.authService, this.backend2Service, this.screenManager, this.intentBus);
    this.passwordRecoveryScreen = new PasswordRecoveryScreen(this.authService, this.screenManager, this.intentBus);
    this.leaderboardScreen = new LeaderboardScreen(this.backend2Service, this.screenManager, this.intentBus);
    this.howToPlayScreen = new HowToPlayScreen(this.screenManager, this.intentBus);

    this.screenManager.register(ScreenType.MENU, this.menuScreen);
    this.screenManager.register(ScreenType.WORLD_SELECTION, this.worldSelectionScreen);
    this.screenManager.register(ScreenType.WORLD_CREATION, this.worldCreationScreen);
    this.screenManager.register(ScreenType.PAUSE, this.pauseScreen);
    this.screenManager.register(ScreenType.SETTINGS, this.settingsScreen);
    this.screenManager.register(ScreenType.CONTROLS, this.controlsScreen);
    this.screenManager.register(ScreenType.INVENTORY, this.inventoryScreen);
    this.screenManager.register(ScreenType.PRESETS, this.presetsScreen);
    this.screenManager.register(ScreenType.LOGIN, this.loginScreen);
    this.screenManager.register(ScreenType.REGISTER, this.registerScreen);
    this.screenManager.register(ScreenType.PROFILE, this.profileScreen);
    this.screenManager.register(ScreenType.PASSWORD_RECOVERY, this.passwordRecoveryScreen);
    this.screenManager.register(ScreenType.LEADERBOARD, this.leaderboardScreen);
    this.screenManager.register(ScreenType.HOW_TO_PLAY, this.howToPlayScreen);
  }

  /**
   * Conecta la progresión del juego con el perfil y la clasificación.
   * @param {import('../progression/ProgressionUiService.js').ProgressionUiService} service
   */
  setProgressionService(service) {
    this.backend2Service = service;
    this.profileScreen.setBackend2Service(service);
    this.leaderboardScreen.setService(service);
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

    this.intentBus.on(IntentBus.Events.START_TUTORIAL, () => {
      this.tutorial.start();
      // Si estaba apagado queda encendido, como si se activara en Configuración.
      this.settingsModel.set('showTutorial', true);
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
      this.buildChallengeHud.setVisible(isPlaying);
      this.chatHintElement.hidden = !isPlaying || this.isTouchMode;
      this.touchControls.setVisible(isPlaying);
      // También en pausa: con el mouse capturado no se pueden tocar sus botones.
      this.tutorial.setVisible(isPlaying || current === ScreenType.PAUSE);
      if (current === ScreenType.PAUSE) this.tutorial.notify(TutorialPanel.Signals.PAUSE_OPENED);
      if (current === ScreenType.INVENTORY) this.tutorial.notify(TutorialPanel.Signals.INVENTORY_OPENED);
      if (current === ScreenType.PRESETS) this.tutorial.notify(TutorialPanel.Signals.PRESETS_OPENED);
      if (!isPlaying) this.chatPanel.close();
      this.healthBar.setVisible(isPlaying && this.settingsModel.get('showHealthBar'));
    });
  }

  #setupKeyboardShortcuts() {
    if (typeof window === 'undefined' || !window.addEventListener) return;

    window.addEventListener('keydown', (e) => {
      // Mientras se escribe en un campo de texto no hay atajos: antes de que
      // existiera el chat no había dónde escribir durante la partida, así que
      // esta guarda solo estaba en el inventario. Sin ella, teclear "o" en el
      // chat abre los ajustes.
      const isEditingText = e.target && (
        e.target.tagName === 'INPUT' ||
        e.target.tagName === 'TEXTAREA' ||
        Boolean(e.target.isContentEditable)
      );

      if (isEditingText && e.code !== 'Escape') return;

      // Atajos activos únicamente durante el juego
      if (this.screenManager.currentScreenType === ScreenType.PLAYING) {
        if (e.code === GameConfig.chatbot.TOGGLE_KEY) {
          e.preventDefault?.();
          this.toggleChat();
        } else if (e.code === 'Escape' && this.chatPanel.isOpen) {
          // El chat se cierra primero: Escape con el chat abierto no debe
          // pausar la partida.
          e.preventDefault?.();
          this.chatPanel.close();
        } else if (e.code === 'KeyE') {
          e.preventDefault?.();
          this.screenManager.open(ScreenType.INVENTORY);
        } else if (e.code === 'KeyP') {
          e.preventDefault?.();
          this.screenManager.open(ScreenType.PRESETS);
        } else if (e.code === 'KeyV') {
          e.preventDefault?.();
          this.hotbarView.speakActiveBlock('syllabic');
        } else if (e.code === 'KeyO') {
          e.preventDefault?.();
          this.screenManager.open(ScreenType.SETTINGS);
        } else if (e.code === 'F1') {
          e.preventDefault?.();
          this.screenManager.open(ScreenType.CONTROLS);
        } else if (e.code === 'F3') {
          e.preventDefault?.();
          this.toggleDebug();
        } else if (e.code === 'Enter' && this.tutorial.isActive) {
          // Con el mouse capturado los botones no se pueden tocar: Enter pasa de paso.
          e.preventDefault?.();
          this.tutorial.next();
        }
      } else if (this.screenManager.currentScreenType === ScreenType.INVENTORY) {
        if (e.code === 'KeyE') {
          if (!isEditingText) {
            e.preventDefault?.();
            this.screenManager.open(ScreenType.PLAYING);
          }
        } else if (e.code === 'Escape') {
          e.preventDefault?.();
          this.screenManager.open(ScreenType.PLAYING);
        }
      } else if (this.screenManager.currentScreenType === ScreenType.PRESETS) {
        if (e.code === 'KeyP' || e.code === 'Escape') {
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
    this.touchControls.mount(this.container);
    this.crosshair.mount(this.container);
    this.hotbarView.mount(this.container);
    this.healthBar.mount(this.container);
    this.debugOverlay.mount(this.container);
    this.buildChallengeHud.mount(this.container);
    this.chatPanel.mount(this.container);
    if (!this.chatHintElement.parentNode) {
      this.container.appendChild(this.chatHintElement);
    }
    this.tutorial.mount(this.container);
    if (!this.clickToPlayElement.parentNode) this.container.appendChild(this.clickToPlayElement);
    this.toast.mount(this.container);

    // Inicializar con el Menú Principal
    this.screenManager.open(ScreenType.MENU);

    // Estado inicial de visibilidad del HUD in-game
    this.crosshair.setVisible(false);
    this.hotbarView.setVisible(false);
    this.healthBar.setVisible(false);
    this.buildChallengeHud.setVisible(false);
    this.chatHintElement.hidden = true;
    this.tutorial.setVisible(false);
  }

  /** Abre o cierra el chat del asistente. */
  /** Muestra u oculta el aviso de hacer clic para capturar el mouse. */
  setClickToPlay(visible) {
    this.clickToPlayElement.hidden = !visible || this.isTouchMode;
  }

  get isTouchMode() {
    return Boolean(this.touchControls?.enabled);
  }

  /** Controles táctiles en vez de teclado y mouse (textos y ayudas incluidos). */
  setTouchMode(touch) {
    this.touchControls.setEnabled(touch);
    this.tutorial.setTouchMode(touch);
    const playing = this.screenManager?.currentScreenType === ScreenType.PLAYING;
    this.chatHintElement.hidden = touch || !playing;
    this.hotbarView.setTouchMode?.(touch);
    this.howToPlayScreen?.setTouchMode(touch);
  }

  toggleChat() {
    this.chatPanel.toggle();
    if (this.chatPanel.isOpen) this.tutorial.notify(TutorialPanel.Signals.CHAT_OPENED);
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
  update(deltaTime, stats, hotbar, activeChallenge = undefined) {
    this.debugOverlay.update(deltaTime, stats);
    this.hotbarView.update(hotbar);
    this.tutorial.update(stats, hotbar, GameConfig.world.BLOCK_SIZE);
    if (activeChallenge !== undefined) {
      this.buildChallengeHud.update(activeChallenge);
    }

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
