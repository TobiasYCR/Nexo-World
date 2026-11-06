import { BlockIds } from '../utils/Constants.js';
import { createDefaultBlockRegistry } from '../blocks/BlockRegistry.js';
import { resolveBlockSyllables } from '../blocks/BlockType.js';

/**
 * Genera los bloques relativos (dx, dy, dz) para la "Casa de madera" (3x3x3).
 */
function buildWoodHouseBlocks() {
  const blocks = [];
  // Nivel 0 y 1: Paredes de tablones, esquinas de tronco, puerta abierta en (0, 0..1, -1) y ventanas laterales
  for (let dy = 0; dy < 2; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      for (let dz = -1; dz <= 1; dz++) {
        // Hueco interior
        if (dx === 0 && dz === 0) continue;
        // Hueco de puerta al frente (dz = -1, dx = 0)
        if (dx === 0 && dz === -1) continue;

        const isCorner = Math.abs(dx) === 1 && Math.abs(dz) === 1;
        if (isCorner) {
          blocks.push({ dx, dy, dz, blockId: BlockIds.LOG });
        } else if (dy === 1 && ((Math.abs(dx) === 1 && dz === 0) || (dx === 0 && dz === 1))) {
          blocks.push({ dx, dy, dz, blockId: BlockIds.GLASS });
        } else {
          blocks.push({ dx, dy, dz, blockId: BlockIds.PLANKS });
        }
      }
    }
  }

  // Nivel 2: Techo de tablones
  for (let dx = -1; dx <= 1; dx++) {
    for (let dz = -1; dz <= 1; dz++) {
      blocks.push({ dx, dy: 2, dz, blockId: BlockIds.PLANKS });
    }
  }

  return blocks;
}

/**
 * Genera los bloques relativos para la "Torre de piedra" (3x3 base, 3 niveles).
 */
function buildStoneTowerBlocks() {
  const blocks = [];
  for (let dy = 0; dy < 3; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      for (let dz = -1; dz <= 1; dz++) {
        if (dx === 0 && dz === 0) continue;
        if (dy < 2 && dx === 0 && dz === -1) continue;

        const isCorner = Math.abs(dx) === 1 && Math.abs(dz) === 1;
        if (dy === 1 && !isCorner) {
          blocks.push({ dx, dy, dz, blockId: BlockIds.GLASS });
        } else if (isCorner) {
          blocks.push({ dx, dy, dz, blockId: BlockIds.COBBLESTONE });
        } else {
          blocks.push({ dx, dy, dz, blockId: BlockIds.STONE });
        }
      }
    }
  }
  return blocks;
}

/**
 * Genera los bloques relativos para el "Puente de arena" (pasarela con barandas).
 */
function buildSandBridgeBlocks() {
  const blocks = [];
  // Piso de arenisca (3x3)
  for (let dz = -1; dz <= 1; dz++) {
    for (let dx = -1; dx <= 1; dx++) {
      blocks.push({ dx, dy: 0, dz, blockId: BlockIds.SANDSTONE });
    }
  }
  // Barandas laterales de arena (dy = 1 en dx = -1 y dx = 1)
  for (let dz = -1; dz <= 1; dz++) {
    blocks.push({ dx: -1, dy: 1, dz, blockId: BlockIds.SAND });
    blocks.push({ dx: 1, dy: 1, dz, blockId: BlockIds.SAND });
  }
  return blocks;
}

/**
 * Genera los bloques relativos para el "Refugio de tierra" (muros de tierra y techo natural).
 */
function buildNatureShelterBlocks() {
  const blocks = [];
  // Nivel 0 y 1: muros en U de tierra
  for (let dy = 0; dy < 2; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      for (let dz = -1; dz <= 1; dz++) {
        if (dx === 0 && dz === 0) continue;
        if (dx === 0 && dz === -1) continue;
        blocks.push({ dx, dy, dz, blockId: BlockIds.DIRT });
      }
    }
  }
  // Nivel 2: techo de césped y bordes de hojas
  for (let dx = -1; dx <= 1; dx++) {
    for (let dz = -1; dz <= 1; dz++) {
      const isCenter = dx === 0 && dz === 0;
      blocks.push({
        dx,
        dy: 2,
        dz,
        blockId: isCenter ? BlockIds.LEAVES : BlockIds.GRASS
      });
    }
  }
  return blocks;
}

const RAW_PRESETS = [
  {
    id: 'wood_house',
    name: 'Casa de madera',
    description: 'Construye una cabaña con esquinas de tronco, paredes de tablones y ventanas de vidrio.',
    difficulty: 'Fácil',
    buildBlocks: buildWoodHouseBlocks
  },
  {
    id: 'stone_tower',
    name: 'Torre de piedra',
    description: 'Levanta una torre firme combinando piedra, piedra partida y miradores de vidrio.',
    difficulty: 'Media',
    buildBlocks: buildStoneTowerBlocks
  },
  {
    id: 'sand_bridge',
    name: 'Puente de arena',
    description: 'Crea un paso elevado en el desierto usando base de arenisca y barandas de arena.',
    difficulty: 'Fácil',
    buildBlocks: buildSandBridgeBlocks
  },
  {
    id: 'nature_shelter',
    name: 'Refugio de tierra',
    description: 'Arma un refugio ecológico utilizando bloques de tierra, césped y hojas.',
    difficulty: 'Fácil',
    buildBlocks: buildNatureShelterBlocks
  }
];

/**
 * Construye el catálogo inmutable de planos educativos enriquecido con los metadatos
 * reales y silábicos del BlockRegistry.
 * @param {import('../blocks/BlockRegistry.js').BlockRegistry} [blockRegistry]
 * @returns {ReadonlyArray<Object>}
 */
export function createBuildPresets(blockRegistry = null) {
  const registry = blockRegistry || createDefaultBlockRegistry();

  return Object.freeze(
    RAW_PRESETS.map((raw) => {
      // Ordenar de abajo hacia arriba (dy ascendente) para guiar paso a paso
      const orderedBlocks = [...raw.buildBlocks()].sort((a, b) => (
        a.dy - b.dy || a.dz - b.dz || a.dx - b.dx
      ));

      const countsByBlockId = new Map();
      for (const item of orderedBlocks) {
        countsByBlockId.set(item.blockId, (countsByBlockId.get(item.blockId) ?? 0) + 1);
      }

      const materials = [];
      for (const [blockId, count] of countsByBlockId.entries()) {
        const blockType = registry.get(blockId);
        const { syllables, syllableText } = resolveBlockSyllables(blockType);
        materials.push(
          Object.freeze({
            blockId,
            name: blockType.name,
            label: blockType.label,
            syllables,
            syllableText,
            texture: blockType.textures?.top || blockType.texture,
            color: blockType.color,
            count
          })
        );
      }

      return Object.freeze({
        id: raw.id,
        name: raw.name,
        description: raw.description,
        difficulty: raw.difficulty,
        totalBlocks: orderedBlocks.length,
        blocks: Object.freeze(orderedBlocks.map((b) => Object.freeze({ ...b }))),
        materials: Object.freeze(materials)
      });
    })
  );
}

