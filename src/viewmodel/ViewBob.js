import { GameConfig } from '../game/GameConfig.js';
import { MathUtils } from '../utils/MathUtils.js';

/**
 * Balanceo de la mano (no de la cámara) mientras el jugador camina.
 * Solo lee números que le pasan por update(): no conoce a Player ni a Game.
 *
 * Proporcional a la velocidad horizontal y solo activo en el suelo; en el
 * aire o quieto el offset es exactamente cero, sin transición, para que no
 * quede un balanceo residual mientras el jugador está saltando o parado.
 */
export class ViewBob {
  #time = 0;
  #offsetX = 0;
  #offsetY = 0;
  #intensity = 0;

  constructor(config = GameConfig.viewmodel.viewBob) {
    this.config = config;
  }

  get offsetX() {
    return this.#offsetX;
  }

  get offsetY() {
    return this.#offsetY;
  }

  /**
   * @param {number} deltaTime segundos desde el frame anterior
   * @param {number} horizontalSpeed magnitud de la velocidad horizontal del jugador, en unidades/seg
   * @param {boolean} isOnGround
   */
  update(deltaTime, horizontalSpeed, isOnGround, isSprinting = false) {
    if (!isOnGround) {
      this.#intensity = 0;
      this.#offsetX = 0;
      this.#offsetY = 0;
      return;
    }

    const referenceSpeed = this.config.REFERENCE_SPEED ?? 120;
    const targetIntensity = MathUtils.clamp01(horizontalSpeed / referenceSpeed);
    const smoothing = this.config.STOP_SMOOTHING ?? 14;
    const response = Math.min(1, Math.max(0, deltaTime) * smoothing);
    this.#intensity = MathUtils.lerp(this.#intensity, targetIntensity, response);

    if (this.#intensity < 0.0001) {
      this.#intensity = 0;
      this.#offsetX = 0;
      this.#offsetY = 0;
      return;
    }

    const runMultiplier = isSprinting ? (this.config.RUN_BOB_MULTIPLIER ?? 1) : 1;
    const amplitude = this.config.WALK_BOB_AMPLITUDE ?? this.config.AMPLITUDE;
    const frequency = this.config.WALK_BOB_FREQUENCY ?? this.config.FREQUENCY;
    this.#time += deltaTime * frequency * (0.65 + this.#intensity * 0.35) * runMultiplier;
    this.#offsetY = Math.sin(this.#time) * amplitude * this.#intensity * runMultiplier;
    this.#offsetX = Math.cos(this.#time * 0.5) * amplitude * 0.5 * this.#intensity * runMultiplier;
  }
}
