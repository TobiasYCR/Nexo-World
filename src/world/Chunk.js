import { BlockIds } from '../utils/Constants.js';

/**
 * Porción del mundo con almacenamiento propio. El mundo ya se organiza en chunks
 * aunque todavía no exista carga/descarga dinámica: así, cuando se agregue,
 * no hay que cambiar la representación de datos ni las firmas públicas.
 *
 * Las coordenadas de los métodos son LOCALES al chunk.
 */
export class Chunk {
  constructor(chunkX, chunkZ, sizeX, height, sizeZ) {
    this.chunkX = chunkX;
    this.chunkZ = chunkZ;
    this.sizeX = sizeX;
    this.height = height;
    this.sizeZ = sizeZ;

    this.blocks = new Uint8Array(sizeX * height * sizeZ);
    /** Marca de cambios para que el renderer pueda invalidar cachés a futuro. */
    this.dirty = true;
  }

  get key() {
    return Chunk.keyOf(this.chunkX, this.chunkZ);
  }

  static keyOf(chunkX, chunkZ) {
    return `${chunkX},${chunkZ}`;
  }

  containsLocal(x, y, z) {
    return x >= 0 && x < this.sizeX && y >= 0 && y < this.height && z >= 0 && z < this.sizeZ;
  }

  #index(x, y, z) {
    return (y * this.sizeZ + z) * this.sizeX + x;
  }

  getBlock(x, y, z) {
    if (!this.containsLocal(x, y, z)) return BlockIds.AIR;
    return this.blocks[this.#index(x, y, z)];
  }

  setBlock(x, y, z, blockId) {
    if (!this.containsLocal(x, y, z)) return false;
    this.blocks[this.#index(x, y, z)] = blockId;
    this.dirty = true;
    return true;
  }

  fill(blockId) {
    this.blocks.fill(blockId);
    this.dirty = true;
  }

  /**
   * Recorre solo los bloques distintos de aire.
   * @param {(x:number, y:number, z:number, blockId:number) => void} visit coordenadas locales
   */
  forEachSolid(visit) {
    for (let y = 0; y < this.height; y += 1) {
      for (let z = 0; z < this.sizeZ; z += 1) {
        for (let x = 0; x < this.sizeX; x += 1) {
          const blockId = this.blocks[this.#index(x, y, z)];
          if (blockId !== BlockIds.AIR) visit(x, y, z, blockId);
        }
      }
    }
  }
}
