/**
 * Vector 3D mínimo y mutable. Se evita p5.Vector a propósito para que la lógica
 * de mundo, física y jugador sea testeable sin instanciar p5.
 */
export class Vec3 {
  constructor(x = 0, y = 0, z = 0) {
    this.x = x;
    this.y = y;
    this.z = z;
  }

  set(x, y, z) {
    this.x = x;
    this.y = y;
    this.z = z;
    return this;
  }

  copyFrom(other) {
    return this.set(other.x, other.y, other.z);
  }

  clone() {
    return new Vec3(this.x, this.y, this.z);
  }

  add(other) {
    this.x += other.x;
    this.y += other.y;
    this.z += other.z;
    return this;
  }

  addScaled(other, scale) {
    this.x += other.x * scale;
    this.y += other.y * scale;
    this.z += other.z * scale;
    return this;
  }

  scale(factor) {
    this.x *= factor;
    this.y *= factor;
    this.z *= factor;
    return this;
  }

  lengthSq() {
    return this.x * this.x + this.y * this.y + this.z * this.z;
  }

  length() {
    return Math.sqrt(this.lengthSq());
  }

  normalize() {
    const length = this.length();
    return length === 0 ? this : this.scale(1 / length);
  }

  toArray() {
    return [this.x, this.y, this.z];
  }
}

export class VectorUtils {
  /** Vector unitario horizontal a partir de un ángulo de guiñada (yaw) en radianes. */
  static forwardFromYaw(yaw, target = new Vec3()) {
    return target.set(Math.sin(yaw), 0, -Math.cos(yaw));
  }

  /** Vector unitario perpendicular al de avance, sobre el plano horizontal. */
  static rightFromYaw(yaw, target = new Vec3()) {
    return target.set(Math.cos(yaw), 0, Math.sin(yaw));
  }

  /** Dirección de mirada completa, con cabeceo (pitch) aplicado. */
  static directionFromAngles(yaw, pitch, target = new Vec3()) {
    const cosPitch = Math.cos(pitch);
    return target.set(
      Math.sin(yaw) * cosPitch,
      Math.sin(pitch),
      -Math.cos(yaw) * cosPitch
    );
  }
}
