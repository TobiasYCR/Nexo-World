/**
 * Caja alineada a los ejes. Base del sistema de colisiones propio: tanto el
 * jugador como los bloques se representan con AABB.
 */
export class AABB {
  constructor(minX, minY, minZ, maxX, maxY, maxZ) {
    this.minX = minX;
    this.minY = minY;
    this.minZ = minZ;
    this.maxX = maxX;
    this.maxY = maxY;
    this.maxZ = maxZ;
  }

  /** Caja centrada horizontalmente en (x, z), apoyada en y. */
  static fromCenterBase(x, y, z, width, height) {
    const half = width / 2;
    return new AABB(x - half, y, z - half, x + half, y + height, z + half);
  }

  static fromBlock(blockX, blockY, blockZ, blockSize) {
    return new AABB(
      blockX * blockSize,
      blockY * blockSize,
      blockZ * blockSize,
      (blockX + 1) * blockSize,
      (blockY + 1) * blockSize,
      (blockZ + 1) * blockSize
    );
  }

  get width() {
    return this.maxX - this.minX;
  }

  get height() {
    return this.maxY - this.minY;
  }

  get depth() {
    return this.maxZ - this.minZ;
  }

  clone() {
    return new AABB(this.minX, this.minY, this.minZ, this.maxX, this.maxY, this.maxZ);
  }

  translate(dx, dy, dz) {
    this.minX += dx;
    this.maxX += dx;
    this.minY += dy;
    this.maxY += dy;
    this.minZ += dz;
    this.maxZ += dz;
    return this;
  }

  /** Solapamiento estricto: tocarse por una cara no cuenta como intersección. */
  intersects(other) {
    return (
      this.minX < other.maxX && this.maxX > other.minX &&
      this.minY < other.maxY && this.maxY > other.minY &&
      this.minZ < other.maxZ && this.maxZ > other.minZ
    );
  }

  containsPoint(x, y, z) {
    return (
      x >= this.minX && x <= this.maxX &&
      y >= this.minY && y <= this.maxY &&
      z >= this.minZ && z <= this.maxZ
    );
  }

  /** Caja que cubre el recorrido completo del movimiento, para el barrido de candidatos. */
  expandedBy(dx, dy, dz) {
    return new AABB(
      Math.min(this.minX, this.minX + dx),
      Math.min(this.minY, this.minY + dy),
      Math.min(this.minZ, this.minZ + dz),
      Math.max(this.maxX, this.maxX + dx),
      Math.max(this.maxY, this.maxY + dy),
      Math.max(this.maxZ, this.maxZ + dz)
    );
  }
}
