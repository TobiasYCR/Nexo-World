import { GameConfig } from '../game/GameConfig.js';
import { MathUtils } from '../utils/MathUtils.js';
import { HandAnimator } from './HandAnimator.js';
import { BlockIds } from '../utils/Constants.js';

/** Dibuja la mano en primera persona; HandAnimator calcula sus transformaciones. */
export class HandRenderer {
  #blockType = null;
  #pendingBlockType = null;
  #hasPendingSwitch = false;
  #selectedIndex = null;
  #switchApplied = false;

  constructor(
    textureManager,
    camera = null,
    config = GameConfig.viewmodel.hand,
    cameraConfig = GameConfig.camera,
    viewBobConfig = GameConfig.viewmodel.viewBob,
    animatorConfig = GameConfig.viewmodel.handAnimator
  ) {
    this.textures = textureManager;
    this.playerCamera = camera;
    this.config = config;
    this.cameraConfig = cameraConfig;
    this.animator = new HandAnimator(config, viewBobConfig, animatorConfig);
    this.viewBob = this.animator.viewBob;
  }

  setSelectedSlot(selectedIndex, blockType) {
    const changed = this.#selectedIndex !== null && selectedIndex !== this.#selectedIndex;
    this.animator.setSelectedSlot(selectedIndex);
    this.#selectedIndex = selectedIndex;
    if (changed) {
      this.#pendingBlockType = blockType;
      this.#hasPendingSwitch = true;
      this.#switchApplied = false;
    } else {
      this.#blockType = blockType;
      this.#pendingBlockType = null;
      this.#hasPendingSwitch = false;
    }
  }

  notifyBlockBroken() {
    this.animator.notifyBlockBroken();
  }

  notifyBlockPlaced() {
    this.animator.notifyBlockPlaced();
  }

  setLandingTransform(offset, compression) {
    this.animator.setLandingTransform(offset, compression);
  }

  resetTemporary() {
    this.animator.resetTemporary();
    this.#pendingBlockType = null;
    this.#hasPendingSwitch = false;
    this.#switchApplied = false;
  }

  update(deltaTime, state = {}) {
    this.animator.update(deltaTime, state);
    if (this.#hasPendingSwitch && !this.#switchApplied && this.animator.switchProgress >= 0.5) {
      this.#blockType = this.#pendingBlockType;
      this.#pendingBlockType = null;
      this.#hasPendingSwitch = false;
      this.#switchApplied = true;
    }
  }

  get swingAmount() {
    return this.animator.swingAmount;
  }

  get slotChangeAmount() {
    return this.animator.slotChangeAmount;
  }

  get animationState() {
    return this.animator.state;
  }

  draw(p, _camera) {
    const x = this.config.IDLE_OFFSET.x + this.animator.offsetX;
    const y = this.config.IDLE_OFFSET.y + this.animator.offsetY;
    const z = this.config.IDLE_OFFSET.z + this.animator.offsetZ;

    p.push();
    p.clearDepth?.();
    this.#applyFixedCamera(p);
    p.translate(x, y, z);
    p.rotateX?.(this.animator.rotationX);
    p.rotateY?.(this.animator.rotationY);
    p.rotateZ?.(this.animator.rotationZ);
    if (this.animator.scaleY !== 1) p.scale?.(1, this.animator.scaleY, 1);
    p.noStroke();

    if (this.animator.isBreaking || this.animator.showPickaxe) {
      this.#drawArm(p);
      this.#drawPickaxe(p, this.swingAmount);
    } else if (this.#blockType) {
      this.#drawBlock(p);
    } else {
      this.#drawArm(p);
    }

    p.pop();
  }

  #applyFixedCamera(p) {
    const fovDegrees = this.playerCamera?.fov ?? this.cameraConfig.FOV_DEGREES;
    const near = this.cameraConfig.NEAR_PLANE;
    const top = near * Math.tan(MathUtils.degToRad(fovDegrees) / 2);
    const right = top * (p.width / p.height);
    p.frustum(-right, right, top, -top, near, this.cameraConfig.FAR_PLANE);
    p.camera(0, 0, 0, 0, 0, -1, 0, 1, 0);
  }

  #drawBlock(p) {
    if (this.#blockType.id === BlockIds.LOG && typeof p.beginShape === 'function') {
      this.#drawLogBlock(p);
      return;
    }
    const texture = this.#blockType.texture ? this.textures?.get(this.#blockType.texture) : null;
    if (texture) {
      p.texture(texture);
    } else {
      p.fill(...this.#blockType.color);
      p.ambientMaterial(...this.#blockType.color);
    }
    p.box(this.config.BLOCK_SCALE);
  }

  #drawLogBlock(p) {
    const s = this.config.BLOCK_SCALE;
    const h = s / 2;
    const topTexName = this.#blockType.textures?.top ?? this.#blockType.texture;
    const sideTexName = this.#blockType.textures?.side ?? this.#blockType.texture;
    const topTex = topTexName ? this.textures?.get(topTexName) : null;
    const sideTex = sideTexName ? this.textures?.get(sideTexName) : null;
    const mode = p.QUADS ?? 0;

    // Caras superior e inferior (anillos del tronco)
    p.push();
    if (topTex) {
      p.texture(topTex);
    } else {
      p.fill(...this.#blockType.color);
      p.ambientMaterial(...this.#blockType.color);
    }
    p.beginShape(mode);
    // Top (+Y)
    p.vertex(-h, h, -h, 0, 0);
    p.vertex(h, h, -h, 1, 0);
    p.vertex(h, h, h, 1, 1);
    p.vertex(-h, h, h, 0, 1);
    // Bottom (-Y)
    p.vertex(-h, -h, -h, 0, 0);
    p.vertex(h, -h, -h, 1, 0);
    p.vertex(h, -h, h, 1, 1);
    p.vertex(-h, -h, h, 0, 1);
    p.endShape();
    p.pop();

    // Caras laterales (corteza vertical)
    p.push();
    if (sideTex) {
      p.texture(sideTex);
    } else {
      p.fill(...this.#blockType.color);
      p.ambientMaterial(...this.#blockType.color);
    }
    p.beginShape(mode);
    // Front (+Z)
    p.vertex(-h, -h, h, 0, 1);
    p.vertex(h, -h, h, 1, 1);
    p.vertex(h, h, h, 1, 0);
    p.vertex(-h, h, h, 0, 0);
    // Back (-Z)
    p.vertex(h, -h, -h, 0, 1);
    p.vertex(-h, -h, -h, 1, 1);
    p.vertex(-h, h, -h, 1, 0);
    p.vertex(h, h, -h, 0, 0);
    // Left (-X)
    p.vertex(-h, -h, -h, 0, 1);
    p.vertex(-h, -h, h, 1, 1);
    p.vertex(-h, h, h, 1, 0);
    p.vertex(-h, h, -h, 0, 0);
    // Right (+X)
    p.vertex(h, -h, h, 0, 1);
    p.vertex(h, -h, -h, 1, 1);
    p.vertex(h, h, -h, 1, 0);
    p.vertex(h, h, h, 0, 0);
    p.endShape();
    p.pop();
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
    // Mantiene la cabeza del pico arriba en reposo y suma el movimiento del golpe.
    p.rotateZ((PICKAXE.HOLD_ROTATION ?? 0) - PICKAXE.SWING_ROTATION * swing);

    p.fill(...PICKAXE.HANDLE_COLOR);
    p.ambientMaterial(...PICKAXE.HANDLE_COLOR);
    p.box(PICKAXE.HANDLE_WIDTH, PICKAXE.HANDLE_LENGTH, PICKAXE.HANDLE_WIDTH);

    p.fill(...PICKAXE.HEAD_COLOR);
    p.ambientMaterial(...PICKAXE.HEAD_COLOR);
    // En esta proyección, el extremo positivo de Y es la parte superior de la
    // vista de primera persona. La cabeza queda allí, lejos de la mano.
    p.translate(0, PICKAXE.HANDLE_LENGTH / 2, 0);
    p.box(PICKAXE.HEAD_WIDTH, PICKAXE.HEAD_HEIGHT, PICKAXE.HEAD_DEPTH);
    p.pop();
  }
}
