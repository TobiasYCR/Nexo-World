import { GameConfig } from '../game/GameConfig.js';
import { RenderQueue } from './RenderQueue.js';

/**
 * Dibuja los bloques del mundo. Es la ÚNICA clase que sabe cómo se ve un bloque.
 *
 * Contrato con World: solo consume forEachSolidBlock() e isBlockHidden(), así
 * que World no sabe nada de dibujado. El frame tiene dos fases:
 *   1. #collect: culling y agrupado por tipo en una RenderQueue.
 *   2. #drawQueue: un cambio de material por grupo y un box() por bloque.
 * Reemplazar box() por mallas por chunk implica cambiar solo la fase 2 (o esta
 * clase entera, manteniendo render()/renderedBlocks/setRenderDistance()).
 */
export class BlockRenderer {
  static MIN_RENDER_DISTANCE = 1;

  #renderedBlocks = 0;
  #renderDistance;
  #queue = new RenderQueue();

  constructor(p, blockRegistry, textureManager, config = GameConfig) {
    this.p = p;
    this.blockRegistry = blockRegistry;
    this.textures = textureManager;
    this.blockSize = config.world.BLOCK_SIZE;
    this.setRenderDistance(config.rendering.RENDER_DISTANCE);
  }

  get renderedBlocks() {
    return this.#renderedBlocks;
  }

  /** Radio de dibujado en bloques. */
  get renderDistance() {
    return this.#renderDistance;
  }

  /**
   * Ajustable en caliente (pantalla de Configuración): rige desde el próximo frame.
   * @param {number} blocks radio en bloques; se redondea y se acota a >= 1
   * @returns {number} el valor efectivo aplicado
   */
  setRenderDistance(blocks) {
    if (Number.isFinite(blocks)) {
      this.#renderDistance = Math.max(BlockRenderer.MIN_RENDER_DISTANCE, Math.round(blocks));
    }
    return this.#renderDistance;
  }

  /**
   * @param {import('../world/World.js').World} world
   * @param {{x:number,y:number,z:number}} viewerPosition posición en coordenadas de mundo
   */
  render(world, viewerPosition) {
    this.#collect(world, viewerPosition);
    this.#drawQueue();
    this.#renderedBlocks = this.#queue.size;
  }

  /**
   * Culling por distancia horizontal contra el centro de cada bloque, medida
   * desde la posición continua del jugador: el conteo varía de a poco al
   * caminar en vez de saltar al cruzar el borde de un bloque.
   */
  #collect(world, viewerPosition) {
    const queue = this.#queue;
    queue.clear();

    const viewerX = viewerPosition.x / this.blockSize - 0.5;
    const viewerZ = viewerPosition.z / this.blockSize - 0.5;
    const maxDistanceSq = this.#renderDistance * this.#renderDistance;

    world.forEachSolidBlock((x, y, z, blockId) => {
      const dx = x - viewerX;
      const dz = z - viewerZ;
      if (dx * dx + dz * dz > maxDistanceSq) return;
      if (world.isBlockHidden(x, y, z)) return;
      queue.push(blockId, x, y, z);
    });
  }

  /**
   * Dentro de un grupo se encadenan translate() relativos en vez de un
   * push()/pop() por bloque: el material queda fijo para todo el grupo.
   */
  #drawQueue() {
    const p = this.p;
    const size = this.blockSize;
    const half = size / 2;

    p.push();
    p.noStroke();

    this.#queue.forEachGroup((blockId, positions) => {
      p.push();
      this.#applyMaterial(this.blockRegistry.get(blockId));

      let currentX = 0;
      let currentY = 0;
      let currentZ = 0;
      for (let index = 0; index < positions.length; index += 3) {
        const targetX = positions[index] * size + half;
        const targetY = positions[index + 1] * size + half;
        const targetZ = positions[index + 2] * size + half;
        p.translate(targetX - currentX, targetY - currentY, targetZ - currentZ);
        currentX = targetX;
        currentY = targetY;
        currentZ = targetZ;
        p.box(size);
      }

      p.pop();
    });

    p.pop();
  }

  #applyMaterial(blockType) {
    const texture = blockType.texture ? this.textures.get(blockType.texture) : null;
    if (texture) {
      this.p.texture(texture);
    } else {
      // fill es el color difuso en WEBGL: sin él la luz direccional lava el color a blanco.
      this.p.fill(...blockType.color);
      this.p.ambientMaterial(...blockType.color);
    }
  }
}
