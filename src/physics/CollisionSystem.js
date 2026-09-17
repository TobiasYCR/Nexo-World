import { AABB } from './AABB.js';
import { EPSILON } from '../utils/Constants.js';
import { GameConfig } from '../game/GameConfig.js';

/** Tabla de ejes: la resolución por eje se recorre en vez de reescribirse. */
const AXES = [
  Object.freeze({ axis: 'x', min: 'minX', max: 'maxX' }),
  Object.freeze({ axis: 'y', min: 'minY', max: 'maxY' }),
  Object.freeze({ axis: 'z', min: 'minZ', max: 'maxZ' })
];

/**
 * Resolución de colisiones AABB contra la grilla de bloques.
 *
 * resolveMovement mueve la caja eje por eje (X, luego Y, luego Z), recortando
 * cada componente contra la primera cara sólida que encuentre. Resolver en
 * pasos separados hace que el movimiento diagonal deslice a lo largo de una
 * pared en vez de trabarse.
 */
export class CollisionSystem {
  constructor(world, config = GameConfig) {
    this.world = world;
    this.config = config;
    this.skin = config.player.COLLISION_SKIN;
  }

  /**
   * Mueve la caja y la deja apoyada contra los bloques sólidos.
   * @param {AABB} box se muta en el lugar
   * @param {number} dx desplazamiento deseado en X
   * @param {number} dy desplazamiento deseado en Y
   * @param {number} dz desplazamiento deseado en Z
   * @returns {{box:AABB, moved:{x:number,y:number,z:number}, collided:{x:boolean,y:boolean,z:boolean}}}
   *   moved: cuánto se avanzó en cada eje; collided: en qué ejes se chocó.
   */
  resolveMovement(box, dx, dy, dz, skin = this.skin) {
    const deltas = { x: dx, y: dy, z: dz };
    const moved = { x: 0, y: 0, z: 0 };
    const collided = { x: false, y: false, z: false };

    for (const dim of AXES) {
      const step = this.#moveAxis(box, dim, deltas[dim.axis], skin);
      moved[dim.axis] = step.applied;
      collided[dim.axis] = step.collided;
    }

    return { box, moved, collided };
  }

  /** Mueve un solo eje, recortando contra la cara sólida más cercana. */
  #moveAxis(box, dim, delta, skin) {
    if (delta === 0) return { applied: 0, collided: false };

    const offset = { x: 0, y: 0, z: 0 };
    offset[dim.axis] = delta;
    const sweep = box.expandedBy(offset.x, offset.y, offset.z);

    const start = delta > 0 ? box[dim.max] : box[dim.min];
    let stop = start + delta;
    let collided = false;

    for (const solid of this.collectSolidBoxes(sweep)) {
      if (delta > 0) {
        const face = solid[dim.min];
        if (face < box[dim.max] - EPSILON) continue; // caja ya pasada
        const candidate = face - skin;
        if (candidate < stop) {
          stop = candidate;
          collided = true;
        }
      } else {
        const face = solid[dim.max];
        if (face > box[dim.min] + EPSILON) continue; // cara delante de la arrancada
        const candidate = face + skin;
        if (candidate > stop) {
          stop = candidate;
          collided = true;
        }
      }
    }

    const applied = stop - start;
    offset[dim.axis] = applied;
    box.translate(offset.x, offset.y, offset.z);

    return { applied, collided };
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