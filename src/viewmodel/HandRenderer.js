import { GameConfig } from '../game/GameConfig.js';
import { MathUtils } from '../utils/MathUtils.js';
import { ViewBob } from './ViewBob.js';

/**
 * Mano en primera persona: un cubo con la textura del bloque activo, o un
 * brazo si la ranura está vacía. Se dibuja con cámara fija (no la del
 * jugador) y después de limpiar el depth buffer, para que nunca quede
 * tapada por el mundo ni lo atraviese.
 *
 * Solo lee estado (ranura activa, si se está rompiendo, velocidad horizontal
 * y si está en el suelo) y escucha dos eventos (bloque roto/colocado); nunca
 * toca World, Player ni Hotbar directamente.
 */
export class HandRenderer {
  #blockType = null;
  #selectedIndex = null;

  #swingActive = false;
  #swingTime = 0;
  #swingLoop = false;
  #isBreaking = false;
  #pickaxeSwing = false;
  #swingJustStarted = false;

  #slotChangeTime = null;

  constructor(
    textureManager,
    camera = null,
    config = GameConfig.viewmodel.hand,
    cameraConfig = GameConfig.camera,
    viewBobConfig = GameConfig.viewmodel.viewBob
  ) {
    this.textures = textureManager;
    // Cámara real del jugador, solo para leer su FOV vigente (puede cambiar en
    // caliente desde Configuración). Nunca se usa su posición/orientación acá:
    // la mano tiene su propia cámara fija (ver #applyFixedCamera).
    this.playerCamera = camera;
    this.config = config;
    this.cameraConfig = cameraConfig;
    this.viewBob = new ViewBob(viewBobConfig);
  }

  /**
   * Ranura activa del hotbar. Si cambió de índice, dispara la animación de
   * bajar/subir la mano; el contenido (blockType, o null para el brazo) se
   * actualiza de una, la animación es puramente visual.
   * @param {number} selectedIndex
   * @param {import('../blocks/BlockType.js').BlockType|null} blockType
   */
  setSelectedSlot(selectedIndex, blockType) {
    if (this.#selectedIndex !== null && selectedIndex !== this.#selectedIndex) {
      this.#slotChangeTime = 0;
    }
    this.#selectedIndex = selectedIndex;
    this.#blockType = blockType;
  }

  /** Dispara un swing único (ease-out): llamar al recibir blockBroken. */
  notifyBlockBroken() {
    this.#pickaxeSwing = true;
    this.#startSwing();
  }

  /** Dispara un swing único (ease-out): llamar al recibir blockPlaced. */
  notifyBlockPlaced() {
    this.#pickaxeSwing = false;
    this.#startSwing();
  }

  #startSwing() {
    this.#swingActive = true;
    this.#swingTime = 0;
    this.#swingJustStarted = true;
  }

  /**
   * @param {number} deltaTime segundos desde el frame anterior
   * @param {object} state
   * @param {boolean} [state.isBreaking] true mientras se mantiene apretado romper
   * @param {number} [state.horizontalSpeed] velocidad horizontal del jugador
   * @param {boolean} [state.isOnGround]
   */
  update(deltaTime, { isBreaking = false, horizontalSpeed = 0, isOnGround = false } = {}) {
    this.viewBob.update(deltaTime, horizontalSpeed, isOnGround);
    this.#swingLoop = isBreaking;
    this.#isBreaking = isBreaking;
    this.#advanceSwing(deltaTime);
    if (!this.#swingActive) this.#pickaxeSwing = false;
    this.#advanceSlotChange(deltaTime);
  }

  #advanceSwing(deltaTime) {
    if (this.#swingJustStarted) {
      this.#swingJustStarted = false;
      return;
    }
    if (!this.#swingActive && !this.#swingLoop) return;
    if (!this.#swingActive && this.#swingLoop) this.#swingActive = true;

    this.#swingTime += deltaTime;
    if (this.#swingTime >= this.config.SWING_DURATION) {
      if (this.#swingLoop) {
        this.#swingTime -= this.config.SWING_DURATION;
      } else {
        this.#swingActive = false;
        this.#swingTime = 0;
      }
    }
  }

  #advanceSlotChange(deltaTime) {
    if (this.#slotChangeTime === null) return;
    this.#slotChangeTime += deltaTime;
    if (this.#slotChangeTime >= this.config.SLOT_CHANGE_DURATION) this.#slotChangeTime = null;
  }

  /** Curva de swing en [0, 1]: 0 al inicio y al final, pico a mitad de camino, con ease-out. */
  get swingAmount() {
    if (!this.#swingActive) return 0;
    const linear = MathUtils.clamp01(this.#swingTime / this.config.SWING_DURATION);
    const easedOut = 1 - (1 - linear) ** 3;
    return Math.sin(easedOut * Math.PI);
  }

  /** Curva de bajar/subir al cambiar de slot, misma forma que el swing. */
  get slotChangeAmount() {
    if (this.#slotChangeTime === null) return 0;
    const linear = MathUtils.clamp01(this.#slotChangeTime / this.config.SLOT_CHANGE_DURATION);
    return Math.sin(linear * Math.PI);
  }

  draw(p, _camera) {
    const swing = this.swingAmount;
    const dip = this.slotChangeAmount;

    const x = this.config.IDLE_OFFSET.x + this.viewBob.offsetX;
    const y =
      this.config.IDLE_OFFSET.y +
      this.viewBob.offsetY -
      swing * this.config.SWING_DISTANCE * 0.4 -
      dip * this.config.SLOT_CHANGE_DROP;
    const z = this.config.IDLE_OFFSET.z + swing * this.config.SWING_DISTANCE;

    p.push();
    p.clearDepth?.();
    this.#applyFixedCamera(p);
    p.translate(x, y, z);
    p.noStroke();

    if (this.#isBreaking || (this.#pickaxeSwing && this.#swingActive)) {
      this.#drawArm(p);
      this.#drawPickaxe(p, swing);
    } else if (this.#blockType) {
      this.#drawBlock(p);
    } else {
      this.#drawArm(p);
    }

    p.pop();
  }

  /**
   * Cámara fija mirando hacia -Z, con el mismo frustum que usa el juego.
   * El FOV se lee de la cámara real del jugador si está disponible (puede
   * haber sido cambiado en caliente desde Configuración); si no, se cae al
   * default de GameConfig.camera.
   */
  #applyFixedCamera(p) {
    const fovDegrees = this.playerCamera?.fov ?? this.cameraConfig.FOV_DEGREES;
    const near = this.cameraConfig.NEAR_PLANE;
    const top = near * Math.tan(MathUtils.degToRad(fovDegrees) / 2);
    const right = top * (p.width / p.height);
    p.frustum(-right, right, top, -top, near, this.cameraConfig.FAR_PLANE);
    p.camera(0, 0, 0, 0, 0, -1, 0, 1, 0);
  }

  #drawBlock(p) {
    const texture = this.#blockType.texture ? this.textures?.get(this.#blockType.texture) : null;
    if (texture) {
      p.texture(texture);
    } else {
      p.fill(...this.#blockType.color);
      p.ambientMaterial(...this.#blockType.color);
    }
    p.box(this.config.BLOCK_SCALE);
  }

  #drawArm(p) {
    p.fill(...this.config.ARM_COLOR);
    p.ambientMaterial(...this.config.ARM_COLOR);
    p.box(this.config.ARM_WIDTH, this.config.ARM_WIDTH, this.config.ARM_LENGTH);
  }

  #drawPickaxe(p, swing) {
    const { PICKAXE } = this.config;
    p.push();
    p.translate(PICKAXE.OFFSET.x, PICKAXE.OFFSET.y, PICKAXE.OFFSET.z);
    p.rotateZ(-PICKAXE.SWING_ROTATION * swing);

    p.fill(...PICKAXE.HANDLE_COLOR);
    p.ambientMaterial(...PICKAXE.HANDLE_COLOR);
    p.box(PICKAXE.HANDLE_WIDTH, PICKAXE.HANDLE_LENGTH, PICKAXE.HANDLE_WIDTH);

    p.fill(...PICKAXE.HEAD_COLOR);
    p.ambientMaterial(...PICKAXE.HEAD_COLOR);
    p.translate(0, -PICKAXE.HANDLE_LENGTH / 2, 0);
    p.box(PICKAXE.HEAD_WIDTH, PICKAXE.HEAD_HEIGHT, PICKAXE.HEAD_DEPTH);
    p.pop();
  }
}
