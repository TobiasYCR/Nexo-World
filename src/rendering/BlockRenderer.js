import { GameConfig } from '../game/GameConfig.js';

/**
 * Dibuja los bloques del mundo. Es la ÚNICA clase que sabe cómo se ve un bloque.
 *
 * Consume World a través de forEachSolidBlock(), por lo que puede reemplazarse
 * por una implementación con mallas fusionadas o instancing sin que World se
 * entere. Esta versión prioriza claridad: un box() por bloque visible.
 */
export class BlockRenderer {
  #renderedBlocks = 0;

  constructor(p, blockRegistry, textureManager, config = GameConfig) {
    this.p = p;
    this.blockRegistry = blockRegistry;
    this.textures = textureManager;
    this.blockSize = config.world.BLOCK_SIZE;
    this.renderDistance = config.rendering.RENDER_DISTANCE;
  }

  get renderedBlocks() {
    return this.#renderedBlocks;
  }

  /**
   * @param {import('../world/World.js').World} world
   * @param {{x:number,y:number,z:number}} viewerPosition posición en coordenadas de mundo
   */
  render(world, viewerPosition) {
    const p = this.p;
    this.#renderedBlocks = 0;

    const viewer = world.worldToBlock(viewerPosition.x, viewerPosition.y, viewerPosition.z);
    const maxDistanceSq = this.renderDistance * this.renderDistance;

    p.push();
    p.noStroke();

    world.forEachSolidBlock((x, y, z, blockId) => {
      if (BlockRenderer.#distanceSq(x, z, viewer) > maxDistanceSq) return;
      if (world.isBlockHidden(x, y, z)) return;
      this.#drawBlock(x, y, z, this.blockRegistry.get(blockId));
      this.#renderedBlocks += 1;
    });

    p.pop();
  }

  #drawBlock(x, y, z, blockType) {
    const p = this.p;
    const size = this.blockSize;
    const texture = blockType.texture ? this.textures.get(blockType.texture) : null;

    p.push();
    p.translate(x * size + size / 2, y * size + size / 2, z * size + size / 2);

    if (texture) {
      p.texture(texture);
    } else {
      p.ambientMaterial(...blockType.color);
    }

    p.box(size);
    p.pop();
  }

  /** Distancia horizontal: el recorte vertical no aporta con mundos bajos. */
  static #distanceSq(x, z, viewer) {
    const dx = x - viewer.x;
    const dz = z - viewer.z;
    return dx * dx + dz * dz;
  }
}
