import { GameConfig } from '../game/GameConfig.js';

/**
 * Iluminación de la escena. Aislada del renderer para poder evolucionar a luz
 * por bloque o ciclo día/noche sin tocar el resto del pipeline.
 */
export class LightingManager {
  constructor(p, config = GameConfig.rendering) {
    this.p = p;
    this.ambientColor = config.AMBIENT_LIGHT;
    this.directionalColor = config.DIRECTIONAL_LIGHT;
    this.direction = config.LIGHT_DIRECTION;
  }

  apply() {
    const p = this.p;
    p.ambientLight(...this.ambientColor);
    // p5 espera la dirección hacia la que viaja la luz, por eso se invierte.
    p.directionalLight(
      ...this.directionalColor,
      -this.direction.x,
      -this.direction.y,
      -this.direction.z
    );
  }
}
