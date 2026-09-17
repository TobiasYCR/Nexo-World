import { Chunk } from './Chunk.js';
import { Block } from '../blocks/Block.js';
import { BlockIds } from '../utils/Constants.js';
import { MathUtils } from '../utils/MathUtils.js';
import { GameConfig } from '../game/GameConfig.js';

/**
 * Contenedor y autoridad de los datos del mundo. Expone coordenadas GLOBALES de
 * bloque y resuelve internamente a qué chunk pertenecen.
 *
 * World no sabe nada de cómo se dibujan los bloques: solo almacena y consulta.
 * Esa separación permite reemplazar BlockRenderer sin tocar esta clase.
 */
export class World {
  #chunks = new Map();

  constructor(blockRegistry, config = GameConfig) {
    this.blockRegistry = blockRegistry;
    this.blockSize = config.world.BLOCK_SIZE;
    this.width = config.world.WORLD_WIDTH;
    this.height = config.world.WORLD_HEIGHT;
    this.depth = config.world.WORLD_DEPTH;
    this.chunkSizeX = config.chunk.SIZE_X;
    this.chunkSizeZ = config.chunk.SIZE_Z;
  }

  get chunks() {
    return this.#chunks.values();
  }

  get chunkCount() {
    return this.#chunks.size;
  }

  isInsideBounds(x, y, z) {
    return x >= 0 && x < this.width && y >= 0 && y < this.height && z >= 0 && z < this.depth;
  }

  /** Devuelve el chunk que contiene la coordenada global, creándolo si hace falta. */
  #chunkAt(x, z, createIfMissing = false) {
    const chunkX = MathUtils.floorDiv(x, this.chunkSizeX);
    const chunkZ = MathUtils.floorDiv(z, this.chunkSizeZ);
    const key = Chunk.keyOf(chunkX, chunkZ);
    let chunk = this.#chunks.get(key);
    if (!chunk && createIfMissing) {
      chunk = new Chunk(chunkX, chunkZ, this.chunkSizeX, this.height, this.chunkSizeZ);
      this.#chunks.set(key, chunk);
    }
    return chunk;
  }

  getBlockId(x, y, z) {
    if (!this.isInsideBounds(x, y, z)) return BlockIds.AIR;
    const chunk = this.#chunkAt(x, z);
    if (!chunk) return BlockIds.AIR;
    return chunk.getBlock(
      MathUtils.mod(x, this.chunkSizeX),
      y,
      MathUtils.mod(z, this.chunkSizeZ)
    );
  }

  getBlockType(x, y, z) {
    return this.blockRegistry.get(this.getBlockId(x, y, z));
  }

  /** Bloque con contexto de posición, o null si es aire o está fuera del mundo. */
  getBlock(x, y, z) {
    const blockId = this.getBlockId(x, y, z);
    if (blockId === BlockIds.AIR) return null;
    return new Block(x, y, z, this.blockRegistry.get(blockId));
  }

  setBlockId(x, y, z, blockId) {
    if (!this.isInsideBounds(x, y, z)) return false;
    if (!this.blockRegistry.has(blockId)) {
      throw new RangeError(`No se puede colocar un bloque con id desconocido: ${blockId}.`);
    }
    // Escribir el mismo id no cambia nada: no se ensucia ni se materializa un chunk.
    if (this.getBlockId(x, y, z) === blockId) return true;

    const chunk = this.#chunkAt(x, z, true);
    const localX = MathUtils.mod(x, this.chunkSizeX);
    const localZ = MathUtils.mod(z, this.chunkSizeZ);
    if (!chunk.setBlock(localX, y, localZ, blockId)) return false;

    // Cambiar un bloque en el borde de un chunk altera las caras visibles del
    // vecino: hay que invalidar también su caché de geometría.
    if (x > 0 && localX === 0) this.#markExistingChunkDirty(x - 1, z);
    if (x < this.width - 1 && localX === this.chunkSizeX - 1) this.#markExistingChunkDirty(x + 1, z);
    if (z > 0 && localZ === 0) this.#markExistingChunkDirty(x, z - 1);
    if (z < this.depth - 1 && localZ === this.chunkSizeZ - 1) this.#markExistingChunkDirty(x, z + 1);
    return true;
  }

  /** Ensucia solo un chunk existente: marcar un vecino no debe materializarlo. */
  #markExistingChunkDirty(x, z) {
    const chunk = this.#chunkAt(x, z);
    if (chunk) chunk.markDirty();
  }

  /** Chunks con cambios pendientes, para que el renderer invalide su geometría. */
  dirtyChunks() {
    return [...this.#chunks.values()].filter((chunk) => chunk.isDirty);
  }

  isSolid(x, y, z) {
    return this.blockRegistry.isSolid(this.getBlockId(x, y, z));
  }

  /** Un bloque rodeado de bloques opacos no aporta nada visible y se puede descartar. */
  isBlockHidden(x, y, z) {
    return (
      this.blockRegistry.isOpaque(this.getBlockId(x + 1, y, z)) &&
      this.blockRegistry.isOpaque(this.getBlockId(x - 1, y, z)) &&
      this.blockRegistry.isOpaque(this.getBlockId(x, y + 1, z)) &&
      this.blockRegistry.isOpaque(this.getBlockId(x, y - 1, z)) &&
      this.blockRegistry.isOpaque(this.getBlockId(x, y, z + 1)) &&
      this.blockRegistry.isOpaque(this.getBlockId(x, y, z - 1))
    );
  }

  /** Altura del primer bloque de aire por encima del terreno, en coordenadas de bloque. */
  getSurfaceHeight(x, z) {
    for (let y = this.height - 1; y >= 0; y -= 1) {
      if (this.getBlockId(x, y, z) !== BlockIds.AIR) return y + 1;
    }
    return 0;
  }

  /** Conversión de coordenadas de mundo (unidades continuas) a grilla de bloques. */
  worldToBlock(worldX, worldY, worldZ) {
    return {
      x: Math.floor(worldX / this.blockSize),
      y: Math.floor(worldY / this.blockSize),
      z: Math.floor(worldZ / this.blockSize)
    };
  }

  /** Centro del bloque en coordenadas de mundo. */
  blockToWorld(x, y, z) {
    const half = this.blockSize / 2;
    return {
      x: x * this.blockSize + half,
      y: y * this.blockSize + half,
      z: z * this.blockSize + half
    };
  }

  /**
   * Recorre los bloques sólidos del mundo en coordenadas globales.
   * Es el único contrato que el renderizador necesita conocer.
   * @param {(x:number, y:number, z:number, blockId:number) => void} visit
   */
  forEachSolidBlock(visit) {
    for (const chunk of this.#chunks.values()) {
      const originX = chunk.chunkX * this.chunkSizeX;
      const originZ = chunk.chunkZ * this.chunkSizeZ;
      chunk.forEachSolid((localX, y, localZ, blockId) => {
        visit(originX + localX, y, originZ + localZ, blockId);
      });
    }
  }

  clear() {
    this.#chunks.clear();
  }
}
