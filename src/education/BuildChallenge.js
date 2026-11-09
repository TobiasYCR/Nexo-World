import { GameConfig } from '../game/GameConfig.js';
import { GameEventTypes } from '../game/GameEvents.js';
import { BlockIds } from '../utils/Constants.js';
import { MathUtils } from '../utils/MathUtils.js';
import { VectorUtils } from '../utils/VectorUtils.js';

/**
 * Reglas de un desafío activo. No conoce p5 ni la interfaz: solo ubica un
 * Blueprint, compara el mundo con sus celdas y emite cambios por GameEvents.
 */
export class BuildChallenge {
  #active = null;
  #unsubscribers = [];

  constructor({ world, player, camera, blueprintRegistry, blockRegistry, events, config = GameConfig.education } = {}) {
    if (!world || !player || !camera || !blueprintRegistry || !blockRegistry) {
      throw new TypeError('BuildChallenge requiere mundo, jugador, cámara y registros.');
    }
    this.world = world;
    this.player = player;
    this.camera = camera;
    this.blueprintRegistry = blueprintRegistry;
    this.blockRegistry = blockRegistry;
    this.events = events;
    this.config = config;

    this.#listen(GameEventTypes.BLOCK_PLACED);
    this.#listen(GameEventTypes.BLOCK_BROKEN);
  }

  /** Resúmenes públicos para la pantalla de selección de Gonzalo. */
  blueprints() {
    return this.blueprintRegistry.summaries();
  }

  /**
   * Inicia un único desafío. Si la ubicación falla, el desafío anterior se
   * conserva intacto; uno nuevo solo reemplaza al anterior cuando puede empezar.
   */
  start(blueprintId) {
    let blueprint;
    try {
      blueprint = this.blueprintRegistry.get(blueprintId);
    } catch (error) {
      return { ok: false, reason: 'unknownBlueprint', message: error.message };
    }

    const placement = this.#resolvePlacement(blueprint);
    if (!placement.ok) return placement;

    if (this.#active) this.#cancelActive(true);
    this.#active = {
      blueprint,
      rotation: placement.rotation,
      anchor: placement.anchor,
      blocks: placement.blocks,
      completedEmitted: false
    };

    const snapshot = this.snapshot();
    this.#emit(GameEventTypes.BUILD_CHALLENGE_STARTED, { snapshot });
    this.#emitProgress(snapshot);
    return { ok: true, blueprintId: blueprint.id, name: blueprint.name, snapshot };
  }

  cancel() {
    if (!this.#active) return { ok: false, reason: 'noActiveChallenge' };
    const snapshot = this.snapshot();
    this.#cancelActive(true, snapshot);
    return { ok: true, snapshot };
  }

  /** Snapshot estable para la UI y la guía 3D. Devuelve null sin desafío. */
  snapshot() {
    if (!this.#active) return null;

    const blocks = this.#active.blocks.map((block) => {
      const actualBlockId = this.world.getBlockId(block.x, block.y, block.z);
      const status = actualBlockId === block.blockId
        ? 'correct'
        : actualBlockId === BlockIds.AIR ? 'missing' : 'wrong';
      return {
        x: block.x,
        y: block.y,
        z: block.z,
        expectedBlockId: block.blockId,
        actualBlockId,
        status,
        blockId: block.blockId,
        name: this.blockRegistry.get(block.blockId).label
      };
    }).sort(BuildChallenge.#byBuildOrder);

    const placed = blocks.filter((block) => block.status === 'correct').length;
    const wrong = blocks.filter((block) => block.status === 'wrong').length;
    const next = blocks.find((block) => block.status !== 'correct') ?? null;
    const materials = this.#materials(blocks);
    const total = blocks.length;
    const completed = placed === total && wrong === 0;

    return {
      blueprintId: this.#active.blueprint.id,
      name: this.#active.blueprint.name,
      placed,
      total,
      progress: total === 0 ? 0 : placed / total,
      wrong,
      nextBlock: next ? {
        blockId: next.expectedBlockId,
        name: next.name,
        position: { x: next.x, y: next.y, z: next.z }
      } : null,
      materials,
      completed,
      rotation: this.#active.rotation,
      anchor: { ...this.#active.anchor },
      /** Datos adicionales para BlueprintGhost; la UI puede ignorarlos. */
      blocks
    };
  }

  /** Mismo dato que snapshot(); es el nombre que consulta el asistente de consultas. */
  activeChallenge() {
    return this.snapshot();
  }

  get isActive() {
    return this.#active !== null;
  }

  refresh() {
    if (!this.#active) return null;
    const snapshot = this.snapshot();
    this.#emitProgress(snapshot);
    return snapshot;
  }

  dispose() {
    for (const unsubscribe of this.#unsubscribers) unsubscribe();
    this.#unsubscribers = [];
    this.#active = null;
  }

  #resolvePlacement(blueprint) {
    const quarterTurns = MathUtils.mod(Math.round((this.camera.yaw ?? 0) / (Math.PI / 2)), 4);
    const blocks = blueprint.rotated(quarterTurns);
    const size = blueprint.rotatedSize(quarterTurns);
    const playerBlock = this.world.worldToBlock(
      this.player.position.x,
      this.player.position.y,
      this.player.position.z
    );
    const forward = VectorUtils.forwardFromYaw(quarterTurns * Math.PI / 2);
    const centerX = playerBlock.x + Math.round(forward.x * this.config.PLACEMENT_DISTANCE_BLOCKS);
    const centerZ = playerBlock.z + Math.round(forward.z * this.config.PLACEMENT_DISTANCE_BLOCKS);

    if (!this.world.isInsideBounds(centerX, 0, centerZ)) {
      return { ok: false, reason: 'outOfBounds', message: 'El plano no entra en el mundo.' };
    }

    const anchor = {
      x: centerX - Math.floor(size.x / 2),
      y: 0,
      z: centerZ - Math.floor(size.z / 2)
    };
    for (let z = 0; z < size.z; z += 1) {
      for (let x = 0; x < size.x; x += 1) {
        const worldX = anchor.x + x;
        const worldZ = anchor.z + z;
        if (!this.world.isInsideBounds(worldX, 0, worldZ)) {
          return { ok: false, reason: 'outOfBounds', message: 'El plano no entra en el mundo.' };
        }
      }
    }
    // La celda central define el suelo. Las demás celdas se validan como
    // parte del plano: si hay un árbol u otro bloque irrompible, el inicio se
    // rechaza en lugar de elevar silenciosamente toda la construcción.
    anchor.y = this.world.getSurfaceHeight(centerX, centerZ);

    const placedBlocks = blocks.map((block) => ({
      x: anchor.x + block.x,
      y: anchor.y + block.y,
      z: anchor.z + block.z,
      blockId: block.blockId
    }));

    for (const block of placedBlocks) {
      if (!this.world.isInsideBounds(block.x, block.y, block.z)) {
        return { ok: false, reason: 'outOfBounds', message: 'El plano no entra en el mundo.' };
      }
      const existing = this.world.getBlockType(block.x, block.y, block.z);
      if (existing.id !== BlockIds.AIR && !existing.isBreakable) {
        return {
          ok: false,
          reason: 'unbreakableCollision',
          message: `El plano choca con un bloque irrompible (${existing.label}).`
        };
      }
    }

    return { ok: true, rotation: quarterTurns, anchor, blocks: placedBlocks };
  }

  #materials(blocks) {
    const byId = new Map();
    for (const block of blocks) {
      const current = byId.get(block.expectedBlockId) ?? {
        blockId: block.expectedBlockId,
        name: block.name,
        required: 0,
        placed: 0
      };
      current.required += 1;
      if (block.status === 'correct') current.placed += 1;
      byId.set(block.expectedBlockId, current);
    }
    return [...byId.values()].sort((first, second) => first.blockId - second.blockId);
  }

  #listen(event) {
    const unsubscribe = this.events?.on?.(event, () => {
      if (this.#active) this.refresh();
    });
    if (typeof unsubscribe === 'function') this.#unsubscribers.push(unsubscribe);
  }

  #emitProgress(snapshot) {
    this.#emit(GameEventTypes.BUILD_CHALLENGE_PROGRESS, { snapshot });
    if (snapshot.completed && !this.#active.completedEmitted) {
      this.#active.completedEmitted = true;
      this.#emit(GameEventTypes.BUILD_CHALLENGE_COMPLETED, { snapshot });
    }
  }

  #cancelActive(emit, snapshot = this.snapshot()) {
    if (emit) this.#emit(GameEventTypes.BUILD_CHALLENGE_CANCELLED, { snapshot });
    this.#active = null;
  }

  #emit(event, payload) {
    this.events?.emit(event, payload);
  }

  static #byBuildOrder(first, second) {
    return first.y - second.y || first.z - second.z || first.x - second.x;
  }
}
