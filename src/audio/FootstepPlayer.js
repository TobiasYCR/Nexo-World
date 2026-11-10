import { SoundIds } from '../utils/Constants.js';

/**
 * Decide cuándo suena un paso: cada STEP_DISTANCE_BLOCKS recorridos sobre el
 * suelo. Alterna entre dos sonidos para que no se escuche repetitivo. No
 * suena en el aire, volando ni quieto.
 */
export class FootstepPlayer {
  #distance = 0;
  #next = 0;

  /**
   * @param {{STEP_DISTANCE_BLOCKS:number, STEP_VOLUME:number}} audioConfig
   * @param {number} blockSize
   */
  constructor(audioConfig, blockSize) {
    this.stepDistance = audioConfig.STEP_DISTANCE_BLOCKS * blockSize;
    this.volume = audioConfig.STEP_VOLUME;
  }

  /**
   * @param {number} deltaTime segundos
   * @param {{horizontalSpeed:number, onGround:boolean, flying:boolean}} state
   * @returns {string|null} el sonido a reproducir en este frame, o null
   */
  update(deltaTime, { horizontalSpeed, onGround, flying }) {
    if (!onGround || flying || !(horizontalSpeed > 0)) {
      // Al frenar o saltar, el próximo paso arranca a mitad de camino: suena pronto al volver a caminar.
      this.#distance = Math.min(this.#distance, this.stepDistance / 2);
      return null;
    }
    this.#distance += horizontalSpeed * Math.max(0, deltaTime);
    if (this.#distance < this.stepDistance) return null;
    this.#distance -= this.stepDistance;
    this.#next = 1 - this.#next;
    return this.#next === 1 ? SoundIds.STEP_1 : SoundIds.STEP_2;
  }

  reset() {
    this.#distance = 0;
  }
}
