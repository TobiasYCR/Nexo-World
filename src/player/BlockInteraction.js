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
  #breakingElapsed = 0;
  #listeners = new Map();

  constructor(world, player, hotbar, raycast, config = GameConfig) {
    this.world = world;
    this.player = player;
    this.hotbar = hotbar;
    this.raycast = raycast;
    this.config = config;
    this.hit = null;
    this.breakingBlock = null;
    this.breakProgress = 0;
  }

  /** Bloque apuntado este frame, para que el renderer pueda resaltarlo. */
  get targetedBlock() {
    return this.hit?.block ?? null;
  }

  /** Refresca la mira. Game la llama cada frame con ojo del jugador y cámara. */
  update(origin, direction) {
    this.hit = this.raycast.cast(origin, direction, this.config.blocks.REACH_DISTANCE);
    if (!this.#sameBlock(this.breakingBlock, this.targetedBlock)) this.#resetBreaking();
  }

  on(event, listener) {
    if (!this.#listeners.has(event)) this.#listeners.set(event, new Set());
    this.#listeners.get(event).add(listener);
    return () => this.#listeners.get(event)?.delete(listener);
  }

  /** Acumula el progreso de rotura mientras se mantiene pulsado sobre el mismo bloque. */
  updateBreaking(deltaTime, isHeld) {
    const block = this.targetedBlock;
    const type = block ? this.world.getBlockType(block.x, block.y, block.z) : null;
    if (!isHeld || !block || !type?.breakable) {
      this.#resetBreaking();
      return false;
    }

    if (!this.#sameBlock(this.breakingBlock, block)) {
      this.#resetBreaking();
      this.breakingBlock = { x: block.x, y: block.y, z: block.z };
    }

    this.#breakingElapsed += deltaTime;
    const duration = Math.max(
      Number.EPSILON,
      type.hardness * this.config.viewmodel.breakOverlay.BREAK_DURATION_PER_HARDNESS
    );
    this.breakProgress = Math.min(1, this.#breakingElapsed / duration);
    if (this.breakProgress < 1) return false;

    this.tryBreak();
    this.#resetBreaking();
    return true;
  }

  /** Rompe el bloque apuntado (si es rompible) y lo agrega al hotbar. */
  tryBreak() {
    const hit = this.hit;
    if (!hit) return false;

    const type = this.world.getBlockType(hit.block.x, hit.block.y, hit.block.z);
    if (!type.breakable) return false;

    this.world.setBlockId(hit.block.x, hit.block.y, hit.block.z, BlockIds.AIR);
    this.hotbar.add(type);
    this.#emit('blockBroken', {
      position: { x: hit.block.x, y: hit.block.y, z: hit.block.z },
      blockType: type
    });
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
    this.#emit('blockPlaced', {
      position: { x: adjacent.x, y: adjacent.y, z: adjacent.z },
      blockType
    });
    return true;
  }

  #emit(event, payload) {
    for (const listener of this.#listeners.get(event) ?? []) listener(payload);
  }

  #resetBreaking() {
    this.breakingBlock = null;
    this.breakProgress = 0;
    this.#breakingElapsed = 0;
  }

  #sameBlock(first, second) {
    return first === second || (
      first !== null &&
      second !== null &&
      first.x === second.x &&
      first.y === second.y &&
      first.z === second.z
    );
  }

  /** True si la celda de bloque se superpone con la caja de colisión del jugador. */
  #boxIntersectsBlock(x, y, z) {
    const blockBox = AABB.fromBlock(x, y, z, this.world.blockSize);
    return this.player.boundingBox.intersects(blockBox);
  }
}