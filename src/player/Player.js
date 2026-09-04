import { Vec3 } from '../utils/VectorUtils.js';
import { AABB } from '../physics/AABB.js';
import { GameConfig } from '../game/GameConfig.js';

/**
 * Estado del jugador: posición, velocidad y volumen de colisión.
 * No decide su propio movimiento (eso es PlayerController) ni lo integra
 * (eso es PlayerPhysics): es el dato compartido entre ambos.
 *
 * La posición es la de los PIES, centrada en el eje horizontal.
 */
export class Player {
  constructor(config = GameConfig.player) {
    this.config = config;
    this.position = new Vec3(config.SPAWN.x, config.SPAWN.y, config.SPAWN.z);
    this.velocity = new Vec3();
    /** Intención de movimiento normalizada, en espacio de mundo. */
    this.moveIntent = new Vec3();
    this.wantsToJump = false;
    this.isSprinting = false;
    this.isOnGround = false;
  }

  get eyePosition() {
    return new Vec3(
      this.position.x,
      this.position.y + this.config.EYE_HEIGHT,
      this.position.z
    );
  }

  get boundingBox() {
    return AABB.fromCenterBase(
      this.position.x,
      this.position.y,
      this.position.z,
      this.config.WIDTH,
      this.config.HEIGHT
    );
  }

  get currentSpeed() {
    return this.config.PLAYER_SPEED * (this.isSprinting ? this.config.SPRINT_MULTIPLIER : 1);
  }

  teleportTo(x, y, z) {
    this.position.set(x, y, z);
    this.velocity.set(0, 0, 0);
  }

  /** Reinicia las intenciones de este frame; las vuelve a fijar el controlador. */
  clearIntent() {
    this.moveIntent.set(0, 0, 0);
    this.wantsToJump = false;
  }
}
