import { AABB } from './AABB.js';

/**
 * Base del sistema de colisiones propio. Ya sabe traducir una caja a los bloques
 * sólidos que la rodean; la resolución de penetración por eje se implementa en
 * la etapa de física.
 *
 * Estado actual: consulta de solapamiento y recolección de candidatos.
 */
export class CollisionSystem {
  constructor(world) {
    this.world = world;
  }

  /** Cajas de los bloques sólidos que se superponen con la región dada. */
  collectSolidBoxes(region) {
    const size = this.world.blockSize;
    const boxes = [];

    const minX = Math.floor(region.minX / size);
    const maxX = Math.floor(region.maxX / size);
    const minY = Math.floor(region.minY / size);
    const maxY = Math.floor(region.maxY / size);
    const minZ = Math.floor(region.minZ / size);
    const maxZ = Math.floor(region.maxZ / size);

    for (let y = minY; y <= maxY; y += 1) {
      for (let z = minZ; z <= maxZ; z += 1) {
        for (let x = minX; x <= maxX; x += 1) {
          if (this.world.isSolid(x, y, z)) boxes.push(AABB.fromBlock(x, y, z, size));
        }
      }
    }

    return boxes;
  }

  isColliding(box) {
    return this.collectSolidBoxes(box).some((solid) => box.intersects(solid));
  }

  /** True si hay suelo sólido inmediatamente debajo de la caja. */
  isOnGround(box, tolerance = 0.05) {
    const probe = box.clone().translate(0, -tolerance, 0);
    probe.maxY = box.minY;
    return this.collectSolidBoxes(probe).some((solid) => probe.intersects(solid));
  }
}
