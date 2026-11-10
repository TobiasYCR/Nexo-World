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
    /** Campo de visión en grados; arranca en el de la configuración y se cambia desde Configuración. */
    this.fov = config.FOV_DEGREES;
    /** Multiplicador de la sensibilidad base (1 = la de GameConfig.camera.MOUSE_SENSITIVITY). */
    this.sensitivityMultiplier = 1;
    this.position = new Vec3();
    this.yaw = 0;
    this.pitch = 0;

    this.forward = new Vec3();
    this.right = new Vec3();
    this.lookDirection = new Vec3();
    this.visualEffects = null;
    this.#visualLookDirection = new Vec3();
    this.#updateBasis();
  }

  #visualLookDirection;

  setVisualEffects(effects) {
    this.visualEffects = effects;
  }

  /** Rotación a partir del desplazamiento del mouse en píxeles. */
  rotate(deltaX, deltaY) {
    const sensitivity = this.config.MOUSE_SENSITIVITY * this.sensitivityMultiplier;
    this.yaw += deltaX * sensitivity;
    this.pitch = MathUtils.clamp(
      this.pitch - deltaY * sensitivity,
      -this.config.MAX_PITCH,
      this.config.MAX_PITCH
    );
    this.#updateBasis();
  }

  setPosition(x, y, z) {
    this.position.set(x, y, z);
  }

  /**
   * Ajusta el campo de visión (FOV) en grados. Se guarda en la cámara: la
   * configuración del juego está congelada y asignarle valores tiraba error.
   */
  setFov(degrees) {
    if (Number.isFinite(degrees) && degrees > 0 && degrees < 180) this.fov = degrees;
  }

  /**
   * Ajusta la sensibilidad como multiplicador de la base: 1 es la normal, 2 el
   * doble. Antes el valor de la pantalla (1.0) reemplazaba a la base (0.0022)
   * y el mouse giraba unas 450 veces más rápido.
   */
  setSensitivity(multiplier) {
    if (Number.isFinite(multiplier) && multiplier > 0) this.sensitivityMultiplier = multiplier;
  }

  #updateBasis() {
    VectorUtils.forwardFromYaw(this.yaw, this.forward);
    VectorUtils.rightFromYaw(this.yaw, this.right);
    VectorUtils.directionFromAngles(this.yaw, this.pitch, this.lookDirection);
  }

  /**
   * Aplica proyección y vista al sketch. Único punto de contacto con p5.
   *
   * p5 usa Y hacia abajo y su perspective() invierte el eje Y de la proyección.
   * El mundo del juego es Y hacia arriba, así que con perspective() la escena se
   * ve espejada verticalmente (suelo arriba, cielo abajo). No se corrige con el
   * vector up de camera(): eso rota 180° y espeja X. Se usa frustum() con
   * bottom/top intercambiados, que arma la misma pirámide sin la inversión.
   */
  applyTo(p) {
    const near = this.config.NEAR_PLANE;
    const top = near * Math.tan(MathUtils.degToRad(this.fov) / 2);
    const right = top * (p.width / p.height);
    p.frustum(-right, right, top, -top, near, this.config.FAR_PLANE);

    const effect = this.visualEffects?.transform;
    const offsetX = effect?.offsetX ?? 0;
    const offsetY = effect?.offsetY ?? 0;
    const offsetZ = effect?.offsetZ ?? 0;
    const x = this.position.x + this.right.x * offsetX + this.forward.x * offsetZ;
    const y = this.position.y + offsetY;
    const z = this.position.z + this.right.z * offsetX + this.forward.z * offsetZ;
    const yaw = this.yaw + (effect?.yaw ?? 0);
    const pitch = this.pitch + (effect?.pitch ?? 0);
    const target = effect ? VectorUtils.directionFromAngles(yaw, pitch, this.#visualLookDirection) : this.lookDirection;
    p.camera(x, y, z, x + target.x, y + target.y, z + target.z, 0, 1, 0);
  }
}
