import { BlockIds } from '../utils/Constants.js';

/** Resultado de un raycast contra la grilla de bloques. */
export class RaycastHit {
  constructor(block, face, distance) {
    this.block = block;
    /** Normal de la cara golpeada, en coordenadas de bloque. */
    this.face = face;
    this.distance = distance;
  }

  /** Posición del bloque adyacente a la cara: donde iría un bloque nuevo. */
  get adjacentPosition() {
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
 * Queda disponible para la etapa de romper/colocar bloques.
 */
export class Raycast {
  constructor(world) {
    this.world = world;
  }

  cast(origin, direction, maxDistance) {
    const size = this.world.blockSize;

    let x = Math.floor(origin.x / size);
    let y = Math.floor(origin.y / size);
    let z = Math.floor(origin.z / size);

    const step = { x: Math.sign(direction.x), y: Math.sign(direction.y), z: Math.sign(direction.z) };
    const tDelta = {
      x: direction.x === 0 ? Infinity : Math.abs(size / direction.x),
      y: direction.y === 0 ? Infinity : Math.abs(size / direction.y),
      z: direction.z === 0 ? Infinity : Math.abs(size / direction.z)
    };

    const tMax = {
      x: Raycast.#initialT(origin.x, direction.x, x, size, tDelta.x),
      y: Raycast.#initialT(origin.y, direction.y, y, size, tDelta.y),
      z: Raycast.#initialT(origin.z, direction.z, z, size, tDelta.z)
    };

    let face = { x: 0, y: 0, z: 0 };
    let travelled = 0;

    while (travelled <= maxDistance) {
      if (this.world.getBlockId(x, y, z) !== BlockIds.AIR) {
        return new RaycastHit(this.world.getBlock(x, y, z), face, travelled);
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
