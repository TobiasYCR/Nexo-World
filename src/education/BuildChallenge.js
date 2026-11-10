import { GameConfig } from '../game/GameConfig.js';
import { GameEventTypes } from '../game/GameEvents.js';
import { BlockIds } from '../utils/Constants.js';
import { MathUtils } from '../utils/MathUtils.js';
import { VectorUtils } from '../utils/VectorUtils.js';
import { BuildSiteFinder } from './BuildSiteFinder.js';

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
    this.siteFinder = new BuildSiteFinder({
      searchRadius: config.SITE_SEARCH_RADIUS_BLOCKS,
      maxUnevenness: config.SITE_MAX_UNEVENNESS,
      playerClearance: config.SITE_PLAYER_CLEARANCE
    });

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
      blocks: placement.blocks
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
        stage: block.stage,
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

  /**
   * Lo mínimo para retomar el desafío al cargar la partida: qué plano, dónde y
   * girado cómo. El progreso no se guarda: sale de los bloques del mundo.
   * @returns {{blueprintId:string, rotation:number, anchor:{x:number,y:number,z:number}}|null}
   */
  exportState() {
    if (!this.#active) return null;
    return { blueprintId: this.#active.blueprint.id, rotation: this.#active.rotation, anchor: { ...this.#active.anchor } };
  }

  /**
   * Retoma un desafío guardado con exportState(). Si el plano ya no existe o no
   * entra en el mundo, no se retoma y la partida carga igual.
   * @returns {{ok:boolean, reason?:string, snapshot?:object}}
   */
  restoreState(state) {
    if (this.#active) this.#cancelActive(true);
    if (!state) return { ok: false, reason: 'noState' };
    let blueprint;
    try {
      blueprint = this.blueprintRegistry.get(state.blueprintId);
    } catch {
      return { ok: false, reason: 'unknownBlueprint' };
    }
    const { anchor, rotation } = state;
    if (!Number.isInteger(rotation) || !anchor || ![anchor.x, anchor.y, anchor.z].every(Number.isInteger)) {
      return { ok: false, reason: 'invalidState' };
    }
    const blocks = blueprint.rotated(rotation).map((block) => ({
      x: anchor.x + block.x,
      y: anchor.y + block.y,
      z: anchor.z + block.z,
      blockId: block.blockId,
      stage: block.stage
    }));
    if (!blocks.every((block) => this.world.isInsideBounds(block.x, block.y, block.z))) {
      return { ok: false, reason: 'outOfBounds' };
    }

    this.#active = { blueprint, rotation, anchor: { ...anchor }, blocks };
    const snapshot = this.snapshot();
    // Un plano que ya estaba terminado no se retoma ni se vuelve a festejar.
    if (snapshot.completed) {
      this.#active = null;
      return { ok: false, reason: 'alreadyCompleted' };
    }
    this.#emit(GameEventTypes.BUILD_CHALLENGE_STARTED, { snapshot });
    this.#emit(GameEventTypes.BUILD_CHALLENGE_PROGRESS, { snapshot });
    return { ok: true, snapshot };
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
    // Un plano grande se aleja lo necesario para no quedar encima del jugador.
    const depthAhead = Math.abs(Math.round(forward.x)) === 1 ? size.x : size.z;
    const distance = Math.max(
      this.config.PLACEMENT_DISTANCE_BLOCKS,
      Math.floor(depthAhead / 2) + (this.config.SITE_PLAYER_CLEARANCE ?? 1) + 1
    );
    const centerX = playerBlock.x + Math.round(forward.x * distance);
    const centerZ = playerBlock.z + Math.round(forward.z * distance);

    if (!this.world.isInsideBounds(centerX, 0, centerZ)) {
      return { ok: false, reason: 'outOfBounds', message: 'El plano no entra en el mundo.' };
    }

    // Se apoya en el suelo llano y despejado más cercano al punto de adelante:
    // nunca arriba de un árbol ni en una ladera.
    const anchor = this.siteFinder.find(
      this.world,
      { x: centerX, z: centerZ },
      size,
      { x: playerBlock.x, z: playerBlock.z }
    );
    if (!anchor) {
      return {
        ok: false,
        reason: 'noFlatSite',
        message: 'No hay terreno llano y despejado cerca. Probá en una zona sin árboles ni desniveles.'
      };
    }

    const placedBlocks = blocks.map((block) => ({
      x: anchor.x + block.x,
      y: anchor.y + block.y,
      z: anchor.z + block.z,
      blockId: block.blockId,
      stage: block.stage
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

  /**
   * Al completarse, el desafío termina: se festeja una vez y se descarta. Si
   * después se rompe un bloque de la construcción, no vuelve a aparecer.
   */
  #emitProgress(snapshot) {
    this.#emit(GameEventTypes.BUILD_CHALLENGE_PROGRESS, { snapshot });
    if (snapshot.completed) this.#finish(snapshot);
  }

  #finish(snapshot) {
    this.#active = null;
    this.#emit(GameEventTypes.BUILD_CHALLENGE_COMPLETED, { snapshot });
  }

  #cancelActive(emit, snapshot = this.snapshot()) {
    if (emit) this.#emit(GameEventTypes.BUILD_CHALLENGE_CANCELLED, { snapshot });
    this.#active = null;
  }

  #emit(event, payload) {
    this.events?.emit(event, payload);
  }

  /**
   * Orden en que se pide cada bloque: por etapa del plano (piso, columnas,
   * paredes, ventanas, techo), después de abajo hacia arriba y, dentro de una
   * misma altura, agrupado por material. Así no se alterna de material a cada
   * bloque.
   */
  static #byBuildOrder(first, second) {
    return (
      first.stage - second.stage ||
      first.y - second.y ||
      first.expectedBlockId - second.expectedBlockId ||
      first.z - second.z ||
      first.x - second.x
    );
  }
}
