import { BlockIds } from '../utils/Constants.js';

/**
 * Piedras y maderas del catálogo educativo que son bloques propios: cada una
 * tiene su id, su textura (generada en scripts/lib/MaterialTextureFactory.js)
 * y se coloca en el mundo tal cual se ve en el inventario.
 *
 * La piedra, la piedra partida, la arenisca, la roca madre, el tronco y los
 * tablones ya existían; BlockRegistry les asigna su categoría.
 *
 * Archivo sin dependencias de BlockRegistry para que ambos puedan importarlo
 * sin un ciclo de módulos.
 */
export const MATERIAL_BLOCK_DEFINITIONS = Object.freeze([
  // Piedras
  {
    id: BlockIds.GRANITE,
    name: 'Granite',
    label: 'Granito',
    category: 'stones',
    syllables: ['GRA', 'NI', 'TO'],
    description: 'Roca ígnea rosada con motas oscuras y claras; muy dura y decorativa.',
    texture: 'granite.png',
    color: [186, 132, 118],
    hardness: 3.5
  },
  {
    id: BlockIds.DIORITE,
    name: 'Diorite',
    label: 'Diorita',
    category: 'stones',
    syllables: ['DIO', 'RI', 'TA'],
    description: 'Roca ígnea blanca con motas negras, usada como piedra decorativa.',
    texture: 'diorite.png',
    color: [216, 216, 220],
    hardness: 3
  },
  {
    id: BlockIds.ANDESITE,
    name: 'Andesite',
    label: 'Andesita',
    category: 'stones',
    syllables: ['AN', 'DE', 'SI', 'TA'],
    description: 'Roca volcánica gris de grano fino, común en zonas montañosas.',
    texture: 'andesite.png',
    color: [138, 142, 142],
    hardness: 3
  },
  {
    id: BlockIds.BASALT,
    name: 'Basalt',
    label: 'Basalto',
    category: 'stones',
    syllables: ['BA', 'SAL', 'TO'],
    description: 'Roca volcánica oscura que forma columnas al enfriarse la lava.',
    texture: 'basalt.png',
    color: [72, 74, 82],
    hardness: 3.5
  },
  {
    id: BlockIds.OBSIDIAN,
    name: 'Obsidian',
    label: 'Obsidiana',
    category: 'stones',
    syllables: ['OB', 'SI', 'DIA', 'NA'],
    description: 'Vidrio volcánico negro y brillante que se forma cuando la lava se enfría muy rápido; muy duro.',
    texture: 'obsidian.png',
    color: [38, 28, 56],
    hardness: 8
  },
  {
    id: BlockIds.LIMESTONE,
    name: 'Limestone',
    label: 'Caliza',
    category: 'stones',
    syllables: ['CA', 'LI', 'ZA'],
    description: 'Roca sedimentaria clara formada por restos de conchas; se usó en muchas construcciones antiguas.',
    texture: 'limestone.png',
    color: [226, 214, 185],
    hardness: 2
  },
  {
    id: BlockIds.MARBLE,
    name: 'Marble',
    label: 'Mármol',
    category: 'stones',
    syllables: ['MAR', 'MOL'],
    description: 'Roca metamórfica blanca con vetas grises, de aspecto elegante.',
    texture: 'marble.png',
    color: [240, 242, 245],
    hardness: 3.5
  },
  {
    id: BlockIds.SLATE,
    name: 'Slate',
    label: 'Pizarra',
    category: 'stones',
    syllables: ['PI', 'ZA', 'RRA'],
    description: 'Roca oscura que se separa en láminas finas; se usa para techos.',
    texture: 'slate.png',
    color: [64, 70, 78],
    hardness: 3.5
  },
  {
    id: BlockIds.TUFF,
    name: 'Tuff',
    label: 'Toba',
    category: 'stones',
    syllables: ['TO', 'BA'],
    description: 'Roca volcánica porosa y liviana, de tono verdoso o grisáceo.',
    texture: 'tuff.png',
    color: [130, 140, 124],
    hardness: 2
  },
  {
    id: BlockIds.MOSSY_COBBLESTONE,
    name: 'MossyCobblestone',
    label: 'Piedra musgosa',
    category: 'stones',
    syllables: ['PIE', 'DRA', 'MUS', 'GO', 'SA'],
    description: 'Piedra partida cubierta de musgo, común en ruinas y zonas húmedas.',
    texture: 'mossy_cobblestone.png',
    color: [98, 126, 92],
    hardness: 3
  },

  // Maderas (tablones de cada especie)
  {
    id: BlockIds.OAK,
    name: 'Oak',
    label: 'Roble',
    category: 'woods',
    syllables: ['RO', 'BLE'],
    description: 'Madera marrón oscura, dura y resistente, la más común en los bosques templados.',
    texture: 'wood_oak.png',
    color: [128, 88, 46],
    hardness: 2
  },
  {
    id: BlockIds.BIRCH,
    name: 'Birch',
    label: 'Abedul',
    category: 'woods',
    syllables: ['A', 'BE', 'DUL'],
    description: 'Madera muy clara de un árbol de corteza blanca con manchas negras.',
    texture: 'wood_birch.png',
    color: [216, 202, 162],
    hardness: 2
  },
  {
    id: BlockIds.PINE,
    name: 'Pine',
    label: 'Pino',
    category: 'woods',
    syllables: ['PI', 'NO'],
    description: 'Madera amarillenta con nudos, de árboles altos de zonas frías.',
    texture: 'wood_pine.png',
    color: [212, 176, 118],
    hardness: 2
  },
  {
    id: BlockIds.FIR,
    name: 'Fir',
    label: 'Abeto',
    category: 'woods',
    syllables: ['A', 'BE', 'TO'],
    description: 'Madera rojiza y liviana de las coníferas de montaña.',
    texture: 'wood_fir.png',
    color: [150, 96, 66],
    hardness: 2
  },
  {
    id: BlockIds.EBONY,
    name: 'Ebony',
    label: 'Ébano',
    category: 'woods',
    syllables: ['E', 'BA', 'NO'],
    description: 'Madera casi negra, densa y muy valiosa; crece en zonas tropicales.',
    texture: 'wood_ebony.png',
    color: [54, 44, 42],
    hardness: 3
  },
  {
    id: BlockIds.MAHOGANY,
    name: 'Mahogany',
    label: 'Caoba',
    category: 'woods',
    syllables: ['CA', 'O', 'BA'],
    description: 'Madera rojiza oscura de las selvas, apreciada para hacer muebles.',
    texture: 'wood_mahogany.png',
    color: [130, 58, 44],
    hardness: 2.5
  },
  {
    id: BlockIds.ACACIA,
    name: 'Acacia',
    label: 'Acacia',
    category: 'woods',
    syllables: ['A', 'CA', 'CIA'],
    description: 'Madera anaranjada de los árboles de la sabana.',
    texture: 'wood_acacia.png',
    color: [196, 104, 52],
    hardness: 2
  },
  {
    id: BlockIds.CHERRY,
    name: 'Cherry',
    label: 'Cerezo',
    category: 'woods',
    syllables: ['CE', 'RE', 'ZO'],
    description: 'Madera rosada de árboles con flores, muy decorativa.',
    texture: 'wood_cherry.png',
    color: [218, 152, 164],
    hardness: 2
  },
  {
    id: BlockIds.WILLOW,
    name: 'Willow',
    label: 'Sauce',
    category: 'woods',
    syllables: ['SAU', 'CE'],
    description: 'Madera suave y flexible, de tono verdoso, de árboles junto a ríos.',
    texture: 'wood_willow.png',
    color: [164, 172, 118],
    hardness: 1.5
  },
  {
    id: BlockIds.MANGROVE,
    name: 'Mangrove',
    label: 'Manglar',
    category: 'woods',
    syllables: ['MAN', 'GLAR'],
    description: 'Madera rojiza de árboles con raíces aéreas que crecen en el agua.',
    texture: 'wood_mangrove.png',
    color: [150, 62, 54],
    hardness: 2
  },
  {
    id: BlockIds.BAMBOO,
    name: 'Bamboo',
    label: 'Bambú',
    category: 'woods',
    syllables: ['BAM', 'BU'],
    description: 'Tallo hueco con nudos que crece muy rápido; liviano y flexible.',
    texture: 'wood_bamboo.png',
    color: [196, 184, 92],
    hardness: 1.2
  },
  {
    id: BlockIds.PALM,
    name: 'Palm',
    label: 'Palmera',
    category: 'woods',
    syllables: ['PAL', 'ME', 'RA'],
    description: 'Madera fibrosa de árboles costeros y tropicales.',
    texture: 'wood_palm.png',
    color: [178, 138, 88],
    hardness: 1.8
  },
  {
    id: BlockIds.OLIVE,
    name: 'Olive',
    label: 'Olivo',
    category: 'woods',
    syllables: ['O', 'LI', 'VO'],
    description: 'Madera clara con vetas onduladas, de árboles de climas secos.',
    texture: 'wood_olive.png',
    color: [170, 150, 100],
    hardness: 2.5
  },
  {
    id: BlockIds.ROTTEN_WOOD,
    name: 'RottenWood',
    label: 'Madera podrida',
    category: 'woods',
    syllables: ['MA', 'DE', 'RA', 'PO', 'DRI', 'DA'],
    description: 'Madera vieja y húmeda, con manchas de moho; se rompe muy fácil.',
    texture: 'wood_rotten.png',
    color: [92, 82, 68],
    hardness: 0.6
  }
]);

/** Categoría de los bloques que ya existían antes del catálogo. */
export const BASE_BLOCK_CATEGORIES = Object.freeze({
  [BlockIds.STONE]: 'stones',
  [BlockIds.COBBLESTONE]: 'stones',
  [BlockIds.SANDSTONE]: 'stones',
  [BlockIds.BEDROCK]: 'stones',
  [BlockIds.LOG]: 'woods',
  [BlockIds.PLANKS]: 'woods'
});
