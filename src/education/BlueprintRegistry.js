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

/** Tres planos para construir, todos con bloques del registro base. */
export function createDefaultBlueprintRegistry(blockRegistry, config = GameConfig.education) {
  const registry = new BlueprintRegistry(blockRegistry, config.MAX_BLUEPRINT_BLOCKS);
  registry.registerAll([
    {
      id: 'wood-house',
      name: 'Casa de madera',
      description:
        'Construye una casa con piso de piedra partida, columnas de tronco, paredes de madera, ' +
        'puerta, ventanas de vidrio y techo a dos aguas.',
      blocks: woodHouseBlocks()
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

/**
 * Casa de 7 × 6 con techo a dos aguas. Cada parte es una etapa del plano, así
 * se construye como una casa de verdad y se pide un solo material por vez:
 *
 * 0. Piso de piedra partida.
 * 1. Columnas de tronco en las cuatro esquinas.
 * 2. Paredes de tablones, con la puerta al frente y los huecos de las ventanas.
 * 3. Ventanas de vidrio.
 * 4. Techo plano de tablones, que sobresale como alero a los costados.
 * 5. Frontones de tablones (los triángulos de adelante y atrás).
 * 6. Faldones del techo, de tronco, que suben hasta la cumbrera.
 */
function woodHouseBlocks() {
  const WIDTH = 7;
  const DEPTH = 6;
  const WALL_HEIGHT = 3;
  const lastX = WIDTH - 1;
  const lastZ = DEPTH - 1;
  const middleX = Math.floor(WIDTH / 2);
  const blocks = [];
  const add = (x, y, z, blockId, stage) => blocks.push({ x, y, z, blockId, stage });

  for (let z = 0; z < DEPTH; z += 1) {
    for (let x = 0; x < WIDTH; x += 1) add(x, 0, z, BlockIds.COBBLESTONE, 0);
  }

  const corners = [[0, 0], [lastX, 0], [0, lastZ], [lastX, lastZ]];
  for (const [x, z] of corners) {
    for (let y = 1; y <= WALL_HEIGHT; y += 1) add(x, y, z, BlockIds.LOG, 1);
  }

  const door = (x, y, z) => z === 0 && x === middleX && y <= 2;
  const window = (x, y, z) => y === 2 && (
    (z === 0 && (x === 1 || x === lastX - 1)) ||
    (z === lastZ && (x === 2 || x === lastX - 2)) ||
    ((x === 0 || x === lastX) && (z === 2 || z === 3))
  );
  for (let y = 1; y <= WALL_HEIGHT; y += 1) {
    for (let z = 0; z < DEPTH; z += 1) {
      for (let x = 0; x < WIDTH; x += 1) {
        const onWall = x === 0 || x === lastX || z === 0 || z === lastZ;
        const isCorner = (x === 0 || x === lastX) && (z === 0 || z === lastZ);
        if (!onWall || isCorner || door(x, y, z)) continue;
        add(x, y, z, window(x, y, z) ? BlockIds.GLASS : BlockIds.PLANKS, window(x, y, z) ? 3 : 2);
      }
    }
  }

  const ceiling = WALL_HEIGHT + 1;
  for (let z = 0; z < DEPTH; z += 1) {
    for (let x = 0; x < WIDTH; x += 1) add(x, ceiling, z, BlockIds.PLANKS, 4);
  }

  // Cada escalón del techo se mete un bloque hacia el centro.
  for (let step = 1; step <= middleX; step += 1) {
    const y = ceiling + step;
    const left = step;
    const right = lastX - step;
    for (let x = left + 1; x < right; x += 1) {
      add(x, y, 0, BlockIds.PLANKS, 5);
      add(x, y, lastZ, BlockIds.PLANKS, 5);
    }
    for (let z = 0; z < DEPTH; z += 1) {
      add(left, y, z, BlockIds.LOG, 6);
      if (right !== left) add(right, y, z, BlockIds.LOG, 6);
    }
  }
  return blocks;
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
