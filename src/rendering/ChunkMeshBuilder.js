/**
 * Las seis caras de un cubo, en el mismo orden y con los mismos vértices que
 * usa box() de p5.
 *
 * corners son índices de octante (bit 0 = x, bit 1 = y, bit 2 = z).
 *
 * Las coordenadas de textura NO son las de box(): ahí la cara de adelante y la
 * de la derecha tenían la textura girada 90° (tablones verticales en una pared
 * y horizontales en la de al lado). Acá en las caras laterales u va siempre en
 * horizontal y v en vertical con el borde de arriba de la imagen arriba, y en
 * las de arriba y abajo u va en x y v en z.
 */
const FACES = Object.freeze([
  { dx: -1, dy: 0, dz: 0, corners: [0, 4, 2, 6] },
  { dx: 1, dy: 0, dz: 0, corners: [1, 3, 5, 7] },
  { dx: 0, dy: -1, dz: 0, corners: [0, 1, 4, 5] },
  { dx: 0, dy: 1, dz: 0, corners: [2, 6, 3, 7] },
  { dx: 0, dy: 0, dz: -1, corners: [0, 2, 1, 3] },
  { dx: 0, dy: 0, dz: 1, corners: [4, 5, 6, 7] }
]);

/**
 * Geometría de un chunk agrupada por tipo de bloque.
 *
 * Una cara se genera solo si el vecino en esa dirección no es opaco (aire,
 * vidrio, hojas o fuera del mundo). Así, las paredes de las cuevas y el
 * interior del terreno no generan nada, y cada tipo de bloque del chunk se
 * dibuja con una sola llamada en lugar de un box() por bloque.
 *
 * Es código puro: no conoce p5. BlockRenderer convierte el resultado en
 * p5.Geometry.
 */
export class ChunkMeshBuilder {
  /**
   * @param {import('../blocks/BlockRegistry.js').BlockRegistry} blockRegistry
   * @param {number} blockSize lado de un bloque en unidades de mundo
   */
  constructor(blockRegistry, blockSize) {
    this.blockRegistry = blockRegistry;
    this.blockSize = blockSize;
  }

  /**
   * @param {import('../world/World.js').World} world para consultar vecinos en otros chunks
   * @param {import('../world/Chunk.js').Chunk} chunk
   * @param {{greedy?: boolean}} [options] greedy une caras vecinas del mismo tipo
   *   en rectángulos más grandes (la textura se repite: hay que dibujar con
   *   textureWrap REPEAT)
   * @returns {{groups: Map<number, {positions:number[], normals:number[], uvs:number[], indices:number[], faceCount:number}>,
   *            visibleBlocks:number, faceCount:number}}
   */
  build(world, chunk, { greedy = false } = {}) {
    if (greedy) return this.#buildGreedy(world, chunk);
    const groups = new Map();
    const originX = chunk.chunkX * chunk.sizeX;
    const originZ = chunk.chunkZ * chunk.sizeZ;
    const registry = this.blockRegistry;
    let visibleBlocks = 0;
    let faceCount = 0;

    /** Vecino dentro del chunk sin pasar por World; en los bordes, World resuelve el chunk vecino. */
    const neighborOpaque = (localX, y, localZ) => {
      if (localX >= 0 && localX < chunk.sizeX && localZ >= 0 && localZ < chunk.sizeZ) {
        return registry.isOpaque(chunk.getBlock(localX, y, localZ));
      }
      return registry.isOpaque(world.getBlockId(originX + localX, y, originZ + localZ));
    };

    chunk.forEachSolid((localX, y, localZ, blockId) => {
      let blockHasFace = false;
      for (const face of FACES) {
        if (neighborOpaque(localX + face.dx, y + face.dy, localZ + face.dz)) continue;
        let group = groups.get(blockId);
        if (!group) {
          group = { positions: [], normals: [], uvs: [], indices: [], faceCount: 0 };
          groups.set(blockId, group);
        }
        this.#pushFace(group, face, originX + localX, y, originZ + localZ);
        blockHasFace = true;
        faceCount += 1;
      }
      if (blockHasFace) visibleBlocks += 1;
    });

    return { groups, visibleBlocks, faceCount };
  }

  /**
   * Greedy meshing: por cada dirección y cada capa arma una grilla con las
   * caras visibles y la cubre con rectángulos lo más grandes posible del mismo
   * tipo de bloque. Mismo resultado visual con muchas menos caras.
   */
  #buildGreedy(world, chunk) {
    const groups = new Map();
    const dims = [chunk.sizeX, chunk.height, chunk.sizeZ];
    const originX = chunk.chunkX * chunk.sizeX;
    const originZ = chunk.chunkZ * chunk.sizeZ;
    const registry = this.blockRegistry;
    const visible = new Uint8Array(chunk.sizeX * chunk.height * chunk.sizeZ);
    let faceCount = 0;

    const blockAt = (local) => {
      const [x, y, z] = local;
      if (y < 0 || y >= chunk.height) return world.getBlockId(originX + x, y, originZ + z);
      if (x >= 0 && x < chunk.sizeX && z >= 0 && z < chunk.sizeZ) return chunk.getBlock(x, y, z);
      return world.getBlockId(originX + x, y, originZ + z);
    };

    for (const face of FACES) {
      const normal = [face.dx, face.dy, face.dz];
      const axis = normal.findIndex((value) => value !== 0);
      const direction = normal[axis];
      const uAxis = ChunkMeshBuilder.#bitAxis(face.corners[0] ^ face.corners[1]);
      const vAxis = ChunkMeshBuilder.#bitAxis(face.corners[0] ^ face.corners[2]);
      const sizeU = dims[uAxis];
      const sizeV = dims[vAxis];
      const mask = new Int32Array(sizeU * sizeV);
      const cell = [0, 0, 0];
      const neighbor = [0, 0, 0];

      for (let layer = 0; layer < dims[axis]; layer += 1) {
        // 1. Caras visibles de esta capa.
        let any = false;
        for (let v = 0; v < sizeV; v += 1) {
          for (let u = 0; u < sizeU; u += 1) {
            cell[axis] = layer;
            cell[uAxis] = u;
            cell[vAxis] = v;
            const id = blockAt(cell);
            let value = 0;
            if (id !== 0) {
              neighbor[0] = cell[0] + face.dx;
              neighbor[1] = cell[1] + face.dy;
              neighbor[2] = cell[2] + face.dz;
              if (!registry.isOpaque(blockAt(neighbor))) {
                value = id;
                visible[(cell[1] * chunk.sizeZ + cell[2]) * chunk.sizeX + cell[0]] = 1;
                any = true;
              }
            }
            mask[v * sizeU + u] = value;
          }
        }
        if (!any) continue;

        // 2. Rectángulos: se extiende en u mientras siga el mismo tipo, y después en v.
        for (let v = 0; v < sizeV; v += 1) {
          for (let u = 0; u < sizeU;) {
            const id = mask[v * sizeU + u];
            if (id === 0) {
              u += 1;
              continue;
            }
            let width = 1;
            while (u + width < sizeU && mask[v * sizeU + u + width] === id) width += 1;
            let height = 1;
            grow: while (v + height < sizeV) {
              for (let k = 0; k < width; k += 1) {
                if (mask[(v + height) * sizeU + u + k] !== id) break grow;
              }
              height += 1;
            }
            for (let dv = 0; dv < height; dv += 1) mask.fill(0, (v + dv) * sizeU + u, (v + dv) * sizeU + u + width);

            let group = groups.get(id);
            if (!group) {
              group = { positions: [], normals: [], uvs: [], indices: [], faceCount: 0 };
              groups.set(id, group);
            }
            this.#pushQuad(group, face, { axis, direction, layer, uAxis, vAxis, u, v, width, height }, originX, originZ);
            faceCount += 1;
            u += width;
          }
        }
      }
    }

    let visibleBlocks = 0;
    for (const flag of visible) visibleBlocks += flag;
    return { groups, visibleBlocks, faceCount };
  }

  #pushQuad(group, face, quad, originX, originZ) {
    const size = this.blockSize;
    const { axis, direction, layer, uAxis, vAxis, u, v, width, height } = quad;
    const first = group.positions.length / 3;
    const corner = [0, 0, 0];
    for (let j = 0; j < 4; j += 1) {
      corner[axis] = layer + (direction > 0 ? 1 : 0);
      corner[uAxis] = u + ((j & 1) ? width : 0);
      corner[vAxis] = v + ((j & 2) ? height : 0);
      group.positions.push((originX + corner[0]) * size, corner[1] * size, (originZ + corner[2]) * size);
      group.normals.push(face.dx, face.dy, face.dz);
      const extent = [0, 0, 0];
      extent[uAxis] = width;
      extent[vAxis] = height;
      const offset = [0, 0, 0];
      offset[uAxis] = corner[uAxis] - u;
      offset[vAxis] = corner[vAxis] - v;
      group.uvs.push(...ChunkMeshBuilder.#textureCoords(face, offset, extent));
    }
    group.indices.push(first, first + 1, first + 2, first + 2, first + 1, first + 3);
    group.faceCount += 1;
  }

  /**
   * Coordenadas de textura de un vértice. offset es la posición del vértice
   * dentro del rectángulo y extent su tamaño, los dos en bloques por eje; en
   * greedy la textura se repite una vez por bloque.
   */
  static #textureCoords(face, offset, extent) {
    if (face.dy !== 0) return [offset[0], offset[2]];
    const horizontal = face.dx !== 0 ? 2 : 0;
    return [offset[horizontal], extent[1] - offset[1]];
  }

  /** Eje (0 = x, 1 = y, 2 = z) del único bit encendido en un índice de octante. */
  static #bitAxis(bits) {
    return bits === 1 ? 0 : bits === 2 ? 1 : 2;
  }

  #pushFace(group, face, x, y, z) {
    const size = this.blockSize;
    const first = group.positions.length / 3;
    for (let j = 0; j < 4; j += 1) {
      const corner = face.corners[j];
      group.positions.push(
        (x + (corner & 1)) * size,
        (y + ((corner >> 1) & 1)) * size,
        (z + ((corner >> 2) & 1)) * size
      );
      group.normals.push(face.dx, face.dy, face.dz);
      group.uvs.push(...ChunkMeshBuilder.#textureCoords(face, [corner & 1, (corner >> 1) & 1, (corner >> 2) & 1], [1, 1, 1]));
    }
    group.indices.push(first, first + 1, first + 2, first + 2, first + 1, first + 3);
    group.faceCount += 1;
  }
}
