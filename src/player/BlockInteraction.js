import { AABB } from '../physics/AABB.js';
import { GameConfig } from '../game/GameConfig.js';
import { BlockIds } from '../utils/Constants.js';

/**
 * Romper y colocar bloques. Aislada de Player y Game a propósito: el jugador
 * no sabe qué catálogo de bloques existe y Game solo orquesta.
 *
 * La autoridad de propiedades por bloque (breakable, solid) sale del registro:
 * acá nunca se compara ids a mano.
 */
export class BlockInteraction {
  constructor(world, player, hotbar, raycast, config = GameConfig) {
    this.world = world;
    this.player = player;
    this.hotbar = hotbar;
    this.raycast = raycast;
    this.config = config;
    this.hit = null;
  }

  /** Bloque apuntado este frame, para que el renderer pueda resaltarlo. */
  get targetedBlock() {
    return this.hit?.block ?? null;
  }

  /** Refresca la mira. Game la llama cada frame con ojo del jugador y cámara. */
  update(origin, direction) {
    this.hit = this.raycast.cast(origin, direction, this.config.blocks.REACH_DISTANCE);
  }

  /** Rompe el bloque apuntado (si es rompible) y lo agrega al hotbar. */
  tryBreak() {
    const hit = this.hit;
    if (!hit) return false;

    const type = this.world.getBlockType(hit.block.x, hit.block.y, hit.block.z);
    if (!type.breakable) return false;

    this.world.setBlockId(hit.block.x, hit.block.y, hit.block.z, BlockIds.AIR);
    this.hotbar.add(type);
    return true;
  }

  /**
   * Coloca el bloque seleccionado en la celda adyacente a la cara apuntada.
   * Rechaza destinos fuera del mundo, ocupados, o que se solapen con el jugador
   * (si no, quedarías encerrado dentro del bloque recién colocado).
   */
  tryPlace() {
    const hit = this.hit;
    if (!hit || !hit.face) return false;

    const adjacent = hit.adjacentPosition;
    if (!this.world.isInsideBounds(adjacent.x, adjacent.y, adjacent.z)) return false;
    if (this.world.isSolid(adjacent.x, adjacent.y, adjacent.z)) return false;

    const slot = this.hotbar.getSlot(this.hotbar.selectedIndex);
    if (!slot || slot.isEmpty) return false;
    if (this.#boxIntersectsBlock(adjacent.x, adjacent.y, adjacent.z)) return false;

    // El tipo se captura antes de consumir: removeAt lo despeja si era el último.
    const blockType = slot.blockType;
    if (this.hotbar.removeAt(this.hotbar.selectedIndex, 1) === 0) return false;
    this.world.setBlockId(adjacent.x, adjacent.y, adjacent.z, blockType.id);
    return true;
  }

  /** True si la celda de bloque se superpone con la caja de colisión del jugador. */
  #boxIntersectsBlock(x, y, z) {
    const blockBox = AABB.fromBlock(x, y, z, this.world.blockSize);
    return this.player.boundingBox.intersects(blockBox);
  }
}