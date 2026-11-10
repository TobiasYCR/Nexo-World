import { IntentBus } from './IntentBus.js';
import { ScreenType } from './ScreenType.js';
import { Toast } from './Toast.js';
import { SpeechService } from '../audio/SpeechService.js';
import { BuildChallengeView } from './BuildChallengeView.js';
import { GameEventTypes } from '../game/GameEvents.js';
import { ProgressionUiService } from '../progression/ProgressionUiService.js';
import { SettingsApplier } from './SettingsApplier.js';

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
    // La configuración guardada se aplica al arrancar y cada cambio, al instante.
    this.settings = new SettingsApplier(game, hud, { speech: SpeechService.getInstance() });
    this.settings.bind(hud?.settingsModel);
    if (game?.progression && hud?.setProgressionService) {
      hud.setProgressionService(new ProgressionUiService(game.progression, { config: game.config?.progression }));
    }
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

    // Crear un mundo nuevo con nombre, semilla y modo. WorldCreationScreen
    // emite después SAVE_GAME con el nombre, así que queda guardado.
    this.intentBus.on(IntentBus.Events.CREATE_WORLD, (payload) => {
      const result = this.game?.newWorld?.({ name: payload?.name, seed: payload?.seed, mode: payload?.gameMode });
      if (payload && result) payload.result = result;
      if (result && !result.ok) this.toast.error(result.message ?? 'No se pudo crear el mundo.');
    });


    // Modo Educativo: iniciar y cancelar el desafío de construcción (reglas en BuildChallenge).
    this.intentBus.on(IntentBus.Events.START_BUILD_CHALLENGE, (payload) => {
      this.#startChallenge(payload?.presetId ?? payload?.id);
    });

    this.intentBus.on(IntentBus.Events.CANCEL_BUILD_CHALLENGE, () => {
      const result = this.game?.buildChallenge?.cancel?.();
      if (result?.ok) this.toast.info('Desafío de construcción finalizado.', 2500);
    });

    // Modo Educativo: Pronunciar bloque bajo demanda
    this.intentBus.on(IntentBus.Events.SPEAK_BLOCK, (payload) => {
      const block = payload?.block ?? payload;
      if (block) {
        SpeechService.getInstance().speak(block, payload);
      }
    });

    this.#bindBuildChallenge();
  }

  /**
   * Conecta el desafío del juego con la interfaz: carga los planos en la
   * pantalla de selección y actualiza el panel con cada cambio.
   */
  #bindBuildChallenge() {
    const challenge = this.game?.buildChallenge;
    const events = this.game?.events;
    if (!challenge || !this.game.blockRegistry) return;
    this.challengeView = new BuildChallengeView(this.game.blockRegistry);
    this.hud?.presetsScreen?.setPresets?.(this.challengeView.presets(challenge.blueprints()));
    this.hud?.buildChallengeHud?.update?.(this.challengeView.challenge(challenge.snapshot()));
    if (!events) return;

    const refresh = ({ snapshot }) => this.hud?.buildChallengeHud?.update?.(this.challengeView.challenge(snapshot));
    events.on(GameEventTypes.BUILD_CHALLENGE_STARTED, refresh);
    events.on(GameEventTypes.BUILD_CHALLENGE_PROGRESS, refresh);
    events.on(GameEventTypes.BUILD_CHALLENGE_CANCELLED, () => this.hud?.buildChallengeHud?.update?.(null));
    events.on(GameEventTypes.BUILD_CHALLENGE_COMPLETED, ({ snapshot }) => {
      this.toast.success(`¡Completaste el plano "${snapshot.name}"!`, 4500);
      SpeechService.getInstance().speakWord(`¡Felicitaciones! Construiste ${snapshot.name}`);
    });
  }

  #startChallenge(blueprintId) {
    const challenge = this.game?.buildChallenge;
    if (!blueprintId || !challenge) return;
    const result = challenge.start(blueprintId);
    if (!result.ok) {
      this.toast.error(result.message ?? 'No se pudo ubicar el plano acá. Probá en un lugar más despejado.', 4000);
      return;
    }
    // En creativo se cargan los materiales en la hotbar; en supervivencia hay que juntarlos.
    if (this.game.progression?.mode === 'creative') this.#equipMaterials(result.snapshot);
    this.toast.success(`Plano "${result.name}" activado. ¡Seguí la guía en el mundo!`, 3500);
    const next = this.challengeView.challenge(result.snapshot)?.nextBlock;
    if (next) SpeechService.getInstance().speakSyllables(next);
  }

  #equipMaterials(snapshot) {
    const hotbar = this.game.hotbar;
    if (!hotbar) return;
    snapshot.materials.slice(0, hotbar.size).forEach((material, index) => {
      hotbar.set(index, this.game.blockRegistry.get(material.blockId), Math.max(material.required, 64));
    });
    hotbar.select(0);
  }
}
