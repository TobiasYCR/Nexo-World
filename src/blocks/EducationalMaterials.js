import { BlockIds } from '../utils/Constants.js';
import { BlockType } from './BlockType.js';

/**
 * Catálogo educativo de materiales: Tipos de Piedra (14) y Tipos de Madera (14)
 * con sus definiciones, separación en sílabas, colores representativos y texturas.
 */
export const EDUCATIONAL_MATERIAL_DEFINITIONS = Object.freeze([
  // ==========================================================================
  // PIEDRAS (14)
  // ==========================================================================
  Object.freeze({
    id: 101,
    worldBlockId: BlockIds.STONE,
    name: 'Piedra',
    label: 'Piedra',
    category: 'stones',
    syllables: ['PIE', 'DRA'],
    syllableText: 'PIE - DRA',
    description: 'Roca gris común que forma la mayor parte del subsuelo; básica para construir y fabricar herramientas.',
    texture: 'stone.png',
    color: [128, 128, 132],
    hardness: 3
  }),
  Object.freeze({
    id: 102,
    worldBlockId: BlockIds.COBBLESTONE,
    name: 'RocaAdoquin',
    label: 'Roca (adoquín)',
    category: 'stones',
    syllables: ['RO', 'CA', 'A', 'DO', 'QUIN'],
    syllableText: 'RO - CA - A - DO - QUIN',
    description: 'Piedra fragmentada que se obtiene al picar piedra; resistente y fácil de conseguir.',
    texture: 'cobblestone.png',
    color: [116, 116, 122],
    hardness: 3
  }),
  Object.freeze({
    id: 103,
    worldBlockId: BlockIds.STONE,
    name: 'Granito',
    label: 'Granito',
    category: 'stones',
    syllables: ['GRA', 'NI', 'TO'],
    syllableText: 'GRA - NI - TO',
    description: 'Roca ígnea rosada o moteada, muy dura y decorativa.',
    texture: 'stone.png',
    color: [186, 132, 118],
    hardness: 3.5
  }),
  Object.freeze({
    id: 104,
    worldBlockId: BlockIds.STONE,
    name: 'Diorita',
    label: 'Diorita',
    category: 'stones',
    syllables: ['DIO', 'RI', 'TA'],
    syllableText: 'DIO - RI - TA',
    description: 'Roca ígnea blanca con motas negras, usada como bloque decorativo.',
    texture: 'stone.png',
    color: [216, 216, 220],
    hardness: 3
  }),
  Object.freeze({
    id: 105,
    worldBlockId: BlockIds.STONE,
    name: 'Andesita',
    label: 'Andesita',
    category: 'stones',
    syllables: ['AN', 'DE', 'SI', 'TA'],
    syllableText: 'AN - DE - SI - TA',
    description: 'Roca volcánica gris de grano fino, común en zonas montañosas.',
    texture: 'stone.png',
    color: [138, 142, 142],
    hardness: 3
  }),
  Object.freeze({
    id: 106,
    worldBlockId: BlockIds.COBBLESTONE,
    name: 'Basalto',
    label: 'Basalto',
    category: 'stones',
    syllables: ['BA', 'SAL', 'TO'],
    syllableText: 'BA - SAL - TO',
    description: 'Roca volcánica oscura y columnar que se forma al enfriarse la lava.',
    texture: 'cobblestone.png',
    color: [72, 74, 82],
    hardness: 3.5
  }),
  Object.freeze({
    id: 107,
    worldBlockId: BlockIds.BEDROCK,
    name: 'Obsidiana',
    label: 'Obsidiana',
    category: 'stones',
    syllables: ['OB', 'SI', 'DIA', 'NA'],
    syllableText: 'OB - SI - DIA - NA',
    description: 'Vidrio volcánico negro, extremadamente duro; resiste explosiones.',
    texture: 'bedrock.png',
    color: [38, 28, 56],
    hardness: 8
  }),
  Object.freeze({
    id: 108,
    worldBlockId: BlockIds.SANDSTONE,
    name: 'Arenisca',
    label: 'Arenisca',
    category: 'stones',
    syllables: ['A', 'RE', 'NIS', 'CA'],
    syllableText: 'A - RE - NIS - CA',
    description: 'Roca sedimentaria formada por arena compactada; típica de desiertos y playas.',
    texture: 'sandstone.png',
    color: [212, 184, 122],
    hardness: 2.5
  }),
  Object.freeze({
    id: 109,
    worldBlockId: BlockIds.SANDSTONE,
    name: 'Caliza',
    label: 'Caliza',
    category: 'stones',
    syllables: ['CA', 'LI', 'ZA'],
    syllableText: 'CA - LI - ZA',
    description: 'Roca sedimentaria clara y blanda, ideal para construcciones antiguas.',
    texture: 'sandstone.png',
    color: [226, 214, 185],
    hardness: 2
  }),
  Object.freeze({
    id: 110,
    worldBlockId: BlockIds.STONE,
    name: 'Marmol',
    label: 'Mármol',
    category: 'stones',
    syllables: ['MAR', 'MOL'],
    syllableText: 'MAR - MOL',
    description: 'Roca metamórfica blanca y pulida, de aspecto elegante.',
    texture: 'stone.png',
    color: [240, 242, 245],
    hardness: 3.5
  }),
  Object.freeze({
    id: 111,
    worldBlockId: BlockIds.COBBLESTONE,
    name: 'Pizarra',
    label: 'Pizarra',
    category: 'stones',
    syllables: ['PI', 'ZA', 'RRA'],
    syllableText: 'PI - ZA - RRA',
    description: 'Roca oscura que se separa en láminas; aparece en capas profundas.',
    texture: 'cobblestone.png',
    color: [64, 70, 78],
    hardness: 3.5
  }),
  Object.freeze({
    id: 112,
    worldBlockId: BlockIds.STONE,
    name: 'Toba',
    label: 'Toba',
    category: 'stones',
    syllables: ['TO', 'BA'],
    syllableText: 'TO - BA',
    description: 'Roca volcánica porosa y ligera, de tono verdoso o grisáceo.',
    texture: 'stone.png',
    color: [130, 140, 124],
    hardness: 2
  }),
  Object.freeze({
    id: 113,
    worldBlockId: BlockIds.COBBLESTONE,
    name: 'PiedraMusgosa',
    label: 'Piedra musgosa',
    category: 'stones',
    syllables: ['PIE', 'DRA', 'MUS', 'GO', 'SA'],
    syllableText: 'PIE - DRA - MUS - GO - SA',
    description: 'Piedra cubierta de musgo, común en ruinas y zonas húmedas.',
    texture: 'cobblestone.png',
    color: [98, 126, 92],
    hardness: 3
  }),
  Object.freeze({
    id: 114,
    worldBlockId: BlockIds.BEDROCK,
    name: 'LechoDeRoca',
    label: 'Lecho de roca',
    category: 'stones',
    syllables: ['LE', 'CHO', 'DE', 'RO', 'CA'],
    syllableText: 'LE - CHO - DE - RO - CA',
    description: 'Capa más profunda del mundo; indestructible.',
    texture: 'bedrock.png',
    color: [52, 52, 58],
    breakable: false,
    hardness: Infinity
  }),

  // ==========================================================================
  // MADERAS (14)
  // ==========================================================================
  Object.freeze({
    id: 201,
    worldBlockId: BlockIds.PLANKS,
    name: 'Roble',
    label: 'Roble',
    category: 'woods',
    syllables: ['RO', 'BLE'],
    syllableText: 'RO - BLE',
    description: 'Madera marrón clara, resistente y la más común en bosques templados.',
    texture: 'planks.png',
    color: [168, 126, 78],
    hardness: 2
  }),
  Object.freeze({
    id: 202,
    worldBlockId: BlockIds.LOG,
    name: 'Abedul',
    label: 'Abedul',
    category: 'woods',
    syllables: ['A', 'BE', 'DUL'],
    syllableText: 'A - BE - DUL',
    description: 'Madera muy clara con corteza blanca y manchas negras.',
    texture: 'planks.png',
    color: [216, 202, 162],
    hardness: 2
  }),
  Object.freeze({
    id: 203,
    worldBlockId: BlockIds.LOG,
    name: 'Pino',
    label: 'Pino',
    category: 'woods',
    syllables: ['PI', 'NO'],
    syllableText: 'PI - NO',
    description: 'Madera marrón oscura de árboles altos en zonas frías.',
    texture: 'log_side.png',
    color: [114, 82, 52],
    hardness: 2
  }),
  Object.freeze({
    id: 204,
    worldBlockId: BlockIds.PLANKS,
    name: 'Abeto',
    label: 'Abeto',
    category: 'woods',
    syllables: ['A', 'BE', 'TO'],
    syllableText: 'A - BE - TO',
    description: 'Conífera de montañas nevadas; madera rojiza y resistente.',
    texture: 'planks.png',
    color: [136, 88, 62],
    hardness: 2
  }),
  Object.freeze({
    id: 205,
    worldBlockId: BlockIds.LOG,
    name: 'Ebano',
    label: 'Ébano',
    category: 'woods',
    syllables: ['E', 'BA', 'NO'],
    syllableText: 'E - BA - NO',
    description: 'Madera negra, densa y muy valiosa; crece en zonas tropicales.',
    texture: 'log_side.png',
    color: [54, 44, 42],
    hardness: 3
  }),
  Object.freeze({
    id: 206,
    worldBlockId: BlockIds.PLANKS,
    name: 'Caoba',
    label: 'Caoba',
    category: 'woods',
    syllables: ['CA', 'O', 'BA'],
    syllableText: 'CA - O - BA',
    description: 'Madera rojiza y elegante de selvas, apreciada para muebles.',
    texture: 'planks.png',
    color: [148, 68, 54],
    hardness: 2.5
  }),
  Object.freeze({
    id: 207,
    worldBlockId: BlockIds.PLANKS,
    name: 'Acacia',
    label: 'Acacia',
    category: 'woods',
    syllables: ['A', 'CA', 'CIA'],
    syllableText: 'A - CA - CIA',
    description: 'Madera anaranjada de sabanas, con tronco grisáceo.',
    texture: 'planks.png',
    color: [186, 104, 58],
    hardness: 2
  }),
  Object.freeze({
    id: 208,
    worldBlockId: BlockIds.PLANKS,
    name: 'Cerezo',
    label: 'Cerezo',
    category: 'woods',
    syllables: ['CE', 'RE', 'ZO'],
    syllableText: 'CE - RE - ZO',
    description: 'Madera rosada de árboles con flores, muy decorativa.',
    texture: 'planks.png',
    color: [218, 152, 164],
    hardness: 2
  }),
  Object.freeze({
    id: 209,
    worldBlockId: BlockIds.PLANKS,
    name: 'Sauce',
    label: 'Sauce',
    category: 'woods',
    syllables: ['SAU', 'CE'],
    syllableText: 'SAU - CE',
    description: 'Madera suave y flexible de árboles junto a ríos y pantanos.',
    texture: 'planks.png',
    color: [164, 172, 118],
    hardness: 1.5
  }),
  Object.freeze({
    id: 210,
    worldBlockId: BlockIds.LOG,
    name: 'Manglar',
    label: 'Manglar',
    category: 'woods',
    syllables: ['MAN', 'GLAR'],
    syllableText: 'MAN - GLAR',
    description: 'Madera rojiza de árboles con raíces aéreas en zonas inundadas.',
    texture: 'log_side.png',
    color: [132, 58, 48],
    hardness: 2
  }),
  Object.freeze({
    id: 211,
    worldBlockId: BlockIds.PLANKS,
    name: 'Bambu',
    label: 'Bambú',
    category: 'woods',
    syllables: ['BAM', 'BU'],
    syllableText: 'BAM - BU',
    description: 'Tallo hueco de crecimiento rápido; ligero y versátil.',
    texture: 'planks.png',
    color: [196, 184, 92],
    hardness: 1.2
  }),
  Object.freeze({
    id: 212,
    worldBlockId: BlockIds.PLANKS,
    name: 'Palmera',
    label: 'Palmera',
    category: 'woods',
    syllables: ['PAL', 'ME', 'RA'],
    syllableText: 'PAL - ME - RA',
    description: 'Madera fibrosa de árboles costeros y tropicales.',
    texture: 'planks.png',
    color: [178, 138, 88],
    hardness: 1.8
  }),
  Object.freeze({
    id: 213,
    worldBlockId: BlockIds.LOG,
    name: 'Olivo',
    label: 'Olivo',
    category: 'woods',
    syllables: ['O', 'LI', 'VO'],
    syllableText: 'O - LI - VO',
    description: 'Madera retorcida y veteada de climas secos y cálidos.',
    texture: 'log_side.png',
    color: [152, 136, 92],
    hardness: 2.5
  }),
  Object.freeze({
    id: 214,
    worldBlockId: BlockIds.LOG,
    name: 'MaderaPodrida',
    label: 'Madera podrida',
    category: 'woods',
    syllables: ['MA', 'DE', 'RA', 'PO', 'DRI', 'DA'],
    syllableText: 'MA - DE - RA - PO - DRI - DA',
    description: 'Madera vieja y frágil hallada en ruinas o pantanos; poco resistente.',
    texture: 'log_side.png',
    color: [92, 82, 68],
    hardness: 0.6
  })
]);

/**
 * Construye la lista de materiales educativos (Piedras y Maderas) listos para
 * mostrarse en el Inventario, reproducirse con audio y equiparse en la hotbar.
 * @returns {ReadonlyArray<Object>}
 */
export function createEducationalMaterials() {
  return Object.freeze(
    EDUCATIONAL_MATERIAL_DEFINITIONS.map((def) => {
      const base = new BlockType({
        id: def.worldBlockId,
        name: def.name,
        label: def.label,
        description: def.description,
        syllables: def.syllables,
        syllableText: def.syllableText,
        texture: def.texture,
        color: def.color,
        hardness: def.hardness,
        breakable: def.breakable ?? true,
        solid: true
      });

      return Object.freeze({
        ...base,
        id: def.worldBlockId,
        materialId: def.id,
        name: def.name,
        label: def.label,
        description: def.description,
        category: def.category,
        syllables: base.syllables,
        syllableText: base.syllableText,
        texture: base.texture,
        textures: base.textures,
        color: base.color,
        hardness: base.hardness,
        breakable: base.breakable,
        solid: base.solid,
        transparent: base.transparent,
        isEducationalMaterial: true
      });
    })
  );
}
