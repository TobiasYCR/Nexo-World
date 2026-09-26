import { IntentBus } from './IntentBus.js';
import { ScreenType } from './ScreenType.js';
import { Toast } from './Toast.js';
import { SaveResult } from '../persistence/SaveResult.js';
import { GameStates } from '../game/GameState.js';

/**
 * Puente bidireccional entre el motor del juego (Game) y la interfaz de usuario (HUD e IntentBus).
 * Centraliza la conversión de intenciones en llamadas a sistemas del juego y refleja
 * los cambios de estado en las pantallas y componentes visuales.
 */
export class GameUiBridge {
  /**
   * @param {import('../game/Game.js').Game} game
   */
  constructor(game) {
    if (!game) {
      throw new Error('GameUiBridge requiere una instancia válida de Game.');
    }

    this.game = game;
    this.hud = game.hud;
    this.intentBus = game.hud?.intentBus;
    this.settingsModel = game.hud?.settingsModel;
    this.screenManager = game.hud?.screenManager;
    this.saveManager = game.saveManager;

    const uiRoot = game.hud?.container || (typeof document !== 'undefined' ? document.getElementById('ui-root') : null);
    this.toast = new Toast(uiRoot);

    this.#connectSubsystems();
    this.#setupIntentListeners();
    this.#setupStateListener();
    this.applyAllSettings();
  }

  #connectSubsystems() {
    if (this.hud) {
      this.hud.hotbar = this.game.hotbar;
      if (this.hud.menuScreen) {
        this.hud.menuScreen.saveManager = this.saveManager;
      }
      if (this.hud.inventoryScreen) {
        this.hud.inventoryScreen.blockRegistry = this.game.blockRegistry;
      }
    }
  }

  #setupStateListener() {
    if (this.game.state?.onChange) {
      this.game.state.onChange((nextState) => {
        if (nextState === GameStates.PAUSED) {
          if (this.screenManager?.currentScreenType === ScreenType.PLAYING) {
            this.screenManager.open(ScreenType.PAUSE);
          }
        } else if (nextState === GameStates.RUNNING) {
          if (this.screenManager?.currentScreenType === ScreenType.PAUSE) {
            this.screenManager.open(ScreenType.PLAYING);
          }
        }
      });
    }
  }

  #setupIntentListeners() {
    if (!this.intentBus) return;

    this.intentBus.on(IntentBus.Events.START_GAME, () => {
      this.resume();
      this.screenManager?.open(ScreenType.PLAYING);
    });

    this.intentBus.on(IntentBus.Events.RESUME_GAME, () => {
      this.resume();
      this.screenManager?.open(ScreenType.PLAYING);
    });

    this.intentBus.on(IntentBus.Events.PAUSE_GAME, () => {
      this.pause();
      this.screenManager?.open(ScreenType.PAUSE);
    });

    this.intentBus.on(IntentBus.Events.BACK_TO_MENU, () => {
      this.pause();
      this.screenManager?.open(ScreenType.MENU);
      this.hud?.menuScreen?.updateSaveState?.();
    });

    this.intentBus.on(IntentBus.Events.SETTINGS_CHANGED, ({ key, value }) => {
      this.applySetting(key, value);
    });

    this.intentBus.on(IntentBus.Events.RESTORE_DEFAULTS, () => {
      this.applyAllSettings();
    });

    this.intentBus.on(IntentBus.Events.SET_HOTBAR_SLOT, ({ index }) => {
      if (typeof index === 'number' && this.game.hotbar?.select) {
        this.game.hotbar.select(index);
      }
    });

    this.intentBus.on(IntentBus.Events.SET_HOTBAR_BLOCK, ({ blockType, count = 64 }) => {
      if (this.game.hotbar?.setSlot) {
        this.game.hotbar.setSlot(this.game.hotbar.selectedIndex, blockType, count);
      }
    });

    this.intentBus.on(IntentBus.Events.SAVE_GAME, ({ slot = 'quicksave' } = {}) => {
      this.saveGame(slot);
    });

    this.intentBus.on(IntentBus.Events.LOAD_GAME, ({ slot = 'quicksave' } = {}) => {
      this.loadGame(slot);
    });

    this.intentBus.on(IntentBus.Events.CONTINUE_GAME, ({ slot = 'quicksave' } = {}) => {
      const res = this.loadGame(slot);
      if (res.ok) {
        this.resume();
        this.screenManager?.open(ScreenType.PLAYING);
      }
    });
  }

  pause() {
    if (typeof this.game.pause === 'function') {
      this.game.pause();
    } else if (this.game.state?.set) {
      this.game.state.set(GameStates.PAUSED);
    }
  }

  resume() {
    if (typeof this.game.resume === 'function') {
      this.game.resume();
    } else if (this.game.state?.set) {
      this.game.state.set(GameStates.RUNNING);
    }
  }

  saveGame(slot = 'quicksave') {
    let result;
    if (typeof this.game.saveGame === 'function') {
      result = this.game.saveGame(slot);
    } else if (this.saveManager?.save) {
      result = this.saveManager.save(slot, this.game.world, this.game.player);
    } else {
      result = SaveResult.fail(SaveResult.Reasons.STORAGE_UNAVAILABLE, 'Gestor de guardado no disponible');
    }

    if (result.ok) {
      const msg = result.message || 'Partida guardada correctamente.';
      this.toast.success(msg);
    } else {
      const msg = result.message || 'Error al guardar la partida.';
      this.toast.error(msg);
    }

    this.hud?.menuScreen?.updateSaveState?.(slot);
    return result;
  }

  loadGame(slot = 'quicksave') {
    let result;
    if (typeof this.game.loadGame === 'function') {
      result = this.game.loadGame(slot);
    } else if (this.saveManager?.load) {
      result = this.saveManager.load(slot, this.game.world, this.game.player);
    } else {
      result = SaveResult.fail(SaveResult.Reasons.NOT_FOUND, 'Gestor de guardado no disponible');
    }

    if (result.ok) {
      const msg = result.message || 'Partida cargada correctamente.';
      this.toast.success(msg);
    } else {
      const msg = result.message || 'Error al cargar la partida.';
      this.toast.error(msg);
    }

    return result;
  }

  applySetting(key, value) {
    if (!key || value === undefined) return;

    switch (key) {
      case 'mouseSensitivity':
        this.game.camera?.setSensitivityMultiplier?.(value);
        break;

      case 'fov':
        this.game.camera?.setFov?.(value);
        break;

      case 'masterVolume':
        this.game.audio?.setMasterVolume?.(value / 100);
        break;

      case 'renderDistance': {
        const chunkSize = this.game.config?.chunk?.SIZE_X || 16;
        this.game.renderer?.setRenderDistance?.(value * chunkSize);
        break;
      }

      case 'showDebug':
        this.hud?.debugOverlay?.setVisible?.(value);
        break;

      default:
        break;
    }
  }

  applyAllSettings() {
    if (!this.settingsModel) return;
    const all = this.settingsModel.getAll();
    for (const [key, value] of Object.entries(all)) {
      this.applySetting(key, value);
    }
  }
}
