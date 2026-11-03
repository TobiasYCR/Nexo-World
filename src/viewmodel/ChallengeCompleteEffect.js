import { GameConfig } from '../game/GameConfig.js';
import { MathUtils } from '../utils/MathUtils.js';

/** Destello breve de celebración en primera persona al completar un plano. */
export class ChallengeCompleteEffect {
  #particles;
  #remaining = 0;

  constructor(config = GameConfig.education, cameraConfig = GameConfig.camera, camera = null) {
    this.config = config;
    this.cameraConfig = cameraConfig;
    this.camera = camera;
    this.#particles = Array.from(
      { length: config.COMPLETE_EFFECT_PARTICLE_COUNT },
      (_, index) => ({
        angle: (index / Math.max(1, config.COMPLETE_EFFECT_PARTICLE_COUNT)) * Math.PI * 2,
        height: index % 2 === 0 ? config.COMPLETE_EFFECT_HEIGHT : -config.COMPLETE_EFFECT_HEIGHT
      })
    );
  }

  trigger() {
    if (!this.config.SHOW_COMPLETE_EFFECT) {
      this.reset();
      return false;
    }
    this.#remaining = Math.max(0, this.config.COMPLETE_EFFECT_DURATION);
    return this.active;
  }

  update(deltaTime) {
    if (this.active) this.#remaining = Math.max(0, this.#remaining - Math.max(0, deltaTime));
  }

  reset() {
    this.#remaining = 0;
  }

  get active() {
    return this.#remaining > 0;
  }

  get isActive() {
    return this.active;
  }

  get remaining() {
    return this.#remaining;
  }

  draw(p, _camera) {
    if (!this.active || !p?.push) return;

    const duration = Math.max(Number.EPSILON, this.config.COMPLETE_EFFECT_DURATION);
    const elapsed = duration - this.#remaining;
    const progress = MathUtils.clamp01(elapsed / duration);
    const fade = 1 - progress;
    const radius = this.config.COMPLETE_EFFECT_RADIUS * (0.25 + progress);
    const size = this.config.COMPLETE_EFFECT_SIZE * fade;
    const alpha = this.config.COMPLETE_EFFECT_ALPHA * fade;
    const hand = this.config.COMPLETE_EFFECT_HAND_OFFSET;

    p.push();
    p.clearDepth?.();
    this.#applyFixedCamera(p);
    p.noStroke?.();
    for (const particle of this.#particles) {
      const angle = particle.angle + elapsed * this.config.COMPLETE_EFFECT_SPIN_SPEED;
      p.push();
      p.translate?.(
        hand.x + Math.cos(angle) * radius,
        hand.y + particle.height * radius,
        hand.z
      );
      const color = this.config.COMPLETE_EFFECT_COLOR;
      p.fill?.(color[0], color[1], color[2], alpha);
      p.ambientMaterial?.(color[0], color[1], color[2]);
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
