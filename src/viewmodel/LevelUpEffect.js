import { GameConfig } from '../game/GameConfig.js';
import { MathUtils } from '../utils/MathUtils.js';

/**
 * Destello de partículas alrededor de la mano en primera persona. Usa un pool
 * fijo y una cámara propia, por lo que no cubre la mira ni agrega trabajo al
 * mundo. Solo reacciona a una subida de nivel; no conoce las reglas de nivel.
 */
export class LevelUpEffect {
  #particles;
  #remaining = 0;
  #level = 0;

  constructor(config = GameConfig.levels, cameraConfig = GameConfig.camera, camera = null) {
    this.config = config;
    this.cameraConfig = cameraConfig;
    this.camera = camera;
    this.#particles = Array.from(
      { length: config.EFFECT_PARTICLE_COUNT },
      (_, index) => ({
        angle: (index / Math.max(1, config.EFFECT_PARTICLE_COUNT)) * Math.PI * 2,
        height: index % 2 === 0 ? config.EFFECT_PARTICLE_HEIGHT : -config.EFFECT_PARTICLE_HEIGHT
      })
    );
  }

  trigger(level = 0) {
    if (!this.config.SHOW_LEVEL_UP_EFFECT) {
      this.reset();
      return false;
    }
    this.#level = level;
    this.#remaining = Math.max(0, this.config.EFFECT_DURATION);
    return this.active;
  }

  update(deltaTime) {
    if (!this.active) return;
    this.#remaining = Math.max(0, this.#remaining - Math.max(0, deltaTime));
  }

  reset() {
    this.#remaining = 0;
    this.#level = 0;
  }

  get active() {
    return this.#remaining > 0;
  }

  get remaining() {
    return this.#remaining;
  }

  get level() {
    return this.#level;
  }

  get isActive() {
    return this.active;
  }

  get remainingTime() {
    return this.remaining;
  }

  draw(p, _camera) {
    if (!this.active || !p?.push) return;

    const duration = Math.max(Number.EPSILON, this.config.EFFECT_DURATION);
    const elapsed = duration - this.#remaining;
    const progress = MathUtils.clamp01(elapsed / duration);
    const fade = 1 - progress;
    const radius = this.config.EFFECT_RADIUS * progress;
    const size = this.config.EFFECT_SIZE * fade;
    const alpha = this.config.EFFECT_ALPHA * fade;
    const hand = this.config.EFFECT_HAND_OFFSET;

    p.push();
    p.clearDepth?.();
    this.#applyFixedCamera(p);
    p.noStroke();

    for (const particle of this.#particles) {
      const angle = particle.angle + elapsed * this.config.EFFECT_SPIN_SPEED;
      p.push();
      p.translate(
        hand.x + Math.cos(angle) * radius,
        hand.y + particle.height * radius,
        hand.z
      );
      p.fill?.(this.config.EFFECT_COLOR[0], this.config.EFFECT_COLOR[1], this.config.EFFECT_COLOR[2], alpha);
      p.ambientMaterial?.(this.config.EFFECT_COLOR[0], this.config.EFFECT_COLOR[1], this.config.EFFECT_COLOR[2]);
      if (typeof p.sphere === 'function') p.sphere(size);
      else p.box?.(size);
      p.pop();
    }
    p.pop();
  }

  #applyFixedCamera(p) {
    if (!p.frustum || !p.camera) return;
    const fovDegrees = this.camera?.fov ?? this.cameraConfig.FOV_DEGREES;
    const near = this.cameraConfig.NEAR_PLANE;
    const top = near * Math.tan(MathUtils.degToRad(fovDegrees) / 2);
    const right = top * (p.width / p.height);
    p.frustum(-right, right, top, -top, near, this.cameraConfig.FAR_PLANE);
    p.camera(0, 0, 0, 0, 0, -1, 0, 1, 0);
  }
}
