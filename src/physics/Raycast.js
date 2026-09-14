import { GameConfig } from '../game/GameConfig.js';

/** Resultado de un raycast contra la grilla de bloques. */
export class RaycastHit {
  /**
   * @param {import('../blocks/Block.js').Block|null} block bloque impactado
   * @param {{x:number,y:number,z:number}|null} face normal de la cara golpeada,
   *   o null si el origen estaba dentro del bloque (no hay cara válida)
   */
  constructor(block, face, distance) {
    this.block = block;
    this.face = face;
    this.distance = distance;
  }

  /** Posición del bloque adyacente a la cara: donde iría un bloque nuevo. */
  get adjacentPosition() {
    if (!this.face) return null;
    return {
      x: this.block.x + this.face.x,
      y: this.block.y + this.face.y,
      z: this.block.z + this.face.z
    };
  }
}

/**
 * Recorrido de voxeles (algoritmo DDA de Amanatides & Woo): avanza rayo por
 * rayo saltando de celda en celda, sin muestreo por pasos fijos.
 *
 * La dirección se normaliza antes de recorrer para que el resultado no dependa
 * de la magnitud del vector, y la solidez se consulta a través del registro de
 * bloques del mundo (World.isSolid), nunca comparando ids a mano.
 */
export class Raycast {
  constructor(world, config = GameConfig.blocks) {
    this.world = world;
    this.reachDistance = config.REACH_DISTANCE;
  }

  cast(origin, direction, maxDistance = this.reachDistance) {
    const size = this.world.blockSize;

    const magnitude = Math.sqrt(
      direction.x * direction.x + direction.y * direction.y + direction.z * direction.z
    );
    if (magnitude === 0) return null;
    // Misma dirección, pero unitaria: la métrica de distancia solo depende del rayo.
    const dirX = direction.x / magnitude;
    const dirY = direction.y / magnitude;
    const dirZ = direction.z / magnitude;

    let x = Math.floor(origin.x / size);
    let y = Math.floor(origin.y / size);
    let z = Math.floor(origin.z / size);

    const step = { x: Math.sign(dirX), y: Math.sign(dirY), z: Math.sign(dirZ) };
    const tDelta = {
      x: dirX === 0 ? Infinity : Math.abs(size / dirX),
      y: dirY === 0 ? Infinity : Math.abs(size / dirY),
      z: dirZ === 0 ? Infinity : Math.abs(size / dirZ)
    };

    const tMax = {
      x: Raycast.#initialT(origin.x, dirX, x, size, tDelta.x),
      y: Raycast.#initialT(origin.y, dirY, y, size, tDelta.y),
      z: Raycast.#initialT(origin.z, dirZ, z, size, tDelta.z)
    };

    let face = { x: 0, y: 0, z: 0 };
    let travelled = 0;

    while (travelled <= maxDistance) {
      if (this.world.isSolid(x, y, z)) {
        const validFace = face.x !== 0 || face.y !== 0 || face.z !== 0;
        return new RaycastHit(this.world.getBlock(x, y, z), validFace ? face : null, travelled);
      }

      if (tMax.x < tMax.y && tMax.x < tMax.z) {
        travelled = tMax.x;
        tMax.x += tDelta.x;
        x += step.x;
        face = { x: -step.x, y: 0, z: 0 };
      } else if (tMax.y < tMax.z) {
        travelled = tMax.y;
        tMax.y += tDelta.y;
        y += step.y;
        face = { x: 0, y: -step.y, z: 0 };
      } else {
        travelled = tMax.z;
        tMax.z += tDelta.z;
        z += step.z;
        face = { x: 0, y: 0, z: -step.z };
      }
    }

    return null;
  }

  /** Distancia hasta el primer borde de celda en un eje. */
  static #initialT(originComponent, directionComponent, cell, size, tDelta) {
    if (directionComponent === 0) return Infinity;
    const boundary = directionComponent > 0 ? (cell + 1) * size : cell * size;
    return Math.abs((boundary - originComponent) / directionComponent) || tDelta;
  }
}