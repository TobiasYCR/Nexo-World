import { GameConfig } from './GameConfig.js';
import { GameState, GameStates } from './GameState.js';
import { createDefaultBlockRegistry } from '../blocks/BlockRegistry.js';
import { World } from '../world/World.js';
import { WorldGenerator } from '../world/WorldGenerator.js';
import { WorldSeed } from '../world/WorldSeed.js';
import { SpawnFinder } from '../world/SpawnFinder.js';
import { FootstepPlayer } from '../audio/FootstepPlayer.js';
import { GameModeRules } from './GameModeRules.js';
import { Player } from '../player/Player.js';
import { PlayerController } from '../player/PlayerController.js';
import { PlayerPhysics } from '../player/PlayerPhysics.js';
import { BlockInteraction } from '../player/BlockInteraction.js';
import { PlayerHealth, DamageCauses } from '../player/PlayerHealth.js';
import { NaturalTerrain } from '../world/NaturalTerrain.js';
import { PlayerProgression } from '../progression/PlayerProgression.js';
import { WorldKey } from '../progression/WorldKey.js';
import { FirstPersonCamera } from '../camera/FirstPersonCamera.js';
import { CollisionSystem } from '../physics/CollisionSystem.js';
import { Raycast } from '../physics/Raycast.js';
import { InputManager } from '../input/InputManager.js';
import { TextureManager } from '../rendering/TextureManager.js';
import { BlockRenderer } from '../rendering/BlockRenderer.js';
import { Renderer } from '../rendering/Renderer.js';
import { Hotbar } from '../inventory/Hotbar.js';
import { AudioManager } from '../audio/AudioManager.js';
import { GameEvents, GameEventTypes } from './GameEvents.js';
import { HUD } from '../ui/HUD.js';
import { SaveManager } from '../persistence/SaveManager.js';
import { InputActions, SoundIds } from '../utils/Constants.js';
import { MathUtils } from '../utils/MathUtils.js';
import { BlockHighlight } from '../viewmodel/BlockHighlight.js';
import { BreakOverlay } from '../viewmodel/BreakOverlay.js';
import { BlockParticles } from '../viewmodel/BlockParticles.js';
import { HandRenderer } from '../viewmodel/HandRenderer.js';
import { LevelUpEffect } from '../viewmodel/LevelUpEffect.js';
import { AmbientParticles } from '../viewmodel/AmbientParticles.js';
import { LandingEffect } from '../viewmodel/LandingEffect.js';
import { DamageEffect } from '../viewmodel/DamageEffect.js';
import { CameraEffects } from '../viewmodel/CameraEffects.js';
import { VisualEffectsManager } from '../viewmodel/VisualEffectsManager.js';
import { createDefaultBlueprintRegistry } from '../education/BlueprintRegistry.js';
import { BuildChallenge } from '../education/BuildChallenge.js';
import { BlueprintGhost } from '../viewmodel/BlueprintGhost.js';
import { ChallengeCompleteEffect } from '../viewmodel/ChallengeCompleteEffect.js';

/**
 * Coordinador de sistemas. Game construye las dependencias, define el orden de
 * actualización y reparte responsabilidades; no implementa reglas de mundo,
 * física ni dibujado. Cada sistema es reemplazable de forma aislada.
 */
export class Game {
  #viewmodelState = { isBreaking: false, horizontalSpeed: 0, isOnGround: false };
  /** Nombre (si se guardó), semilla y modo de la partida en curso. */
  #session = { name: null, seed: 0, mode: 'survival' };

  /**
   * @param {object} p instancia de p5
   * @param {object} [config] GameConfig
   * @param {{seed?: number, mode?: string, progression?: PlayerProgression}} [options]
   *   seed reemplaza a config.world.SEED para esta partida; mode elige la clasificación;
   *   progression permite inyectar otra integración (tests)
   */
  constructor(p, config = GameConfig, options = {}) {
    this.p = p;
    this.config = config;
    this.state = new GameState(GameStates.LOADING);

    this.blockRegistry = createDefaultBlockRegistry();
    this.world = new World(this.blockRegistry, config);
    this.worldGenerator = new WorldGenerator(config, { seed: options.seed });

    this.spawnFinder = new SpawnFinder(Math.ceil(config.player.HEIGHT / config.world.BLOCK_SIZE));
    this.collisionSystem = new CollisionSystem(this.world);
    this.raycast = new Raycast(this.world);

    this.camera = new FirstPersonCamera(config.camera);
    this.cameraEffects = new CameraEffects(config.viewmodel.cameraEffects);
    this.camera.setVisualEffects(this.cameraEffects);
    this.player = new Player(config.player);
    this.input = new InputManager(config.input);
    this.playerController = new PlayerController(this.player, this.camera, this.input);
    this.playerPhysics = new PlayerPhysics(this.player, this.collisionSystem, config.player);
    this.playerPhysics.flyCeilingY = (this.world.height + config.player.FLY_CEILING_ABOVE_WORLD) * this.world.blockSize;
    this.events = new GameEvents();
    this.playerHealth = new PlayerHealth(config.survival, this.events);
    this.progression = options.progression ?? new PlayerProgression({
      config: config.progression,
      events: this.events,
      mode: options.mode ?? config.progression.GAME_MODE,
      levelConfig: config.levels ?? GameConfig.levels
    });
    this.blueprintRegistry = createDefaultBlueprintRegistry(this.blockRegistry, config.education);
    this.buildChallenge = new BuildChallenge({
      world: this.world,
      player: this.player,
      camera: this.camera,
      blueprintRegistry: this.blueprintRegistry,
      blockRegistry: this.blockRegistry,
      events: this.events,
      config: config.education
    });
    /** Mundo tal como lo generó la semilla; lo usan las reglas de progresión. */
    this.naturalTerrain = null;

    this.textureManager = new TextureManager(p, config.assets);
    this.blockRenderer = new BlockRenderer(p, this.blockRegistry, this.textureManager, config);
    this.renderer = new Renderer(p, this.blockRenderer, config.rendering);

    this.hotbar = new Hotbar(config.inventory.HOTBAR_SIZE);
    this.blockInteraction = new BlockInteraction(this.world, this.player, this.hotbar, this.raycast, config, this.events);
    this.blockHighlight = new BlockHighlight(config.viewmodel.highlight, config.world.BLOCK_SIZE);
    this.breakOverlay = new BreakOverlay(p, config.viewmodel.breakOverlay, config.world.BLOCK_SIZE);
    this.blockParticles = new BlockParticles(config.viewmodel.particles);
    this.levelUpEffect = new LevelUpEffect(config.levels ?? GameConfig.levels, config.camera, this.camera);
    this.blueprintGhost = new BlueprintGhost({
      p,
      blockRegistry: this.blockRegistry,
      blockSize: config.world.BLOCK_SIZE,
      config: config.education
    });
    this.challengeCompleteEffect = new ChallengeCompleteEffect(config.education, config.camera, this.camera);
    this.ambientParticles = new AmbientParticles(config.viewmodel.ambientParticles, {
      world: this.world,
      blockSize: config.world.BLOCK_SIZE
    });
    this.landingEffect = new LandingEffect(config.viewmodel.landing);
    this.damageEffect = new DamageEffect(config.viewmodel.damage);
    this.handRenderer = new HandRenderer(
      this.textureManager,
      this.camera,
      config.viewmodel.hand,
      config.camera,
      config.viewmodel.viewBob,
      config.viewmodel.handAnimator
    );
    this.visualEffectsManager = new VisualEffectsManager({
      events: this.events,
      renderer: this.renderer,
      world: this.world,
      blockSize: config.world.BLOCK_SIZE,
      handRenderer: this.handRenderer,
      blockHighlight: this.blockHighlight,
      breakOverlay: this.breakOverlay,
      blockParticles: this.blockParticles,
      ambientParticles: this.ambientParticles,
      landingEffect: this.landingEffect,
      damageEffect: this.damageEffect,
      cameraEffects: this.cameraEffects
    });
    // Se mantienen los tres overlays existentes como entradas independientes
    // para preservar su contrato público; el manager coordina sus estados y
    // dibuja los efectos nuevos y la mano en el orden final.
    // La guía se registra antes del resaltado para que el bloque apuntado siga
    // siendo visible por encima del plano.
    this.renderer.addOverlay(this.blueprintGhost);
    this.renderer.addOverlay(this.blockHighlight);
    this.renderer.addOverlay(this.breakOverlay);
    this.renderer.addOverlay(this.blockParticles);
    this.renderer.addOverlay(this.levelUpEffect);
    this.events.on(GameEventTypes.LEVEL_UP, ({ level }) => this.levelUpEffect.trigger(level));
    this.events.on(GameEventTypes.BUILD_CHALLENGE_STARTED, ({ snapshot }) => this.blueprintGhost.update(snapshot));
    this.events.on(GameEventTypes.BUILD_CHALLENGE_PROGRESS, ({ snapshot }) => this.blueprintGhost.update(snapshot));
    this.events.on(GameEventTypes.BUILD_CHALLENGE_CANCELLED, () => this.blueprintGhost.clear());
    this.events.on(GameEventTypes.BUILD_CHALLENGE_COMPLETED, () => this.challengeCompleteEffect.trigger());
    this.renderer.addOverlay(this.challengeCompleteEffect);
    this.renderer.addOverlay(this.visualEffectsManager);
    this.audio = new AudioManager(config.assets);
    this.footsteps = new FootstepPlayer(config.audio, config.world.BLOCK_SIZE);
    this.events.on(GameEventTypes.BLOCK_BROKEN, () => this.audio.play(SoundIds.BLOCK_BREAK));
    this.events.on(GameEventTypes.BLOCK_PLACED, () => this.audio.play(SoundIds.BLOCK_PLACE));
    // El asistente lee el estado vivo de la partida. Se pasa un proveedor y no
    // los objetos porque el estado cambia en cada frame y el HUD se arma una
    // sola vez; además así el chat no guarda referencias que impidan liberar
    // una partida descartada.
    this.hud = new HUD('ui-root', {
      gameContextProvider: () => ({
        player: this.player,
        world: this.world,
        hotbar: this.hotbar,
        health: this.playerHealth,
        worldGenerator: this.worldGenerator,
        progression: this.progression,
        session: this.session,
        buildChallenge: this.buildChallenge ?? null
      })
    });
    this.saveManager = new SaveManager();
    this.#session = { name: null, seed: this.worldGenerator.seed, mode: this.progression.mode };
    this.#applyModeRules(this.progression.mode);
  }

  /** Nombre, semilla y modo de la partida en curso. */
  get session() {
    return { ...this.#session };
  }

  /** Prepara mundo, jugador e interfaz. La carga de texturas no bloquea el arranque. */
  async start(canvasElement) {
    this.worldGenerator.generate(this.world);
    this.naturalTerrain = NaturalTerrain.fromGeneration(this.world, this.worldGenerator);
    this.#placePlayerOnSurface();
    this.#fillStarterHotbar();
    this.#session.seed = this.worldGenerator.seed;

    this.hud.mount();
    this.input.attach(canvasElement);
    this.#bindPointerLock(canvasElement);

    this.state.set(GameStates.RUNNING);
    // Deliberadamente sin await: la conexión con el servidor de puntuaciones no frena el arranque.
    this.progression.start(this.naturalTerrain, WorldKey.fromGenerator(this.worldGenerator, this.world));

    // Deliberadamente sin await: el mundo se dibuja con colores hasta que lleguen.
    this.textureManager.loadAll(this.blockRegistry.textureNames());
    this.audio.preload().catch(() => {});
  }

  /**
   * Actualización lógica de un frame.
   * @param {number} deltaTime segundos transcurridos desde el frame anterior
   */
  update(deltaTime) {
    this.#handleGlobalActions();

    if (this.state.isRunning) {
      this.playerController.update();
      this.blockInteraction.update(this.player.eyePosition, this.camera.lookDirection);
      this.#handleBlockInteractions(deltaTime);
      const wasOnGround = this.player.isOnGround;
      const previousVelocityY = this.player.velocity.y;
      this.playerPhysics.update(deltaTime);
      if (!wasOnGround && this.player.isOnGround) {
        const impactSpeed = this.#landingImpactSpeed(previousVelocityY, deltaTime);
        this.events.emit(GameEventTypes.PLAYER_LANDED, { position: this.player.position, impactSpeed });
        if (this.modeRules.takesDamage) this.playerHealth.applyFallImpact(impactSpeed);
      }
      this.#handleVoidFall();
      if (this.playerHealth.isDead) this.#respawn();
      this.#syncCameraToPlayer();
      this.#handleHotbarSelection();
      this.#updateProgression(deltaTime);
    }

    this.#updateViewmodel(deltaTime);
    this.hud.update(deltaTime, this.#buildDebugStats(), {
      selectedIndex: this.hotbar.selectedIndex,
      slots: this.hotbar.slots.map(({ blockType, count }) => ({ blockType, count }))
    });
    this.input.endFrame();
  }

  /** Dibujado de un frame. Delegado por completo en el renderer. */
  render() {
    this.renderer.render(this.world, this.camera);
  }

  onResize(width, height) {
    this.p.resizeCanvas(width, height);
  }

  #handleGlobalActions() {
    if (this.input.wasActionJustPressed(InputActions.TOGGLE_DEBUG)) this.hud.toggleDebug();
    if (this.input.wasActionJustPressed(InputActions.PAUSE)) this.togglePause();
  }

  togglePause() {
    this.state.set(this.state.isRunning ? GameStates.PAUSED : GameStates.RUNNING);
    if (this.state.isPaused) this.progression.flush();
  }

  pause() {
    this.state.set(GameStates.PAUSED);
    this.progression.flush();
  }

  resume() {
    this.state.set(GameStates.RUNNING);
  }

  get isPaused() {
    return this.state.isPaused;
  }

  saveGame(slot) {
    this.progression.flush();
    const result = this.saveManager.save(slot, this.world, this.player, {
      name: slot,
      seed: this.#session.seed,
      mode: this.#session.mode,
      challenge: this.buildChallenge.exportState()
    });
    if (result.ok) this.#session.name = slot;
    return result;
  }

  /**
   * Crea un mundo nuevo y reemplaza el actual (lo que no se guardó se pierde).
   * @param {{name?:string, seed?:string|number, mode?:string}} [options]
   *   seed acepta un número o cualquier texto; vacío elige una al azar
   * @returns {{ok:boolean, reason?:string, message?:string, seed?:number, mode?:string}}
   */
  newWorld({ name = null, seed, mode = this.#session.mode } = {}) {
    if (!GameModeRules.isValid(mode, this.config.modes)) {
      return { ok: false, reason: 'invalidMode', message: `Modo de juego desconocido: "${mode}".` };
    }
    const numericSeed = WorldSeed.from(seed);

    this.buildChallenge.cancel();
    this.world.clear();
    this.worldGenerator = new WorldGenerator(this.config, { seed: numericSeed });
    this.worldGenerator.generate(this.world);
    this.naturalTerrain = NaturalTerrain.fromGeneration(this.world, this.worldGenerator);

    this.#session = { name: typeof name === 'string' && name.trim() !== '' ? name.trim() : null, seed: numericSeed, mode };
    this.#applyModeRules(mode);
    this.#resetPlayerState();
    this.hotbar.clear();
    this.#fillStarterHotbar();
    this.progression.switchWorld(this.naturalTerrain, WorldKey.fromGenerator(this.worldGenerator, this.world), mode);
    return { ok: true, seed: numericSeed, mode };
  }

  /**
   * Carga una partida. Si se guardó con otra semilla o en otro modo, también
   * se cambian el generador, las reglas del modo y la progresión; los
   * guardados anteriores a este formato conservan la semilla y el modo actuales.
   */
  loadGame(slot) {
    this.buildChallenge.cancel();
    const result = this.saveManager.load(slot, this.world, this.player);
    if (!result.ok) return result;

    const meta = result.meta ?? {};
    const seed = Number.isInteger(meta.seed) ? meta.seed >>> 0 : this.#session.seed;
    const mode = GameModeRules.isValid(meta.mode, this.config.modes) ? meta.mode : this.#session.mode;
    if (seed !== this.#session.seed || mode !== this.#session.mode) {
      if (seed !== this.worldGenerator.seed) {
        // El terreno natural sale de la semilla, no de lo guardado: se genera aparte.
        this.worldGenerator = new WorldGenerator(this.config, { seed });
        const pristine = new World(this.blockRegistry, this.config);
        this.worldGenerator.generate(pristine);
        this.naturalTerrain = NaturalTerrain.fromGeneration(pristine, this.worldGenerator);
      }
      this.#applyModeRules(mode);
      this.progression.switchWorld(this.naturalTerrain, WorldKey.fromGenerator(this.worldGenerator, this.world), mode);
    }
    this.#session = { name: slot, seed, mode };

    this.playerHealth.reset();
    this.#syncCameraToPlayer();
    this.levelUpEffect.reset();
    this.visualEffectsManager.reset();
    if (meta.challenge) this.buildChallenge.restoreState(meta.challenge);
    return result;
  }

  /** Aplica las reglas del modo a los sistemas que cambian con él. */
  #applyModeRules(mode) {
    this.modeRules = new GameModeRules(mode, this.config.modes);
    this.blockInteraction.setInfiniteBlocks(this.modeRules.infiniteBlocks);
    this.blockInteraction.breaker.setFixedDuration(this.modeRules.breakSeconds);
    this.player.canFly = this.modeRules.canFly;
    if (!this.modeRules.canFly) this.player.isFlying = false;
  }

  /** Jugador en el suelo, con vida completa y sin efectos pendientes. */
  #resetPlayerState() {
    this.player.isFlying = false;
    this.#placePlayerOnSurface();
    this.playerHealth.reset();
    this.blockInteraction.updateBreaking(0, false);
    this.levelUpEffect.reset();
    this.visualEffectsManager.reset();
  }

  /** Bloque bajo la mira, expuesto para que el renderer dibuje el resaltado. */
  get targetedBlock() {
    return this.blockInteraction.targetedBlock;
  }

  #handleHotbarSelection() {
    const requestedSlot = this.input.requestedHotbarSlot();
    if (requestedSlot >= 0) this.hotbar.select(requestedSlot);
    const requestedCycle = this.input.requestedHotbarCycle();
    if (requestedCycle !== 0) this.hotbar.cycle(requestedCycle);
  }

  /**
   * Romper y colocar solo con el puntero capturado: el primer clic sobre el
   * canvas pide Pointer Lock y no debe contar como interacción.
   */
  #handleBlockInteractions(deltaTime) {
    if (!this.input.isPointerLocked) {
      this.blockInteraction.updateBreaking(deltaTime, false);
      return;
    }
    this.blockInteraction.updateBreaking(deltaTime, this.input.isBreakDown());
    if (this.input.wasPlaceRequested()) this.blockInteraction.tryPlace();
  }

  /** La progresión recibe la columna del jugador; las reglas deciden si eso da puntos. */
  #updateProgression(deltaTime) {
    const feet = this.world.worldToBlock(this.player.position.x, this.player.position.y, this.player.position.z);
    this.progression.update(deltaTime, feet.x, feet.z);
  }

  /** Caer al vacío mata una sola vez; la reaparición la resuelve #respawn en el mismo frame. */
  #handleVoidFall() {
    if (this.player.position.y >= this.config.player.VOID_Y) return;
    if (!this.modeRules.takesDamage || !this.playerHealth.kill(DamageCauses.VOID)) this.#placePlayerOnSurface();
  }

  #respawn() {
    this.#placePlayerOnSurface();
    this.blockInteraction.updateBreaking(0, false);
    this.playerHealth.reset();
    this.events.emit(GameEventTypes.PLAYER_RESPAWNED, {
      position: this.player.position,
      health: this.playerHealth.current,
      maxHealth: this.playerHealth.max
    });
  }

  /**
   * Velocidad vertical (positiva hacia abajo) con la que el jugador tocó el suelo.
   * PlayerPhysics anula velocity.y al chocar, así que se reconstruye con la misma
   * integración que aplicó en este frame: gravedad y velocidad de caída límite.
   */
  #landingImpactSpeed(previousVelocityY, deltaTime) {
    const { GRAVITY, MAX_FALL_SPEED } = this.config.player;
    return -Math.max(previousVelocityY + GRAVITY * deltaTime, -MAX_FALL_SPEED);
  }

  /** Sincroniza los datos de interacción del juego con los efectos visuales. */
  #updateViewmodel(deltaTime) {
    if (!this.state.isRunning) this.blockInteraction.updateBreaking(deltaTime, false);
    this.levelUpEffect.update(this.state.isRunning ? deltaTime : 0);
    this.blueprintGhost.advance(this.state.isRunning ? deltaTime : 0);
    this.challengeCompleteEffect.update(this.state.isRunning ? deltaTime : 0);
    const horizontalSpeed = this.state.isRunning
      ? Math.hypot(this.player.velocity.x, this.player.velocity.z)
      : 0;
    const blockPosition = this.world.worldToBlock(this.player.position.x, this.player.position.y, this.player.position.z);
    const biome = this.state.isRunning
      ? this.worldGenerator.getBiomeAt(blockPosition.x, blockPosition.z)
      : null;
    const step = this.footsteps.update(this.state.isRunning ? deltaTime : 0, {
      horizontalSpeed,
      onGround: this.player.isOnGround,
      flying: this.player.isFlying
    });
    if (step) this.audio.play(step, { volume: this.footsteps.volume });
    this.#viewmodelState.isBreaking = this.state.isRunning && this.blockInteraction.breakingBlock !== null;
    this.#viewmodelState.horizontalSpeed = horizontalSpeed;
    this.#viewmodelState.isOnGround = this.state.isRunning && this.player.isOnGround;
    this.visualEffectsManager.update(deltaTime, {
      running: this.state.isRunning,
      paused: this.state.isPaused,
      targetedBlock: this.blockInteraction.targetedBlock,
      breakingBlock: this.blockInteraction.breakingBlock,
      breakProgress: this.blockInteraction.breakProgress,
      playerPosition: this.player.position,
      biome,
      selectedIndex: this.hotbar.selectedIndex,
      selectedBlockType: this.hotbar.selectedBlockType,
      isBreaking: this.#viewmodelState.isBreaking,
      horizontalSpeed,
      isOnGround: this.#viewmodelState.isOnGround,
      isSprinting: this.state.isRunning && this.player.isSprinting
    });
  }

  #syncCameraToPlayer() {
    const eye = this.player.eyePosition;
    this.camera.setPosition(eye.x, eye.y, eye.z);
  }

  /** Ubica al jugador sobre el terreno generado, en el centro del mundo. */
  #placePlayerOnSurface() {
    const blockSize = this.world.blockSize;
    const spot = this.spawnFinder.find(this.world, Math.floor(this.world.width / 2), Math.floor(this.world.depth / 2));

    this.player.teleportTo(
      spot.x * blockSize + blockSize / 2,
      spot.y * blockSize,
      spot.z * blockSize + blockSize / 2
    );
    this.#syncCameraToPlayer();
  }

  /**
   * Hotbar inicial con los bloques marcados como starter en el registro. Deja
   * ranuras libres para lo que el jugador recolecta (minerales, arenisca...).
   */
  /** En creativo la hotbar se llena con todos los bloques que se pueden colocar. */
  #fillStarterHotbar() {
    const types = this.modeRules?.infiniteBlocks
      ? this.blockRegistry.placeableTypes().filter((type) => type.isBreakable).slice(0, this.hotbar.size)
      : this.blockRegistry.starterTypes();
    for (const blockType of types) this.hotbar.add(blockType, this.config.inventory.STARTER_BLOCK_COUNT);
  }

  /** Pointer Lock necesita un gesto del usuario; se engancha al clic en el canvas. */
  #bindPointerLock(canvasElement) {
    canvasElement.addEventListener('click', () => {
      if (!this.input.isPointerLocked) this.input.mouse.requestPointerLock();
      this.audio.unlock().catch(() => {});
    });
  }

  #buildDebugStats() {
    const block = this.world.worldToBlock(this.player.position.x, this.player.position.y, this.player.position.z);
    const renderStats = this.renderer.stats;
    const target = this.blockInteraction.targetedBlock;
    // El bioma se calcula solo con el panel abierto: no hace falta en cada frame.
    const showingDebug = this.hud?.debugOverlay?.isVisible ?? false;
    return {
      fps: this.p.frameRate(),
      position: this.player.position,
      renderedBlocks: renderStats.renderedBlocks,
      visibleFaces: renderStats.visibleFaces,
      drawCalls: renderStats.drawCalls,
      culledChunks: renderStats.culledChunks,
      meshRebuilds: renderStats.meshRebuilds,
      renderDistance: renderStats.renderDistance,
      state: this.state.current,
      chunk: {
        x: MathUtils.floorDiv(block.x, this.world.chunkSizeX),
        z: MathUtils.floorDiv(block.z, this.world.chunkSizeZ)
      },
      onGround: this.player.isOnGround,
      isFlying: this.player.isFlying,
      cameraLookDirection: this.camera.forward,
      targetedBlock: target
        ? { ...target, blockType: this.world.getBlockType(target.x, target.y, target.z) }
        : null,
      selectedSlot: this.hotbar.selectedIndex,
      seed: this.#session.seed,
      mode: this.modeRules.label,
      biome: showingDebug ? this.worldGenerator.getBiomeAt(block.x, block.z)?.label ?? null : null,
      dimensions: { width: this.world.width, height: this.world.height, depth: this.world.depth }
    };
  }
}
