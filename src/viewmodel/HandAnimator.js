import { GameConfig } from '../game/GameConfig.js';
import { MathUtils } from '../utils/MathUtils.js';
import { ViewBob } from './ViewBob.js';

/**
 * Calcula el estado visual de la mano y del objeto equipado. No dibuja, no
 * conoce al jugador y no cambia ninguna regla del juego.
 */
export class HandAnimator {
  #selectedIndex = null;
  #swingActive = false;
  #swingTime = 0;
  #swingLoop = false;
  #swingJustStarted = false;
  #slotChangeTime = null;
  #isBreaking = false;
  #pickaxeSwing = false;
  #action = 'none';
  #landingOffset = 0;
  #landingCompression = 0;
  #landingRotation = 0;
  #breathTime = 0;

  #offsetX = 0;
  #offsetY = 0;
  #offsetZ = 0;
  #rotationX = 0;
  #rotationY = 0;
  #rotationZ = 0;
  #scaleY = 1;
  #viewBob;

  constructor(
    handConfig = GameConfig.viewmodel.hand,
    viewBobConfig = GameConfig.viewmodel.viewBob,
    config = GameConfig.viewmodel.handAnimator
  ) {
    this.handConfig = handConfig;
    this.config = config;
    this.viewBob = new ViewBob(viewBobConfig);
  }

  get offsetX() { return this.#offsetX; }
  get offsetY() { return this.#offsetY; }
  get offsetZ() { return this.#offsetZ; }
  get rotationX() { return this.#rotationX; }
  get rotationY() { return this.#rotationY; }
  get rotationZ() { return this.#rotationZ; }
  get scaleY() { return this.#scaleY; }
  get isBreaking() { return this.#isBreaking; }
  get showPickaxe() { return this.#pickaxeSwing && this.#swingActive; }
  get selectedIndex() { return this.#selectedIndex; }
  get switchProgress() {
    if (this.#slotChangeTime === null) return 1;
    return MathUtils.clamp01(this.#slotChangeTime / Math.max(Number.EPSILON, this.handConfig.SLOT_CHANGE_DURATION));
  }
  get isSwitching() { return this.#slotChangeTime !== null; }
  get state() {
    if (this.isSwitching) return 'Switching';
    if (this.#isBreaking) return 'Breaking';
    if (this.#swingActive && this.#action === 'placing') return 'Placing';
    if (this.#landingOffset !== 0 || this.#landingCompression !== 0) return 'Landing';
    if (this.viewBob.offsetX !== 0 || this.viewBob.offsetY !== 0) return 'Walking';
    return 'Idle';
  }
  get viewBob() { return this.#viewBob; }
  set viewBob(value) { this.#viewBob = value; }

  setSelectedSlot(selectedIndex) {
    if (this.#selectedIndex !== null && selectedIndex !== this.#selectedIndex) {
      this.#slotChangeTime = 0;
    }
    this.#selectedIndex = selectedIndex;
  }

  notifyBlockBroken() {
    this.#pickaxeSwing = true;
    this.#action = 'breaking';
    this.#startSwing();
  }

  notifyBlockPlaced() {
    this.#pickaxeSwing = false;
    this.#action = 'placing';
    this.#startSwing();
  }

  setLandingTransform(offset = 0, compression = 0) {
    this.#landingOffset = Number.isFinite(offset) ? offset : 0;
    this.#landingCompression = MathUtils.clamp01(compression);
    this.#landingRotation = this.#landingCompression * (this.config.LANDING_ROTATION ?? 0);
  }

  resetTemporary() {
    this.#swingActive = false;
    this.#swingLoop = false;
    this.#swingTime = 0;
    this.#swingJustStarted = false;
    this.#slotChangeTime = null;
    this.#pickaxeSwing = false;
    this.#action = 'none';
    this.setLandingTransform(0, 0);
    this.#offsetX = 0;
    this.#offsetY = 0;
    this.#offsetZ = 0;
    this.#rotationX = 0;
    this.#rotationY = 0;
    this.#rotationZ = 0;
    this.#scaleY = 1;
  }

  update(deltaTime, {
    isBreaking = false,
    horizontalSpeed = 0,
    isOnGround = false,
    isSprinting = false,
    paused = false
  } = {}) {
    if (paused) return;

    const safeDelta = Math.max(0, Number.isFinite(deltaTime) ? deltaTime : 0);
    this.viewBob.update(safeDelta, horizontalSpeed, isOnGround, isSprinting);
    this.#isBreaking = isBreaking;
    this.#swingLoop = isBreaking;
    this.#advanceSwing(safeDelta);
    this.#advanceSlotChange(safeDelta);
    this.#breathTime += safeDelta * (this.config.IDLE_BREATH_FREQUENCY ?? 0);

    const swing = this.swingAmount;
    const slot = this.slotChangeAmount;
    const breath = this.#idleBreath(isBreaking, horizontalSpeed, isOnGround);
    const breakRotation = swing * (isBreaking ? (this.config.BREAK_ROTATION ?? 0) : (this.config.PLACE_ROTATION ?? 0));

    this.#offsetX = this.viewBob.offsetX;
    this.#offsetY = this.viewBob.offsetY + breath - slot * this.handConfig.SLOT_CHANGE_DROP;
    this.#offsetZ = swing * this.handConfig.SWING_DISTANCE;
    this.#offsetY -= swing * this.handConfig.SWING_DISTANCE * 0.4;
    this.#offsetY -= this.#landingOffset;
    this.#rotationX = breakRotation + this.#landingRotation;
    this.#rotationY = this.viewBob.offsetX * 0.025;
    this.#rotationZ = this.viewBob.offsetY * 0.04;
    this.#scaleY = 1 - this.#landingCompression * (this.config.LANDING_COMPRESSION ?? 0);

    if (!this.#swingActive) this.#pickaxeSwing = false;
  }

  get swingAmount() {
    if (!this.#swingActive) return 0;
    const duration = Math.max(Number.EPSILON, this.handConfig.SWING_DURATION);
    const linear = MathUtils.clamp01(this.#swingTime / duration);
    const power = this.config.EASING_POWER ?? 3;
    const eased = 1 - (1 - linear) ** power;
    return Math.sin(eased * Math.PI);
  }

  get slotChangeAmount() {
    if (this.#slotChangeTime === null) return 0;
    const duration = Math.max(Number.EPSILON, this.handConfig.SLOT_CHANGE_DURATION);
    return Math.sin(MathUtils.clamp01(this.#slotChangeTime / duration) * Math.PI);
  }

  #startSwing() {
    this.#swingActive = true;
    this.#swingTime = 0;
    this.#swingJustStarted = true;
  }

  #advanceSwing(deltaTime) {
    if (this.#swingJustStarted) {
      this.#swingJustStarted = false;
      return;
    }
    if (!this.#swingActive && !this.#swingLoop) return;
    if (!this.#swingActive && this.#swingLoop) this.#swingActive = true;

    this.#swingTime += deltaTime;
    const duration = Math.max(Number.EPSILON, this.handConfig.SWING_DURATION);
    if (this.#swingTime >= duration) {
      if (this.#swingLoop) this.#swingTime %= duration;
      else {
        this.#swingActive = false;
        this.#swingTime = 0;
      }
    }
  }

  #advanceSlotChange(deltaTime) {
    if (this.#slotChangeTime === null) return;
    this.#slotChangeTime += deltaTime;
    if (this.#slotChangeTime >= this.handConfig.SLOT_CHANGE_DURATION) this.#slotChangeTime = null;
  }

  #idleBreath(isBreaking, horizontalSpeed, isOnGround) {
    if (isBreaking || horizontalSpeed > 0.01 || !isOnGround) return 0;
    return Math.sin(this.#breathTime) * (this.config.IDLE_BREATH_AMPLITUDE ?? 0);
  }
}
