import { Crosshair } from './Crosshair.js';
import { DebugOverlay } from './DebugOverlay.js';
import { HotbarView } from './HotbarView.js';
import { ScreenId } from './navigation/ScreenId.js';
import { UIIntent } from './navigation/UIIntent.js';
import { IntentBus } from './navigation/IntentBus.js';
import { ScreenManager } from './navigation/ScreenManager.js';
import { EngineBridge } from './navigation/EngineBridge.js';
import { MainMenuScreen } from './screens/MainMenuScreen.js';
import { PauseScreen } from './screens/PauseScreen.js';
import { PlaceholderScreen } from './screens/PlaceholderScreen.js';

/**
 * Raíz de toda la interfaz. Vive en el DOM, por encima del canvas: así el
 * texto usa el renderizado nativo del navegador y la UI puede migrarse a
 * React más adelante sin tocar el motor.
 *
 * Es también el único punto de contacto que Game.js conoce de src/ui/: su
 * contrato público (constructor, mount(), toggleDebug(), update()) es
 * exactamente el mismo que antes, así que agregar menú, pausa y navegación
 * acá adentro no requiere tocar ningún archivo fuera de src/ui/.
 *
 * HUD solo muestra datos que le pasan; nunca consulta el mundo por su cuenta.
 */
export class HUD {
  constructor(containerId = 'ui-root') {
    this.container = document.getElementById(containerId);
    if (!this.container) {
      throw new Error(`No existe el contenedor de interfaz "#${containerId}".`);
    }

    this.crosshair = new Crosshair();
    this.debugOverlay = new DebugOverlay();
    this.hotbar = new HotbarView();

    // Capa siempre presente durante la partida (mira + hotbar + debug),
    // separada de las pantallas para poder ocultarla entera de una.
    this.gameLayer = document.createElement('div');
    this.gameLayer.className = 'hud-game-layer';

    this.intentBus = new IntentBus();
    this.engineBridge = new EngineBridge();
    this.screens = new ScreenManager(this.container);

    this.#bindIntents();
    this.#bindEngineState();
  }

  mount() {
    this.crosshair.mount(this.gameLayer);
    this.hotbar.mount(this.gameLayer);
    this.debugOverlay.mount(this.gameLayer);
    // La capa de juego se cuelga ANTES que las pantallas para que un overlay
    // (menú, pausa) siempre pinte por encima del crosshair/hotbar.
    this.container.appendChild(this.gameLayer);

    this.#registerScreens();
    this.#navigateTo(ScreenId.MENU);
  }

  toggleDebug() {
    this.debugOverlay.toggle();
  }

  update(deltaTime, stats) {
    this.engineBridge.notifyState(stats.state);
    this.debugOverlay.update(deltaTime, stats);
  }

  #registerScreens() {
    this.screens.register(new MainMenuScreen(this.intentBus));
    this.screens.register(new PauseScreen(this.intentBus));
    this.screens.register(new PlaceholderScreen(ScreenId.SETTINGS, 'Configuración', this.intentBus));
    this.screens.register(new PlaceholderScreen(ScreenId.CONTROLS, 'Controles', this.intentBus));
  }

  /** Traduce intenciones de las pantallas en navegación + (parche) motor. */
  #bindIntents() {
    this.intentBus.on(UIIntent.PLAY, () => this.#enterGameplay());
    this.intentBus.on(UIIntent.RESUME, () => this.#enterGameplay());

    this.intentBus.on(UIIntent.RETURN_TO_MENU, () => {
      // El juego queda pausado a propósito: no se llama a resumeIfPaused().
      this.#navigateTo(ScreenId.MENU);
    });

    this.intentBus.on(UIIntent.OPEN_SETTINGS, () => this.#navigateTo(ScreenId.SETTINGS));
    this.intentBus.on(UIIntent.OPEN_CONTROLS, () => this.#navigateTo(ScreenId.CONTROLS));
    this.intentBus.on(UIIntent.BACK, () => this.#goBack());
  }

  #goBack() {
    this.screens.back();
    this.#syncGameLayerVisibility();
  }

  #enterGameplay() {
    // Si veníamos de pausa, hay que reanudar el motor; si veníamos del menú
    // inicial el motor ya está corriendo y esto no hace nada.
    this.engineBridge.resumeIfPaused();
    // Pointer Lock necesita un gesto del usuario: esto corre síncrono dentro
    // del click real de "Jugar"/"Reanudar", así que es válido.
    this.engineBridge.requestPointerLock();
    this.#navigateTo(ScreenId.PLAYING);
  }

  /** Reacciona a que el motor se pausó o reanudó por su cuenta (tecla Esc real). */
  #bindEngineState() {
    this.engineBridge.onStateChange(() => {
      if (this.engineBridge.isPaused) {
        this.engineBridge.releasePointerLock();
        this.#navigateTo(ScreenId.PAUSE);
      } else if (this.screens.activeId === ScreenId.PAUSE) {
        this.#navigateTo(ScreenId.PLAYING);
      }
    });
  }

  /** Único punto por el que se navega hacia una pantalla conocida por id. */
  #navigateTo(id) {
    this.screens.goTo(id);
    this.#syncGameLayerVisibility();
  }

  #syncGameLayerVisibility() {
    this.gameLayer.hidden = this.screens.activeId !== ScreenId.PLAYING;
  }
}
