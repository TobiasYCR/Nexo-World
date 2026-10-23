import { GameConfig } from '../game/GameConfig.js';
import { MathUtils } from '../utils/MathUtils.js';

/** Feedback visual temporal al tocar el suelo; nunca modifica la física. */
export class LandingEffect {
  #remaining = 0;
  #intensity = 0;

  constructor(config = GameConfig.viewmodel.landing) {
    this.config = config;
  }

  get isActive() { return this.#remaining > 0 && this.#intensity > 0; }
  get intensity() { return this.#intensity; }

  trigger(impactSpeed) {
    if (!this.config.ENABLED || !(impactSpeed >= this.config.MIN_IMPACT_SPEED)) {
      return false;
    }
    const range = Math.max(1, this.config.MAX_IMPACT_SPEED - this.config.MIN_IMPACT_SPEED);
    this.#intensity = MathUtils.clamp01((impactSpeed - this.config.MIN_IMPACT_SPEED) / range);
    this.#remaining = this.config.DURATION;
    return true;
  }

  update(deltaTime) {
    if (!this.isActive) return;
    this.#remaining = Math.max(0, this.#remaining - Math.max(0, deltaTime));
    if (this.#remaining === 0) this.#intensity = 0;
  }

  get handOffset() {
    return this.#wave() * this.#intensity * this.config.HAND_OFFSET;
  }

  get handCompression() {
    return this.#wave() * this.#intensity;
  }

  get cameraOffset() {
    return this.#wave() * this.#intensity * this.config.CAMERA_OFFSET;
  }

  reset() {
    this.#remaining = 0;
    this.#intensity = 0;
  }

  #wave() {
    if (!this.isActive) return 0;
    const progress = 1 - this.#remaining / Math.max(Number.EPSILON, this.config.DURATION);
    return Math.sin(MathUtils.clamp01(progress) * Math.PI);
  }
}
