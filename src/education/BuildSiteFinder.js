import { BlockIds } from '../utils/Constants.js';

/** Bloques que no cuentan como suelo: la copa o el tronco de un árbol. */
const NOT_GROUND = new Set([BlockIds.LOG, BlockIds.LEAVES]);

/**
 * Busca dónde apoyar un plano: un rectángulo de suelo llano, sin árboles
 * encima y que no encierre al jugador. Recorre anillos cuadrados cada vez más
 * grandes alrededor del punto pedido, así que gana el lugar llano más cercano
 * y el resultado es siempre el mismo para el mismo mundo.
 *
 * Como mira el bloque más alto de cada columna, cualquier árbol (tronco u
 * hojas de un árbol vecino) que ocupe el rectángulo lo descarta, y todo lo que
 * queda por encima del suelo elegido ya está vacío.
 */
export class BuildSiteFinder {
  /**
   * @param {Object} [options]
   * @param {number} [options.searchRadius] distancia máxima al punto pedido, en bloques
   * @param {number} [options.maxUnevenness] diferencia de altura tolerada dentro del rectángulo
   * @param {number} [options.playerClearance] bloques libres entre el plano y el jugador
   */
  constructor({ searchRadius = 12, maxUnevenness = 1, playerClearance = 1 } = {}) {
    this.searchRadius = searchRadius;
    this.maxUnevenness = maxUnevenness;
    this.playerClearance = playerClearance;
  }

  /**
   * @param {import('../world/World.js').World} world
   * @param {{x:number, z:number}} center centro preferido del plano, en bloques
   * @param {{x:number, y:number, z:number}} size tamaño del plano ya rotado
   * @param {{x:number, z:number}|null} [player] columna del jugador
   * @returns {{x:number, y:number, z:number}|null} esquina mínima del plano, o null si no hay lugar
   */
  find(world, center, size, player = null) {
    let fallback = null;
    for (let radius = 0; radius <= this.searchRadius; radius += 1) {
      for (let dz = -radius; dz <= radius; dz += 1) {
        for (let dx = -radius; dx <= radius; dx += 1) {
          if (Math.max(Math.abs(dx), Math.abs(dz)) !== radius) continue;
          const anchorX = center.x + dx - Math.floor(size.x / 2);
          const anchorZ = center.z + dz - Math.floor(size.z / 2);
          const site = this.#evaluate(world, anchorX, anchorZ, size, player);
          if (!site) continue;
          if (site.unevenness === 0) return site.anchor;
          fallback ??= site.anchor;
        }
      }
    }
    return fallback;
  }

  #evaluate(world, anchorX, anchorZ, size, player) {
    if (player && this.#overlapsPlayer(anchorX, anchorZ, size, player)) return null;

    let lowest = Infinity;
    let highest = -Infinity;
    for (let z = anchorZ; z < anchorZ + size.z; z += 1) {
      for (let x = anchorX; x < anchorX + size.x; x += 1) {
        if (!world.isInsideBounds(x, 0, z)) return null;
        const ground = world.getSurfaceHeight(x, z);
        if (ground > 0 && NOT_GROUND.has(world.getBlockId(x, ground - 1, z))) return null;
        lowest = Math.min(lowest, ground);
        highest = Math.max(highest, ground);
        if (highest - lowest > this.maxUnevenness) return null;
      }
    }
    if (highest + size.y > world.height) return null;
    return { unevenness: highest - lowest, anchor: { x: anchorX, y: highest, z: anchorZ } };
  }

  #overlapsPlayer(anchorX, anchorZ, size, player) {
    const margin = this.playerClearance;
    return (
      player.x >= anchorX - margin &&
      player.x < anchorX + size.x + margin &&
      player.z >= anchorZ - margin &&
      player.z < anchorZ + size.z + margin
    );
  }
}
