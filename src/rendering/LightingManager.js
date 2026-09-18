import { GameConfig } from '../game/GameConfig.js';
import { Vec3 } from '../utils/VectorUtils.js';

/**
 * Iluminación de la escena: una luz ambiente y una direccional, sin shaders
 * propios. Aislada del renderer para poder evolucionar a ciclo día/noche sin
 * tocar el resto del pipeline.
 */
export class LightingManager {
  /** Dirección usada si la configurada es el vector nulo: luz cenital. */
  static #FALLBACK_DIRECTION = Object.freeze({ x: 0, y: 1, z: 0 });

  #lightTravel;

  constructor(p, config = GameConfig.rendering) {
    this.p = p;
    this.ambientColor = config.AMBIENT_LIGHT;
    this.directionalColor = config.DIRECTIONAL_LIGHT;
    this.setDirection(config.LIGHT_DIRECTION);
  }

  /**
   * @param {{x:number,y:number,z:number}} direction hacia dónde está la luz (no hace falta normalizarla)
   */
  setDirection(direction) {
    const source = new Vec3(direction.x, direction.y, direction.z);
    if (source.lengthSq() === 0) source.copyFrom(LightingManager.#FALLBACK_DIRECTION);
    source.normalize();

    this.direction = Object.freeze({ x: source.x, y: source.y, z: source.z });
    // Se normaliza e invierte una sola vez: p5 espera hacia dónde VIAJA la luz.
    this.#lightTravel = Object.freeze([-source.x, -source.y, -source.z]);
  }

  apply() {
    this.p.ambientLight(...this.ambientColor);
    this.p.directionalLight(...this.directionalColor, ...this.#lightTravel);
  }
}
