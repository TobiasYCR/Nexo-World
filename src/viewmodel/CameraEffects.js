import { GameConfig } from '../game/GameConfig.js';
import { MathUtils } from '../utils/MathUtils.js';

/**
 * Capa visual de cámara. FirstPersonCamera la consulta únicamente al dibujar;
 * su posición y dirección lógicas permanecen intactas para el raycast.
 */
export class CameraEffects {
  #remaining = 0;
  #duration = 0;
  #amplitude = 0;
  #rotation = 0;
  #phase = 0;
  #offsetX = 0;
  #offsetY = 0;
  #offsetZ = 0;
  #yaw = 0;
  #pitch = 0;

  constructor(config = GameConfig.viewmodel.cameraEffects) {
    this.config = config;
  }

  get enabled() { return this.config.ENABLED !== false; }

  trigger({ amplitude = 0, duration = this.config.DEFAULT_DURATION, rotation = 0 } = {}) {
    if (!this.enabled) return;
    this.#amplitude = MathUtils.clamp(amplitude, 0, this.config.MAX_AMPLITUDE);
    this.#rotation = MathUtils.clamp(rotation, 0, this.config.MAX_ROTATION);
    this.#duration = Math.max(0, duration);
    this.#remaining = Math.max(this.#remaining, this.#duration);
    this.#phase += 1.7;
  }

  update(deltaTime) {
    if (!this.enabled || this.#remaining <= 0) {
      this.#clearOffsets();
      return;
    }
    this.#remaining = Math.max(0, this.#remaining - Math.max(0, deltaTime));
    const normalized = this.#remaining / Math.max(Number.EPSILON, this.#duration);
    const envelope = normalized * normalized;
    const phase = this.#phase + (this.#duration - this.#remaining) * 42;
    this.#offsetX = Math.sin(phase * 1.13) * this.#amplitude * envelope;
    this.#offsetY = Math.cos(phase * 1.41) * this.#amplitude * 0.45 * envelope;
    this.#offsetZ = Math.sin(phase * 0.87) * this.#amplitude * 0.25 * envelope;
    this.#yaw = Math.sin(phase * 1.2) * this.#rotation * envelope;
    this.#pitch = Math.cos(phase * 0.91) * this.#rotation * envelope;
    if (this.#remaining === 0) this.#clearOffsets();
  }

  get transform() { return this; }
  get offsetX() { return this.#offsetX; }
  get offsetY() { return this.#offsetY; }
  get offsetZ() { return this.#offsetZ; }
  get yaw() { return this.#yaw; }
  get pitch() { return this.#pitch; }

  reset() {
    this.#remaining = 0;
    this.#clearOffsets();
  }

  #clearOffsets() {
    this.#offsetX = 0;
    this.#offsetY = 0;
    this.#offsetZ = 0;
    this.#yaw = 0;
    this.#pitch = 0;
  }
}
