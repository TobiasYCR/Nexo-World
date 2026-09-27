import { GameConfig } from '../game/GameConfig.js';

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
  update(deltaTime, horizontalSpeed, isOnGround) {
    if (!isOnGround || horizontalSpeed <= 0) {
      this.#offsetX = 0;
      this.#offsetY = 0;
      return;
    }

    const intensity = Math.min(horizontalSpeed / this.config.REFERENCE_SPEED, 1);
    this.#time += deltaTime * this.config.FREQUENCY;
    this.#offsetY = Math.sin(this.#time) * this.config.AMPLITUDE * intensity;
    this.#offsetX = Math.cos(this.#time * 0.5) * this.config.AMPLITUDE * 0.5 * intensity;
  }
}
