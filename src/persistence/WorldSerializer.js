import { Base64Codec } from '../utils/Base64Codec.js';
import { BlockIds } from '../utils/Constants.js';
import { SaveResult } from './SaveResult.js';

/**
 * Convierte un World a una estructura plana serializable y viceversa.
 * Separado de SaveManager para que el formato sea independiente del medio de
 * almacenamiento.
 *
 * Formato v2: cada chunk guarda su Uint8Array en base64 (~1/3 del tamaño del
 * JSON numérico de v1). Los chunks totalmente de aire no se guardan.
 *
 * La carga es en dos fases: decode() valida y decodifica TODO sin tocar el
 * mundo; apply() recién entonces lo reemplaza. Un guardado dañado a la mitad
 * deja el mundo en memoria intacto.
 */
export class WorldSerializer {
  static FORMAT_VERSION = 2;

  serialize(world) {
    const chunks = [];
    for (const chunk of world.chunks) {
      if (chunk.blocks.every((blockId) => blockId === BlockIds.AIR)) continue;
      chunks.push({ x: chunk.chunkX, z: chunk.chunkZ, data: Base64Codec.encode(chunk.blocks) });
    }

    return {
      version: WorldSerializer.FORMAT_VERSION,
      dimensions: { width: world.width, height: world.height, depth: world.depth },
      chunkSize: { x: world.chunkSizeX, z: world.chunkSizeZ },
      chunks
    };
  }

  /**
   * Valida y decodifica sin efectos sobre el mundo.
   * @returns {{ok:boolean, reason:string|null, chunks?:{chunkX:number,chunkZ:number,blocks:Uint8Array}[]}}
   */
  decode(world, data) {
    const { Reasons } = SaveResult;
    if (!WorldSerializer.#isObject(data)) return SaveResult.fail(Reasons.CORRUPT_DATA, 'world no es un objeto');
    if (data.version !== WorldSerializer.FORMAT_VERSION) {
      return SaveResult.fail(Reasons.INCOMPATIBLE_VERSION, `formato de mundo v${data.version}, se esperaba v${WorldSerializer.FORMAT_VERSION}`);
    }

    const { dimensions, chunkSize } = data;
    if (!WorldSerializer.#isObject(dimensions) || !WorldSerializer.#isObject(chunkSize) || !Array.isArray(data.chunks)) {
      return SaveResult.fail(Reasons.CORRUPT_DATA, 'estructura de mundo incompleta');
    }
    if (
      dimensions.width !== world.width || dimensions.height !== world.height || dimensions.depth !== world.depth ||
      chunkSize.x !== world.chunkSizeX || chunkSize.z !== world.chunkSizeZ
    ) {
      return SaveResult.fail(Reasons.WORLD_MISMATCH, 'dimensiones o tamaño de chunk distintos');
    }

    const expectedLength = world.chunkSizeX * world.height * world.chunkSizeZ;
    const maxChunkX = Math.ceil(world.width / world.chunkSizeX);
    const maxChunkZ = Math.ceil(world.depth / world.chunkSizeZ);
    const knownIds = WorldSerializer.#knownIdTable(world.blockRegistry);
    const seen = new Set();
    const chunks = [];

    for (const [index, entry] of data.chunks.entries()) {
      const fail = (why) => SaveResult.fail(Reasons.CORRUPT_CHUNK, `chunk #${index}: ${why}`);
      if (!WorldSerializer.#isObject(entry)) return fail('no es un objeto');

      const { x, z } = entry;
      if (!Number.isInteger(x) || !Number.isInteger(z) || x < 0 || z < 0 || x >= maxChunkX || z >= maxChunkZ) {
        return fail('coordenadas inválidas');
      }
      const key = `${x},${z}`;
      if (seen.has(key)) return fail('chunk duplicado');
      seen.add(key);

      const blocks = Base64Codec.decode(entry.data);
      if (!blocks) return fail('base64 inválido');
      if (blocks.length !== expectedLength) return fail(`se esperaban ${expectedLength} bloques y hay ${blocks.length}`);
      for (const blockId of blocks) {
        if (!knownIds[blockId]) return fail(`id de bloque desconocido ${blockId}`);
      }

      chunks.push({ chunkX: x, chunkZ: z, blocks });
    }

    return SaveResult.ok({ chunks });
  }

  /** Reemplaza el contenido del mundo con chunks ya validados por decode(). */
  apply(world, decodedChunks) {
    world.clear();
    for (const { chunkX, chunkZ, blocks } of decodedChunks) {
      const originX = chunkX * world.chunkSizeX;
      const originZ = chunkZ * world.chunkSizeZ;
      let index = 0;
      // Mismo orden de índice que Chunk: (y * sizeZ + z) * sizeX + x.
      for (let y = 0; y < world.height; y += 1) {
        for (let z = 0; z < world.chunkSizeZ; z += 1) {
          for (let x = 0; x < world.chunkSizeX; x += 1) {
            const blockId = blocks[index];
            index += 1;
            if (blockId !== BlockIds.AIR) world.setBlockId(originX + x, y, originZ + z, blockId);
          }
        }
      }
    }
    return world;
  }

  /** decode() + apply(). Nunca lanza; si falla, el mundo no se toca. */
  deserialize(world, data) {
    const decoded = this.decode(world, data);
    if (!decoded.ok) return decoded;
    this.apply(world, decoded.chunks);
    return SaveResult.ok();
  }

  static #knownIdTable(blockRegistry) {
    const table = new Array(256).fill(false);
    for (let id = 0; id < table.length; id += 1) table[id] = blockRegistry.has(id);
    return table;
  }

  static #isObject(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
  }
}
