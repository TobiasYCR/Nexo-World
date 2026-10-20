import { BlockIds } from '../utils/Constants.js';

/**
 * Foto inmutable del mundo tal como lo dejó el generador, antes de cualquier
 * cambio del jugador. Como la generación es determinista, la misma semilla y
 * configuración producen siempre la misma foto, tanto en el juego como en el
 * servidor que valida puntuaciones.
 *
 * Responde dos preguntas: qué bloque había originalmente en una celda y qué
 * bioma tiene cada columna. Con eso las reglas de progresión distinguen un
 * mineral natural de uno colocado por el jugador.
 */
export class NaturalTerrain {
  #chunks = new Map();
  #biomeIds;

  /**
   * @param {import('./World.js').World} world mundo recién generado
   * @param {Uint8Array} biomeIds bioma por columna, indexado por z * width + x
   */
  constructor(world, biomeIds) {
    this.width = world.width;
    this.height = world.height;
    this.depth = world.depth;
    this.chunkSizeX = world.chunkSizeX;
    this.chunkSizeZ = world.chunkSizeZ;
    if (biomeIds.length !== world.width * world.depth) {
      throw new RangeError('NaturalTerrain: el mapa de biomas no coincide con el tamaño del mundo.');
    }
    this.#biomeIds = Uint8Array.from(biomeIds);
    for (const chunk of world.chunks) {
      this.#chunks.set(`${chunk.chunkX},${chunk.chunkZ}`, Uint8Array.from(chunk.blocks));
    }
    Object.freeze(this);
  }

  /** Atajo para el caso habitual: generar y fotografiar en un paso. */
  static fromGeneration(world, generator) {
    return new NaturalTerrain(world, generator.planSurface(world).biomeIds);
  }

  get cellCount() {
    return this.width * this.height * this.depth;
  }

  isInsideBounds(x, y, z) {
    return x >= 0 && x < this.width && y >= 0 && y < this.height && z >= 0 && z < this.depth;
  }

  /** Bloque original de la celda; aire fuera del mundo. */
  blockIdAt(x, y, z) {
    if (!this.isInsideBounds(x, y, z)) return BlockIds.AIR;
    const blocks = this.#chunks.get(`${Math.floor(x / this.chunkSizeX)},${Math.floor(z / this.chunkSizeZ)}`);
    if (!blocks) return BlockIds.AIR;
    const localX = x % this.chunkSizeX;
    const localZ = z % this.chunkSizeZ;
    // Mismo orden de índice que Chunk: (y * sizeZ + z) * sizeX + x.
    return blocks[(y * this.chunkSizeZ + localZ) * this.chunkSizeX + localX];
  }

  /** Índice lineal estable de una celda, usado para registrar posiciones de forma compacta. */
  indexOf(x, y, z) {
    return (y * this.depth + z) * this.width + x;
  }

  positionOf(index) {
    const x = index % this.width;
    const z = Math.floor(index / this.width) % this.depth;
    const y = Math.floor(index / (this.width * this.depth));
    return { x, y, z };
  }

  /** Bioma de la columna, o -1 fuera del mundo. */
  biomeIdAt(x, z) {
    if (x < 0 || z < 0 || x >= this.width || z >= this.depth) return -1;
    return this.#biomeIds[z * this.width + x];
  }

  /** Biomas presentes en el mundo. */
  biomeIds() {
    return new Set(this.#biomeIds);
  }
}
