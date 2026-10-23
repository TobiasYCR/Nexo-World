import { GameConfig } from '../game/GameConfig.js';
import { MathUtils } from '../utils/MathUtils.js';

/**
 * Destello breve alrededor de la mano en primera persona. Usa un pool fijo de
 * posiciones calculadas, se dibuja fuera del centro de la pantalla y no toca
 * la mira ni crea objetos durante cada frame.
 */
export class LevelUpEffect {
  #remaining = 0;
  #level = 0;
  #particles;

  constructor(config = GameConfig.levels, cameraConfig = GameConfig.camera, camera = null) {
    this.config = config;
    this.cameraConfig = cameraConfig;
    this.camera = camera;
    const count = Math.max(0, Math.floor(config.EFFECT_PARTICLE_COUNT ?? 0));
    this.#particles = Array.from({ length: count }, (_, index) => ({
      angle: (index / Math.max(1, count)) * Math.PI * 2,
      height: index % 2 === 0 ? config.EFFECT_PARTICLE_HEIGHT : -config.EFFECT_PARTICLE_HEIGHT
    }));
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

  trigger(level = 0) {
    if (!this.config.SHOW_LEVEL_UP_EFFECT) {
      this.reset();
      return false;
    }
    this.#level = level;
    this.#remaining = Math.max(0, this.config.EFFECT_DURATION ?? 0);
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

  draw(p, _camera) {
    if (!this.active || !p?.push) return;

    const duration = Math.max(Number.EPSILON, this.config.EFFECT_DURATION ?? 0);
    const elapsed = duration - this.#remaining;
    const progress = MathUtils.clamp01(elapsed / duration);
    const fade = 1 - progress;
    const offset = this.config.EFFECT_HAND_OFFSET;
    const radius = this.config.EFFECT_RADIUS * progress;
    const size = this.config.EFFECT_SIZE * fade;
    const color = this.config.EFFECT_COLOR;
    const alpha = this.config.EFFECT_ALPHA * fade;

    p.push();
    p.clearDepth?.();
    this.#applyFixedCamera(p);
    p.noStroke?.();
    for (const particle of this.#particles) {
      const angle = particle.angle + elapsed * (this.config.EFFECT_SPIN_SPEED ?? 0);
      p.push();
      p.translate(
        offset.x + Math.cos(angle) * radius,
        offset.y + particle.height * radius,
        offset.z
      );
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
