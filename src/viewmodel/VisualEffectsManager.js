import { GameConfig } from '../game/GameConfig.js';
import { GameEventTypes } from '../game/GameEvents.js';

/** Coordina eventos, actualización y orden de dibujo de todos los efectos. */
export class VisualEffectsManager {
  #drawEffects = [];
  #updateEffects = [];
  #unsubscribers = [];
  #lastState = null;

  constructor({
    events = null,
    renderer = null,
    world = null,
    blockSize = GameConfig.world.BLOCK_SIZE,
    handRenderer,
    blockHighlight,
    breakOverlay,
    blockParticles,
    ambientParticles,
    landingEffect,
    damageEffect,
    cameraEffects
  } = {}) {
    this.events = events;
    this.renderer = renderer;
    this.world = world;
    this.blockSize = blockSize;
    this.handRenderer = handRenderer;
    this.blockHighlight = blockHighlight;
    this.breakOverlay = breakOverlay;
    this.blockParticles = blockParticles;
    this.ambientParticles = ambientParticles;
    this.landingEffect = landingEffect;
    this.damageEffect = damageEffect;
    this.cameraEffects = cameraEffects;

    this.registerEffect('ambientParticles', ambientParticles);
    this.registerEffect('hand', handRenderer);
    this.registerEffect('damage', damageEffect);
    this.#subscribeToEvents();
  }

  registerEffect(name, effect, { draw = true, update = true } = {}) {
    if (!effect) return () => {};
    if (draw && typeof effect.draw === 'function') this.#drawEffects.push({ name, effect });
    if (update && typeof effect.update === 'function') this.#updateEffects.push({ name, effect });
    return () => this.unregisterEffect(name);
  }

  unregisterEffect(name) {
    this.#drawEffects = this.#drawEffects.filter(({ name: current }) => current !== name);
    this.#updateEffects = this.#updateEffects.filter(({ name: current }) => current !== name);
  }

  update(deltaTime, {
    running = true,
    paused = false,
    targetedBlock = null,
    breakingBlock = null,
    breakProgress = 0,
    playerPosition = null,
    biome = null,
    selectedIndex = null,
    selectedBlockType = null,
    isBreaking = false,
    horizontalSpeed = 0,
    isOnGround = false,
    isSprinting = false
  } = {}) {
    const frozen = paused || !running;
    const safeDelta = frozen ? 0 : Math.max(0, deltaTime);
    this.#lastState = { running, paused };

    this.blockHighlight?.update(frozen ? null : targetedBlock);
    this.blockHighlight?.advance(safeDelta);
    this.breakOverlay?.update(frozen ? null : breakingBlock, frozen ? 0 : breakProgress);
    this.blockParticles?.update(safeDelta);
    this.landingEffect?.update(safeDelta);
    this.damageEffect?.update(safeDelta);
    this.cameraEffects?.update(safeDelta);
    this.ambientParticles?.update(safeDelta, {
      playerPosition,
      biome,
      enabled: running,
      paused: frozen
    });

    this.handRenderer?.setSelectedSlot(selectedIndex, selectedBlockType);
    this.handRenderer?.setLandingTransform(
      this.landingEffect?.handOffset ?? 0,
      this.landingEffect?.handCompression ?? 0
    );
    this.handRenderer?.update(safeDelta, {
      isBreaking: running && isBreaking,
      horizontalSpeed: running ? horizontalSpeed : 0,
      isOnGround: running && isOnGround,
      isSprinting: running && isSprinting,
      paused: frozen
    });
  }

  draw(p, camera) {
    for (const { effect } of this.#drawEffects) effect.draw(p, camera);
  }

  reset() {
    this.blockHighlight?.update(null);
    this.breakOverlay?.update(null, 0);
    this.blockParticles?.reset?.();
    this.ambientParticles?.reset?.();
    this.landingEffect?.reset?.();
    this.damageEffect?.reset?.();
    this.cameraEffects?.reset?.();
    this.handRenderer?.resetTemporary?.();
  }

  dispose() {
    for (const unsubscribe of this.#unsubscribers) unsubscribe();
    this.#unsubscribers = [];
    this.#drawEffects = [];
    this.#updateEffects = [];
    this.#lastState = null;
  }

  #subscribeToEvents() {
    if (!this.events?.on) return;
    this.#listen(GameEventTypes.BLOCK_BROKEN, (payload) => {
      this.handRenderer?.notifyBlockBroken();
      this.blockParticles?.spawn(this.#centerOf(payload.position), payload.blockType?.color ?? [255, 255, 255]);
    });
    this.#listen(GameEventTypes.BLOCK_PLACED, (payload) => {
      this.handRenderer?.notifyBlockPlaced();
      this.blockParticles?.spawnPlacement(
        this.#centerOf(payload.position),
        payload.blockType?.color ?? [255, 255, 255],
        payload.face ?? null,
        payload.blockType?.transparent ? (this.blockParticles?.config.TRANSPARENT_ALPHA ?? 0.7) : 1
      );
    });
    this.#listen(GameEventTypes.PLAYER_LANDED, ({ impactSpeed = 0 }) => {
      if (!this.landingEffect?.trigger(impactSpeed)) return;
      this.cameraEffects?.trigger({
        amplitude: this.landingEffect.intensity * this.landingEffect.config.CAMERA_OFFSET,
        duration: this.landingEffect.config.DURATION,
        rotation: this.landingEffect.cameraOffset * 0.01
      });
    });
    this.#listen(GameEventTypes.PLAYER_DAMAGED, ({ amount = 0, maxHealth = 20 }) => {
      this.damageEffect?.trigger(amount, maxHealth);
      this.cameraEffects?.trigger({
        amplitude: Math.min(this.cameraEffects.config.MAX_AMPLITUDE, amount * 0.18),
        duration: this.cameraEffects.config.DEFAULT_DURATION,
        rotation: Math.min(this.cameraEffects.config.MAX_ROTATION, amount * 0.0015)
      });
    });
    this.#listen(GameEventTypes.PLAYER_DIED, () => {
      this.damageEffect?.onDeath();
      this.cameraEffects?.trigger({
        amplitude: this.cameraEffects.config.MAX_AMPLITUDE,
        duration: this.damageEffect?.config.DEATH_DURATION,
        rotation: this.cameraEffects.config.MAX_ROTATION
      });
      this.handRenderer?.resetTemporary?.();
    });
    this.#listen(GameEventTypes.PLAYER_RESPAWNED, () => this.reset());
  }

  #listen(event, listener) {
    const unsubscribe = this.events.on(event, listener);
    if (typeof unsubscribe === 'function') this.#unsubscribers.push(unsubscribe);
  }

  #centerOf(position = {}) {
    return {
      x: (position.x + 0.5) * this.blockSize,
      y: (position.y + 0.5) * this.blockSize,
      z: (position.z + 0.5) * this.blockSize
    };
  }
}
