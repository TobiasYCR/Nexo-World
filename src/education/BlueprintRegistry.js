import { BlockIds } from '../utils/Constants.js';
import { Blueprint } from './Blueprint.js';
import { GameConfig } from '../game/GameConfig.js';

/** Catálogo validado de planos educativos. */
export class BlueprintRegistry {
  #byId = new Map();

  constructor(blockRegistry, maxBlocks = GameConfig.education.MAX_BLUEPRINT_BLOCKS) {
    this.blockRegistry = blockRegistry;
    this.maxBlocks = maxBlocks;
  }

  register(definition) {
    const blueprint = definition instanceof Blueprint
      ? definition
      : new Blueprint(definition, this.blockRegistry, this.maxBlocks);
    if (this.#byId.has(blueprint.id)) throw new Error(`Ya existe un Blueprint con id "${blueprint.id}".`);
    this.#byId.set(blueprint.id, blueprint);
    return blueprint;
  }

  registerAll(definitions) {
    return definitions.map((definition) => this.register(definition));
  }

  get(id) {
    const blueprint = this.#byId.get(id);
    if (!blueprint) throw new RangeError(`Blueprint desconocido: "${id}".`);
    return blueprint;
  }

  has(id) {
    return this.#byId.has(id);
  }

  values() {
    return [...this.#byId.values()];
  }

  summaries() {
    return this.values().map((blueprint) => blueprint.toSummary());
  }
}

/** Tres planos de dificultad creciente, todos con bloques del registro base. */
export function createDefaultBlueprintRegistry(blockRegistry, config = GameConfig.education) {
  const registry = new BlueprintRegistry(blockRegistry, config.MAX_BLUEPRINT_BLOCKS);
  registry.registerAll([
    {
      id: 'wood-house',
      name: 'Casa de madera',
      description: 'Construye una pequeña casa con piso, paredes y techo.',
      blocks: [
        ...filledLayer(3, 3, 0, BlockIds.PLANKS),
        { x: 0, y: 1, z: 0, blockId: BlockIds.LOG },
        { x: 2, y: 1, z: 0, blockId: BlockIds.LOG },
        { x: 0, y: 1, z: 2, blockId: BlockIds.LOG },
        { x: 2, y: 1, z: 2, blockId: BlockIds.LOG },
        { x: 1, y: 1, z: 0, blockId: BlockIds.PLANKS },
        { x: 1, y: 1, z: 2, blockId: BlockIds.PLANKS },
        { x: 0, y: 1, z: 1, blockId: BlockIds.PLANKS },
        { x: 2, y: 1, z: 1, blockId: BlockIds.PLANKS },
        ...filledLayer(3, 3, 2, BlockIds.PLANKS)
      ]
    },
    {
      id: 'stone-tower',
      name: 'Torre de piedra',
      description: 'Levanta una torre compacta de piedra con una plataforma superior.',
      blocks: [
        ...filledLayer(3, 3, 0, BlockIds.STONE),
        ...ringLayer(3, 3, 1, BlockIds.STONE),
        ...ringLayer(3, 3, 2, BlockIds.STONE),
        ...ringLayer(3, 3, 3, BlockIds.STONE),
        ...filledLayer(3, 3, 4, BlockIds.STONE)
      ]
    },
    {
      id: 'river-bridge',
      name: 'Puente sobre el río',
      description: 'Construye un puente largo combinando piedra y tablones.',
      blocks: [
        ...filledLayer(9, 3, 1, BlockIds.PLANKS),
        ...filledLayer(9, 1, 2, BlockIds.PLANKS, 0, 0),
        ...filledLayer(9, 1, 2, BlockIds.PLANKS, 0, 2),
        ...filledLayer(1, 3, 0, BlockIds.STONE, 0),
        ...filledLayer(1, 3, 0, BlockIds.STONE, 8)
      ]
    }
  ]);
  return registry;
}

function filledLayer(width, depth, y, blockId, offsetX = 0, offsetZ = 0) {
  const blocks = [];
  for (let z = 0; z < depth; z += 1) {
    for (let x = 0; x < width; x += 1) {
      blocks.push({ x: offsetX + x, y, z: offsetZ + z, blockId });
    }
  }
  return blocks;
}

function ringLayer(width, depth, y, blockId) {
  return filledLayer(width, depth, y, blockId).filter(
    ({ x, z }) => x === 0 || z === 0 || x === width - 1 || z === depth - 1
  );
}
