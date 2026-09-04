import { GameConfig } from '../game/GameConfig.js';
import { MathUtils } from '../utils/MathUtils.js';
import { Vec3, VectorUtils } from '../utils/VectorUtils.js';

/**
 * Cámara en primera persona: mantiene posición y orientación, y las aplica al
 * sketch de p5. No lee input directamente; recibe deltas ya normalizados.
 */
export class FirstPersonCamera {
  constructor(config = GameConfig.camera) {
    this.config = config;
    this.position = new Vec3();
    this.yaw = 0;
    this.pitch = 0;

    this.forward = new Vec3();
    this.right = new Vec3();
    this.lookDirection = new Vec3();
    this.#updateBasis();
  }

  /** Rotación a partir del desplazamiento del mouse en píxeles. */
  rotate(deltaX, deltaY) {
    this.yaw += deltaX * this.config.MOUSE_SENSITIVITY;
    this.pitch = MathUtils.clamp(
      this.pitch - deltaY * this.config.MOUSE_SENSITIVITY,
      -this.config.MAX_PITCH,
      this.config.MAX_PITCH
    );
    this.#updateBasis();
  }

  setPosition(x, y, z) {
    this.position.set(x, y, z);
  }

  #updateBasis() {
    VectorUtils.forwardFromYaw(this.yaw, this.forward);
    VectorUtils.rightFromYaw(this.yaw, this.right);
    VectorUtils.directionFromAngles(this.yaw, this.pitch, this.lookDirection);
  }

  /** Aplica proyección y vista al sketch. Único punto de contacto con p5. */
  applyTo(p) {
    p.perspective(
      MathUtils.degToRad(this.config.FOV_DEGREES),
      p.width / p.height,
      this.config.NEAR_PLANE,
      this.config.FAR_PLANE
    );

    const { x, y, z } = this.position;
    const target = this.lookDirection;
    p.camera(x, y, z, x + target.x, y + target.y, z + target.z, 0, 1, 0);
  }
}
