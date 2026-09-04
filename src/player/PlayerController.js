import { InputActions } from '../utils/Constants.js';
import { Vec3 } from '../utils/VectorUtils.js';

/**
 * Traduce acciones de entrada en intención de movimiento y en rotación de cámara.
 * Es el único puente entre input y jugador: ni Player ni InputManager se conocen.
 */
export class PlayerController {
  #forwardScaled = new Vec3();
  #rightScaled = new Vec3();

  constructor(player, camera, inputManager) {
    this.player = player;
    this.camera = camera;
    this.input = inputManager;
  }

  update() {
    this.#updateLook();
    this.#updateMoveIntent();
  }

  #updateLook() {
    // Sin Pointer Lock el mouse no entrega deltas útiles y la vista saltaría.
    if (!this.input.isPointerLocked) return;
    this.camera.rotate(this.input.lookDeltaX, this.input.lookDeltaY);
  }

  #updateMoveIntent() {
    const player = this.player;
    player.clearIntent();

    const forwardAxis = this.input.axis(InputActions.MOVE_BACKWARD, InputActions.MOVE_FORWARD);
    const strafeAxis = this.input.axis(InputActions.MOVE_LEFT, InputActions.MOVE_RIGHT);

    if (forwardAxis !== 0 || strafeAxis !== 0) {
      this.#forwardScaled.copyFrom(this.camera.forward).scale(forwardAxis);
      this.#rightScaled.copyFrom(this.camera.right).scale(strafeAxis);
      player.moveIntent.copyFrom(this.#forwardScaled).add(this.#rightScaled).normalize();
    }

    player.isSprinting = this.input.isActionDown(InputActions.SPRINT);
    player.wantsToJump = this.input.isActionDown(InputActions.JUMP);
  }
}
