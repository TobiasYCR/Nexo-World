import { IntentBus } from './IntentBus.js';
import { ScreenType } from './ScreenType.js';
import { Toast } from './Toast.js';
import { SpeechService } from '../audio/SpeechService.js';

/**
 * Puente desacoplado entre el motor del juego (Game) y la interfaz de usuario (HUD/IntentBus).
 * Canaliza las intenciones del usuario (guardar, cargar, crear mundos, cambiar ajustes)
 * hacia las APIs públicas correspondientes sin violar el encapsulamiento.
 */
export class GameUiBridge {
  /**
   * @param {import('../game/Game.js').Game} game
   * @param {import('./HUD.js').HUD} hud
   * @param {IntentBus} intentBus
   */
  constructor(game, hud, intentBus) {
    this.game = game;
    this.hud = hud;
    this.intentBus = intentBus;
    this.toast = Toast.getInstance(hud.container);

    this.#bindIntents();
    this.#bindAccount();
  }

  /**
   * Con la sesión iniciada, el progreso se guarda a nombre de la cuenta; al
   * cerrarla, vuelve al invitado. Se aplica al arrancar y en cada cambio.
   */
  #bindAccount() {
    const progression = this.game?.progression;
    if (!progression?.useAccount) return;
    const apply = (session) => {
      const user = session?.user;
      const account = session?.isAuthenticated && session.token && user?.playerId
        ? { playerId: user.playerId, token: session.token, name: user.username }
        : null;
      progression.useAccount(account);
    };
    const session = this.hud?.authService?.getSession?.();
    if (session) apply(session);
    this.intentBus.on(IntentBus.Events.AUTH_STATE_CHANGED, ({ session: changed }) => apply(changed));
  }

  #bindIntents() {
    // Sincronizar el ciclo de vida del juego con las pantallas activas
    this.hud?.screenManager?.onChange((current) => {
      if (current === ScreenType.PLAYING) {
        this.game?.resume?.();
      } else {
        this.game?.pause?.();
      }
    });

    if (this.hud?.screenManager?.hasActiveOverlay) {
      this.game?.pause?.();
    }

    // Reanudar partida
    this.intentBus.on(IntentBus.Events.RESUME_GAME, () => {
      this.game?.resume?.();
      this.hud?.screenManager?.open(ScreenType.PLAYING);
    });

    // Pausar partida
    this.intentBus.on(IntentBus.Events.PAUSE_GAME, () => {
      this.game?.pause?.();
      this.hud?.screenManager?.open(ScreenType.PAUSE);
    });

    // Volver al menú
    this.intentBus.on(IntentBus.Events.BACK_TO_MENU, () => {
      this.game?.pause?.();
      this.hud?.screenManager?.open(ScreenType.MENU);
    });

    // Iniciar juego directo
    this.intentBus.on(IntentBus.Events.START_GAME, () => {
      this.game?.resume?.();
      this.hud?.screenManager?.open(ScreenType.PLAYING);
    });

    // Guardar partida en un slot
    this.intentBus.on(IntentBus.Events.SAVE_GAME, (payload) => {
      const slot = payload?.slot || 'default';
      const result = this.game?.saveGame?.(slot);
      if (result?.ok) {
        this.toast.success(`Partida guardada correctamente en "${slot}".`);
      } else {
        this.toast.error(result?.message || 'Error al guardar la partida.');
      }
    });

    // Cargar partida de un slot
    this.intentBus.on(IntentBus.Events.LOAD_GAME, (payload) => {
      const slot = payload?.slot || 'default';
      const result = this.game?.loadGame?.(slot);
      if (result?.ok) {
        this.toast.success(`Partida "${slot}" cargada.`);
        this.hud?.screenManager?.open(ScreenType.PLAYING);
        this.game?.resume?.();
      } else {
        this.toast.error(result?.message || 'Error al cargar la partida.');
      }
    });

    // Cambiar bloque de hotbar
    this.intentBus.on(IntentBus.Events.SET_HOTBAR_BLOCK, (payload) => {
      if (payload?.blockType && this.game?.hotbar) {
        const targetIndex = typeof payload.slotIndex === 'number'
          ? Math.max(0, Math.min(this.game.hotbar.size - 1, payload.slotIndex))
          : this.game.hotbar.selectedIndex;

        const stackCount = payload.count ?? this.game.config?.inventory?.STARTER_BLOCK_COUNT ?? 64;
        const blockType = this.game.blockRegistry?.get?.(payload.blockType.id) ?? payload.blockType;

        this.game.hotbar.set(targetIndex, blockType, stackCount);
        const name = blockType.label || blockType.name || `Bloque ${blockType.id}`;
        this.toast.success(`Equipado ${name} (${stackCount}) en ranura ${targetIndex + 1}.`, 2000);
      }
    });

    // Mostrar Toast desde cualquier componente
    this.intentBus.on(IntentBus.Events.SHOW_TOAST, (payload) => {
      if (payload?.message) {
        this.toast.show(payload.message, payload.type || 'info', payload.duration || 3000);
      }
    });

    // Configuración modificada
    this.intentBus.on(IntentBus.Events.SETTINGS_CHANGED, ({ key, value }) => {
      this.#applySetting(key, value);
    });

    // Modo Educativo: Iniciar desafío de construcción con preset
    this.intentBus.on(IntentBus.Events.START_BUILD_CHALLENGE, (payload) => {
      const presetId = payload?.presetId || payload?.id || payload?.name;
      if (!presetId || !this.game?.buildChallenge) return;

      const snapshot = this.game.buildChallenge.startChallenge(presetId, payload.options);
      if (snapshot) {
        this.hud?.buildChallengeHud?.update?.(snapshot);
        this.toast.success(`Plano "${snapshot.name}" activado. ¡Sigue la guía en el mundo 3D!`, 3500);
        if (snapshot.nextBlock) {
          SpeechService.getInstance().speakSyllables(snapshot.nextBlock);
        }
      }
    });

    // Modo Educativo: Cancelar desafío activo
    this.intentBus.on(IntentBus.Events.CANCEL_BUILD_CHALLENGE, () => {
      this.game?.buildChallenge?.cancelChallenge?.();
      this.hud?.buildChallengeHud?.update?.(null);
      this.toast.info('Desafío de construcción finalizado.', 2500);
    });

    // Modo Educativo: Pronunciar bloque bajo demanda
    this.intentBus.on(IntentBus.Events.SPEAK_BLOCK, (payload) => {
      const block = payload?.block ?? payload;
      if (block) {
        SpeechService.getInstance().speak(block, payload);
      }
    });

    // Suscribirse a cambios en el progreso del desafío para notificar finalización
    this.game?.buildChallenge?.onChange?.((snapshot, reason) => {
      this.hud?.buildChallengeHud?.update?.(snapshot);
      if (reason === 'completed' && snapshot) {
        this.toast.success(`¡Completaste el plano "${snapshot.name}"!`, 4500);
        SpeechService.getInstance().speakWord(`¡Felicitaciones! Construiste ${snapshot.name}`);
      }
    });
  }

  #applySetting(key, value) {
    if (key === 'fov' && this.game?.camera?.setFov) {
      this.game.camera.setFov(value);
    } else if (key === 'mouseSensitivity' && this.game?.camera?.setSensitivity) {
      this.game.camera.setSensitivity(value);
    } else if (key === 'showDebug' && this.hud?.debugOverlay) {
      this.hud.debugOverlay.setVisible(value);
    } else if (key === 'crosshairSize' && this.hud?.crosshair) {
      this.hud.crosshair.setSize(value);
    } else if (key === 'crosshairOpacity' && this.hud?.crosshair) {
      this.hud.crosshair.setOpacity(value);
    } else if (key === 'debugUpdateInterval' && this.hud?.debugOverlay) {
      this.hud.debugOverlay.setUpdateInterval(value / 1000);
    }
  }
}
