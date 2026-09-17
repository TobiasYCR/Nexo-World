import { GameConfig } from './GameConfig.js';
import { GameState, GameStates } from './GameState.js';
import { createDefaultBlockRegistry } from '../blocks/BlockRegistry.js';
import { World } from '../world/World.js';
import { WorldGenerator } from '../world/WorldGenerator.js';
import { Player } from '../player/Player.js';
import { PlayerController } from '../player/PlayerController.js';
import { PlayerPhysics } from '../player/PlayerPhysics.js';
import { BlockInteraction } from '../player/BlockInteraction.js';
import { FirstPersonCamera } from '../camera/FirstPersonCamera.js';
import { CollisionSystem } from '../physics/CollisionSystem.js';
import { Raycast } from '../physics/Raycast.js';
import { InputManager } from '../input/InputManager.js';
import { TextureManager } from '../rendering/TextureManager.js';
import { BlockRenderer } from '../rendering/BlockRenderer.js';
import { Renderer } from '../rendering/Renderer.js';
import { Hotbar } from '../inventory/Hotbar.js';
import { AudioManager } from '../audio/AudioManager.js';
import { HUD } from '../ui/HUD.js';
import { SaveManager } from '../persistence/SaveManager.js';
import { InputActions } from '../utils/Constants.js';
import { MathUtils } from '../utils/MathUtils.js';

/**
 * Coordinador de sistemas. Game construye las dependencias, define el orden de
 * actualización y reparte responsabilidades; no implementa reglas de mundo,
 * física ni dibujado. Cada sistema es reemplazable de forma aislada.
 */
export class Game {
  constructor(p, config = GameConfig) {
    this.p = p;
    this.config = config;
    this.state = new GameState(GameStates.LOADING);

    this.blockRegistry = createDefaultBlockRegistry();
    this.world = new World(this.blockRegistry, config);
    this.worldGenerator = new WorldGenerator(config.world);

    this.collisionSystem = new CollisionSystem(this.world);
    this.raycast = new Raycast(this.world);

    this.camera = new FirstPersonCamera(config.camera);
    this.player = new Player(config.player);
    this.input = new InputManager(config.input);
    this.playerController = new PlayerController(this.player, this.camera, this.input);
    this.playerPhysics = new PlayerPhysics(this.player, this.collisionSystem, config.player);

    this.textureManager = new TextureManager(p, config.assets);
    this.blockRenderer = new BlockRenderer(p, this.blockRegistry, this.textureManager, config);
    this.renderer = new Renderer(p, this.blockRenderer, config.rendering);

    this.hotbar = new Hotbar(config.inventory.HOTBAR_SIZE);
    this.blockInteraction = new BlockInteraction(this.world, this.player, this.hotbar, this.raycast, config);
    this.audio = new AudioManager(config.assets);
    this.hud = new HUD();
    this.saveManager = new SaveManager();
  }

  /** Prepara mundo, jugador e interfaz. La carga de texturas no bloquea el arranque. */
  async start(canvasElement) {
    this.worldGenerator.generate(this.world);
    this.#placePlayerOnSurface();
    this.#fillStarterHotbar();

    this.hud.mount();
    this.input.attach(canvasElement);
    this.#bindPointerLock(canvasElement);

    this.state.set(GameStates.RUNNING);

    // Deliberadamente sin await: el mundo se dibuja con colores hasta que lleguen.
    this.textureManager.loadAll(this.blockRegistry.textureNames());
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
      this.#handleBlockInteractions();
      this.playerPhysics.update(deltaTime);
      this.#syncCameraToPlayer();
      this.#handleHotbarSelection();
    }

    this.hud.update(deltaTime, this.#buildDebugStats());
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
  }

  /** Bloque bajo la mira, expuesto para que el renderer dibuje el resaltado. */
  get targetedBlock() {
    return this.blockInteraction.targetedBlock;
  }

  #handleHotbarSelection() {
    const requestedSlot = this.input.requestedHotbarSlot();
    if (requestedSlot >= 0) this.hotbar.select(requestedSlot);
  }

  /**
   * Romper y colocar solo con el puntero capturado: el primer clic sobre el
   * canvas pide Pointer Lock y no debe contar como interacción.
   */
  #handleBlockInteractions() {
    if (!this.input.isPointerLocked) return;
    if (this.input.wasBreakRequested()) this.blockInteraction.tryBreak();
    if (this.input.wasPlaceRequested()) this.blockInteraction.tryPlace();
  }

  #syncCameraToPlayer() {
    const eye = this.player.eyePosition;
    this.camera.setPosition(eye.x, eye.y, eye.z);
  }

  /** Ubica al jugador sobre el terreno generado, en el centro del mundo. */
  #placePlayerOnSurface() {
    const blockSize = this.world.blockSize;
    const centerX = Math.floor(this.world.width / 2);
    const centerZ = Math.floor(this.world.depth / 2);
    const surfaceY = this.world.getSurfaceHeight(centerX, centerZ);

    this.player.teleportTo(
      centerX * blockSize + blockSize / 2,
      surfaceY * blockSize,
      centerZ * blockSize + blockSize / 2
    );
    this.#syncCameraToPlayer();
  }

  /** Hotbar inicial con los tipos disponibles, útil para probar la interfaz. */
  #fillStarterHotbar() {
    for (const blockType of this.blockRegistry.placeableTypes()) {
      this.hotbar.add(blockType, 1);
    }
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
    return {
      fps: this.p.frameRate(),
      position: this.player.position,
      renderedBlocks: this.renderer.stats.renderedBlocks,
      state: this.state.current,
      chunk: {
        x: MathUtils.floorDiv(block.x, this.world.chunkSizeX),
        z: MathUtils.floorDiv(block.z, this.world.chunkSizeZ)
      },
      onGround: this.player.isOnGround,
      targetedBlock: this.blockInteraction.targetedBlock
    };
  }
}
