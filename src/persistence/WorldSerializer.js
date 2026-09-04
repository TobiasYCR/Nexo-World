/**
 * Convierte un World a una estructura plana serializable y viceversa.
 * Separado de SaveManager para que el formato de datos sea independiente del
 * medio de almacenamiento (localStorage hoy, backend a futuro).
 *
 * Estado actual: base arquitectónica. El formato puede cambiar antes de que
 * exista guardado real, por eso se versiona desde el principio.
 */
export class WorldSerializer {
  static FORMAT_VERSION = 1;

  serialize(world) {
    const chunks = [];
    for (const chunk of world.chunks) {
      chunks.push({
        chunkX: chunk.chunkX,
        chunkZ: chunk.chunkZ,
        blocks: Array.from(chunk.blocks)
      });
    }

    return {
      version: WorldSerializer.FORMAT_VERSION,
      dimensions: { width: world.width, height: world.height, depth: world.depth },
      chunks
    };
  }

  deserialize(world, data) {
    if (data?.version !== WorldSerializer.FORMAT_VERSION) {
      throw new Error(`Formato de mundo incompatible: ${data?.version}.`);
    }

    world.clear();
    for (const chunkData of data.chunks) {
      const originX = chunkData.chunkX * world.chunkSizeX;
      const originZ = chunkData.chunkZ * world.chunkSizeZ;
      let index = 0;
      for (let y = 0; y < world.height; y += 1) {
        for (let z = 0; z < world.chunkSizeZ; z += 1) {
          for (let x = 0; x < world.chunkSizeX; x += 1) {
            const blockId = chunkData.blocks[index];
            index += 1;
            if (blockId !== 0) world.setBlockId(originX + x, y, originZ + z, blockId);
          }
        }
      }
    }

    return world;
  }
}
