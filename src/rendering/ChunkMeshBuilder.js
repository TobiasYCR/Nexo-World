/**
 * Las seis caras de un cubo, en el mismo orden y con los mismos vértices
 * y coordenadas de textura que usa box() de p5: así un bloque se ve igual que
 * antes, pero solo se generan las caras que pueden verse.
 *
 * corners son índices de octante (bit 0 = x, bit 1 = y, bit 2 = z).
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
   * @returns {{groups: Map<number, {positions:number[], normals:number[], uvs:number[], indices:number[], faceCount:number}>,
   *            visibleBlocks:number, faceCount:number}}
   */
  build(world, chunk) {
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
      group.uvs.push(j & 1, (j & 2) / 2);
    }
    group.indices.push(first, first + 1, first + 2, first + 2, first + 1, first + 3);
    group.faceCount += 1;
  }
}
