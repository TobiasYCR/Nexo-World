import { GameConfig } from '../game/GameConfig.js';
import { MathUtils } from '../utils/MathUtils.js';

/** Overlay de daño y transición breve de muerte. */
export class DamageEffect {
  #remaining = 0;
  #duration = 0;
  #opacity = 0;
  #death = false;

  constructor(config = GameConfig.viewmodel.damage) {
    this.config = config;
  }

  get opacity() { return this.#opacity; }
  get isActive() { return this.#remaining > 0 && this.#opacity > 0; }

  trigger(amount, maxHealth = 20) {
    if (!this.config.ENABLED || !(amount > 0)) return;
    const ratio = MathUtils.clamp01(amount / Math.max(1, maxHealth));
    const nextOpacity = Math.min(this.config.MAX_OPACITY, 0.12 + ratio * 0.75);
    this.#opacity = Math.max(this.#opacity, nextOpacity);
    this.#duration = this.config.FLASH_DURATION;
    this.#remaining = Math.max(this.#remaining, this.#duration);
    this.#death = false;
  }

  onDeath() {
    if (!this.config.ENABLED) return;
    this.#death = true;
    this.#duration = this.config.DEATH_DURATION;
    this.#remaining = this.#duration;
    this.#opacity = Math.max(this.#opacity, this.config.DEATH_MAX_OPACITY);
  }

  onRespawn() {
    this.reset();
  }

  update(deltaTime) {
    if (this.#remaining <= 0) {
      this.#opacity = 0;
      return;
    }
    this.#remaining = Math.max(0, this.#remaining - Math.max(0, deltaTime));
    const progress = this.#remaining / Math.max(Number.EPSILON, this.#duration);
    this.#opacity = this.#death
      ? this.config.DEATH_MAX_OPACITY * progress
      : this.#opacity * progress;
    if (this.#remaining === 0) this.#opacity = 0;
  }

  draw(p, _camera) {
    if (!this.isActive || typeof p.rect !== 'function') return;
    const width = p.width ?? 0;
    const height = p.height ?? 0;
    p.push();
    p.clearDepth?.();
    p.resetMatrix?.();
    // El overlay debe ocupar la pantalla, no quedar sujeto a la cámara 3D del
    // mundo. La proyección ortográfica temporal se revierte con pop().
    p.ortho?.(-width / 2, width / 2, height / 2, -height / 2, -1, 1);
    p.camera?.(0, 0, 0, 0, 0, -1, 0, 1, 0);
    p.noStroke?.();
    p.fill?.(this.config.COLOR[0], this.config.COLOR[1], this.config.COLOR[2], this.#opacity * 255);
    p.rectMode?.(p.CORNER);
    p.rect?.(-width / 2, -height / 2, width, height);
    p.pop();
  }

  reset() {
    this.#remaining = 0;
    this.#duration = 0;
    this.#opacity = 0;
    this.#death = false;
  }
}
