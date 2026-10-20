import { AABB } from '../physics/AABB.js';
import { GameConfig } from '../game/GameConfig.js';
import { BlockIds } from '../utils/Constants.js';
import { BlockBreaker } from './BlockBreaker.js';
import { GameEventTypes } from '../game/GameEvents.js';

/**
 * Romper y colocar bloques. Aislada de Player y Game a propósito: el jugador
 * no sabe qué catálogo de bloques existe y Game solo orquesta.
 *
 * La autoridad de propiedades por bloque (breakable, solid) sale del registro:
 * acá nunca se compara ids a mano.
 */
export class BlockInteraction {
  #listeners = new Map();

  constructor(world, player, hotbar, raycast, config = GameConfig, events = null) {
    this.world = world;
    this.player = player;
    this.hotbar = hotbar;
    this.raycast = raycast;
    this.config = config;
    this.events = events;
    this.breaker = new BlockBreaker(world, config);
    this.hit = null;
  }

  get breakingBlock() {
    return this.breaker.breakingBlock;
  }

  get breakProgress() {
    return this.breaker.breakProgress;
  }

  /** Bloque apuntado este frame, para que el renderer pueda resaltarlo. */
  get targetedBlock() {
    return this.hit?.block ?? null;
  }

  /** Refresca la mira. Game la llama cada frame con ojo del jugador y cámara. */
  update(origin, direction) {
    this.hit = this.raycast.cast(origin, direction, this.config.blocks.REACH_DISTANCE);
    if (!this.#sameBlock(this.breakingBlock, this.targetedBlock)) this.breaker.reset();
  }

  on(event, listener) {
    if (!this.#listeners.has(event)) this.#listeners.set(event, new Set());
    this.#listeners.get(event).add(listener);
    return () => this.#listeners.get(event)?.delete(listener);
  }

  /** Acumula el progreso de rotura mientras se mantiene pulsado sobre el mismo bloque. */
  updateBreaking(deltaTime, isHeld) {
    const completed = this.breaker.update(this.targetedBlock, deltaTime, isHeld);
    this.#emit(GameEventTypes.BREAK_PROGRESS, {
      position: this.breakingBlock,
      progress: this.breakProgress
    });
    if (!completed) return false;

    this.tryBreak();
    this.breaker.reset();
    return true;
  }

  /** Rompe el bloque apuntado (si es rompible) y lo agrega al hotbar. */
  tryBreak() {
    const hit = this.hit;
    if (!hit) return false;

    const type = this.world.getBlockType(hit.block.x, hit.block.y, hit.block.z);
    if (!type.breakable) return false;

    this.world.setBlockId(hit.block.x, hit.block.y, hit.block.z, BlockIds.AIR);
    for (const dropId of type.drops) this.hotbar.add(this.world.blockRegistry.get(dropId));
    this.#emit(GameEventTypes.BLOCK_BROKEN, {
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
    this.#emit(GameEventTypes.BLOCK_PLACED, {
      position: { x: adjacent.x, y: adjacent.y, z: adjacent.z },
      blockType,
      face: { ...hit.face }
    });
    return true;
  }

  #emit(event, payload) {
    this.events?.emit(event, payload);
    for (const listener of this.#listeners.get(event) ?? []) listener(payload);
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
