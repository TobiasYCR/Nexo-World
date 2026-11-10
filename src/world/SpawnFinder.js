import { BlockIds } from '../utils/Constants.js';

/** Bloques sobre los que no se aparece: la copa o el tronco de un árbol no son suelo. */
const NOT_GROUND = new Set([BlockIds.LOG, BlockIds.LEAVES]);

/**
 * Busca dónde aparecer: la columna más cercana al punto pedido cuyo bloque más
 * alto sea suelo de verdad y tenga lugar arriba para el jugador. Recorre
 * anillos cuadrados cada vez más grandes, así el resultado es siempre el mismo
 * para el mismo mundo.
 */
export class SpawnFinder {
  /**
   * @param {number} headroomBlocks bloques libres que necesita el jugador sobre el suelo
   * @param {number} maxRadius distancia máxima de búsqueda, en bloques
   */
  constructor(headroomBlocks = 2, maxRadius = 16) {
    this.headroomBlocks = headroomBlocks;
    this.maxRadius = maxRadius;
  }

  /**
   * @param {import('./World.js').World} world
   * @returns {{x:number, y:number, z:number}} columna y altura de los pies, en bloques
   */
  find(world, centerX, centerZ) {
    for (let radius = 0; radius <= this.maxRadius; radius += 1) {
      for (let dz = -radius; dz <= radius; dz += 1) {
        for (let dx = -radius; dx <= radius; dx += 1) {
          if (Math.max(Math.abs(dx), Math.abs(dz)) !== radius) continue;
          const spot = this.#standable(world, centerX + dx, centerZ + dz);
          if (spot) return spot;
        }
      }
    }
    // Sin suelo despejado cerca (mundo vacío o todo bosque): la superficie del centro.
    return { x: centerX, y: world.getSurfaceHeight(centerX, centerZ), z: centerZ };
  }

  #standable(world, x, z) {
    if (!world.isInsideBounds(x, 0, z)) return null;
    const y = world.getSurfaceHeight(x, z);
    if (y === 0 || y + this.headroomBlocks > world.height) return null;
    if (NOT_GROUND.has(world.getBlockId(x, y - 1, z))) return null;
    return { x, y, z };
  }
}
