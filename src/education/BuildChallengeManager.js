import { BlockIds } from '../utils/Constants.js';
import { GameEventTypes } from '../game/GameEvents.js';
import { createBuildPresets } from './BuildPresets.js';

/**
 * Gestor de Desafíos de Construcción Guiada por Presets (Modo Educativo).
 * - Expone `blueprints()` y `activeChallenge()` compatibles con EducationKnowledge (ChatBot) y el HUD.
 * - Calcula el progreso en tiempo real frente al mundo 3D (World).
 * - Identifica el próximo bloque a colocar (`nextBlock`) con sus sílabas y coordenadas 3D.
 * - Equipa los materiales requeridos en la Hotbar al iniciar un plano.
 */
export class BuildChallengeManager {
  #world;
  #player;
  #hotbar;
  #blockRegistry;
  #events;
  #presets;
  #active = null;
  #listeners = new Set();

  /**
   * @param {Object} options
   * @param {import('../world/World.js').World} [options.world]
   * @param {import('../player/Player.js').Player} [options.player]
   * @param {import('../inventory/Hotbar.js').Hotbar} [options.hotbar]
   * @param {import('../blocks/BlockRegistry.js').BlockRegistry} [options.blockRegistry]
   * @param {import('../game/GameEvents.js').GameEvents} [options.events]
   * @param {ReadonlyArray<Object>} [options.presets]
   */
  constructor({
    world = null,
    player = null,
    hotbar = null,
    blockRegistry = null,
    events = null,
    presets = null
  } = {}) {
    this.#world = world;
    this.#player = player;
    this.#hotbar = hotbar;
    this.#blockRegistry = blockRegistry ?? world?.blockRegistry ?? null;
    this.#events = events;
    this.#presets = presets ?? createBuildPresets(this.#blockRegistry);

    this.#bindEvents();
  }

  #bindEvents() {
    if (!this.#events) return;
    this.#events.on(GameEventTypes.BLOCK_PLACED, () => {
      if (this.#active) this.evaluateProgress();
    });
    this.#events.on(GameEventTypes.BLOCK_BROKEN, () => {
      if (this.#active) this.evaluateProgress();
    });
  }

  /**
   * Lista de todos los planos de construcción disponibles.
   * Contrato esperado por EducationKnowledge (`game.buildChallenge.blueprints()`).
   * @returns {ReadonlyArray<Object>}
   */
  blueprints() {
    return this.#presets;
  }

  /**
   * Busca un plano por su id o nombre.
   * @param {string} idOrName
   * @returns {Object|null}
   */
  getBlueprint(idOrName) {
    if (!idOrName) return null;
    const query = String(idOrName).trim().toLowerCase();
    return this.#presets.find(
      (p) => p.id.toLowerCase() === query || p.name.toLowerCase() === query
    ) ?? null;
  }

  /**
   * Estado vivo del desafío activo o `null` si no hay desafío en curso.
   * Contrato esperado por EducationKnowledge (`game.buildChallenge.activeChallenge()`).
   * @returns {Object|null}
   */
  activeChallenge() {
    if (!this.#active) return null;
    return this.#buildActiveSnapshot();
  }

  /** Alias para compatibilidad con distintos consumidores. */
  active() {
    return this.activeChallenge();
  }

  /**
   * Inicia un desafío de construcción guiada para el plano indicado.
   * @param {string|Object} presetOrId
   * @param {Object} [options]
   * @param {{x:number,y:number,z:number}} [options.anchor]
   * @param {boolean} [options.prepareArea=true]
   * @param {boolean} [options.autoEquip=true]
   * @returns {Object|null} Snapshot del desafío iniciado
   */
  startChallenge(presetOrId, options = {}) {
    const blueprint = typeof presetOrId === 'object' && presetOrId !== null
      ? this.getBlueprint(presetOrId.id || presetOrId.name) ?? presetOrId
      : this.getBlueprint(presetOrId);

    if (!blueprint) return null;

    const anchor = options.anchor ?? this.#computeDefaultAnchor();

    if (options.prepareArea !== false && this.#world) {
      this.#prepareBuildArea(blueprint, anchor);
    }

    if (options.autoEquip !== false && this.#hotbar) {
      this.equipBlueprintMaterials(blueprint);
    }

    this.#active = {
      blueprint,
      anchor: { ...anchor },
      completed: false,
      startedAt: Date.now()
    };

    const snapshot = this.#buildActiveSnapshot();
    this.#notify(snapshot, 'started');
    return snapshot;
  }

  /**
   * Cancela el desafío activo.
   */
  cancelChallenge() {
    if (!this.#active) return;
    this.#active = null;
    this.#notify(null, 'cancelled');
  }

  /**
   * Equipa los materiales requeridos por el plano en las primeras ranuras de la hotbar.
   * @param {Object} [blueprint]
   */
  equipBlueprintMaterials(blueprint = this.#active?.blueprint) {
    if (!blueprint || !this.#hotbar || !this.#blockRegistry) return;

    blueprint.materials.forEach((mat, index) => {
      if (index >= this.#hotbar.size) return;
      const blockType = this.#blockRegistry.get(mat.blockId);
      const count = Math.max(64, mat.count);
      this.#hotbar.set(index, blockType, count);
    });
    this.#hotbar.select(0);
  }

  /**
   * Coloca automáticamente el próximo bloque pendiente del desafío (útil para demostración / ayuda).
   * @returns {Object|null} Snapshot actualizado
   */
  placeNextStep() {
    if (!this.#active || !this.#world) return null;
    const snapshot = this.#buildActiveSnapshot();
    if (!snapshot?.nextBlock?.position) return snapshot;

    const { position, blockId } = snapshot.nextBlock;
    if (this.#world.isInsideBounds(position.x, position.y, position.z)) {
      this.#world.setBlockId(position.x, position.y, position.z, blockId);
    }
    return this.evaluateProgress();
  }

  /**
   * Evalúa el progreso actual del plano frente a los bloques colocados en el mundo.
   * @returns {Object|null}
   */
  evaluateProgress() {
    if (!this.#active) return null;
    const wasCompleted = this.#active.completed;
    const snapshot = this.#buildActiveSnapshot();

    if (snapshot.completed && !wasCompleted) {
      this.#active.completed = true;
      this.#notify(snapshot, 'completed');
    } else {
      this.#notify(snapshot, 'updated');
    }
    return snapshot;
  }

  /**
   * Suscribe un listener a los cambios del desafío activo.
   * @param {(snapshot: Object|null, reason: string) => void} listener
   * @returns {() => boolean}
   */
  onChange(listener) {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  #notify(snapshot, reason) {
    if (this.#events) {
      this.#events.emit(GameEventTypes.BUILD_CHALLENGE_CHANGED ?? 'buildChallengeChanged', {
        challenge: snapshot,
        reason
      });
    }
    for (const listener of this.#listeners) {
      try {
        listener(snapshot, reason);
      } catch {
        // Ignorar errores en listeners de UI
      }
    }
  }

  #computeDefaultAnchor() {
    if (!this.#world) {
      return { x: 16, y: 6, z: 16 };
    }

    let baseX = Math.floor(this.#world.width / 2);
    let baseZ = Math.floor(this.#world.depth / 2) - 4;

    if (this.#player?.position) {
      const playerBlock = this.#world.worldToBlock(
        this.#player.position.x,
        this.#player.position.y,
        this.#player.position.z
      );
      baseX = playerBlock.x;
      baseZ = playerBlock.z - 4;
    }

    // Asegurar margen dentro de los límites del mundo para estructuras 3x3
    const clampedX = Math.max(2, Math.min(this.#world.width - 3, baseX));
    const clampedZ = Math.max(2, Math.min(this.#world.depth - 3, baseZ));
    const surfaceY = typeof this.#world.getSurfaceHeight === 'function'
      ? this.#world.getSurfaceHeight(clampedX, clampedZ)
      : 6;
    const clampedY = Math.max(1, Math.min(this.#world.height - 5, surfaceY));

    return { x: clampedX, y: clampedY, z: clampedZ };
  }

  #prepareBuildArea(blueprint, anchor) {
    // Limpiar el volumen de construcción y asegurar piso firme debajo (anchor.y - 1)
    for (let dx = -1; dx <= 1; dx++) {
      for (let dz = -1; dz <= 1; dz++) {
        const wx = anchor.x + dx;
        const wz = anchor.z + dz;
        const floorY = anchor.y - 1;
        if (floorY >= 0 && this.#world.isInsideBounds(wx, floorY, wz)) {
          if (this.#world.getBlockId(wx, floorY, wz) === BlockIds.AIR) {
            this.#world.setBlockId(wx, floorY, wz, BlockIds.GRASS);
          }
        }
        for (let dy = 0; dy < 4; dy++) {
          const wy = anchor.y + dy;
          if (this.#world.isInsideBounds(wx, wy, wz)) {
            this.#world.setBlockId(wx, wy, wz, BlockIds.AIR);
          }
        }
      }
    }
  }

  #buildActiveSnapshot() {
    const { blueprint, anchor } = this.#active;
    const totalBlocks = blueprint.blocks.length;
    let placedBlocks = 0;
    let nextStep = null;

    const placedByMaterial = new Map();
    const pendingPositions = [];

    for (const step of blueprint.blocks) {
      const x = anchor.x + step.dx;
      const y = anchor.y + step.dy;
      const z = anchor.z + step.dz;

      const currentId = this.#world && this.#world.isInsideBounds(x, y, z)
        ? this.#world.getBlockId(x, y, z)
        : BlockIds.AIR;

      if (currentId === step.blockId) {
        placedBlocks += 1;
        placedByMaterial.set(step.blockId, (placedByMaterial.get(step.blockId) ?? 0) + 1);
      } else {
        const isNext = nextStep === null;
        if (isNext) {
          nextStep = { x, y, z, blockId: step.blockId };
        }
        pendingPositions.push({
          x,
          y,
          z,
          blockId: step.blockId,
          isNext
        });
      }
    }

    const materials = blueprint.materials.map((mat) => {
      const placed = placedByMaterial.get(mat.blockId) ?? 0;
      const remaining = Math.max(0, mat.count - placed);
      return {
        ...mat,
        placed,
        remaining
      };
    });

    let nextBlock = null;
    if (nextStep) {
      const matInfo = materials.find((m) => m.blockId === nextStep.blockId);
      const blockType = this.#blockRegistry?.get?.(nextStep.blockId) ?? matInfo;
      nextBlock = {
        blockId: nextStep.blockId,
        name: blockType?.name ?? matInfo?.name ?? 'Block',
        label: blockType?.label ?? matInfo?.label ?? 'Bloque',
        syllables: blockType?.syllables ?? matInfo?.syllables ?? ['BLO', 'QUE'],
        syllableText: blockType?.syllableText ?? matInfo?.syllableText ?? 'BLO - QUE',
        texture: blockType?.textures?.top || blockType?.texture || matInfo?.texture || null,
        color: blockType?.color ?? matInfo?.color ?? [180, 180, 180],
        count: matInfo?.remaining ?? 1,
        remaining: matInfo?.remaining ?? 1,
        position: { x: nextStep.x, y: nextStep.y, z: nextStep.z }
      };
    }

    const completed = totalBlocks > 0 && placedBlocks >= totalBlocks;
    const progress = totalBlocks > 0 ? placedBlocks / totalBlocks : 1;

    return {
      id: blueprint.id,
      name: blueprint.name,
      description: blueprint.description,
      difficulty: blueprint.difficulty,
      blueprint,
      anchor: { ...anchor },
      totalBlocks,
      placedBlocks,
      remainingBlocks: Math.max(0, totalBlocks - placedBlocks),
      progress,
      completed,
      materials,
      nextBlock,
      pendingPositions
    };
  }
}

