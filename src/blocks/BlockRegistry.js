import {
  BlockType,
  resolveBlockSyllables,
  resolveBlockSyllableLines,
  resolveBlockDescription,
  FALLBACK_SYLLABLES_DICTIONARY,
  FALLBACK_DESCRIPTIONS_DICTIONARY,
  splitSpanishWordIntoSyllables
} from './BlockType.js';
import { BlockIds } from '../utils/Constants.js';

export {
  resolveBlockSyllables,
  resolveBlockSyllableLines,
  resolveBlockDescription,
  FALLBACK_SYLLABLES_DICTIONARY,
  FALLBACK_DESCRIPTIONS_DICTIONARY,
  splitSpanishWordIntoSyllables
};

/**
 * Catálogo central de tipos de bloque. Es el único lugar donde se declaran
 * propiedades por tipo: el resto del código consulta el registro en vez de
 * comparar ids a mano, de modo que agregar un bloque nuevo es una sola entrada.
 */
export class BlockRegistry {
  /** Los ids se guardan en Uint8Array (Chunk), así que nunca superan 255. */
  static MAX_ID = 255;

  #byId = new Map();
  #byName = new Map();

  register(definition) {
    const type = definition instanceof BlockType ? definition : new BlockType(definition);
    if (this.#byId.has(type.id)) {
      throw new Error(`Ya existe un BlockType con id ${type.id} ("${this.#byId.get(type.id).name}").`);
    }
    if (this.#byName.has(type.name)) {
      throw new Error(`Ya existe un BlockType llamado "${type.name}".`);
    }
    this.#byId.set(type.id, type);
    this.#byName.set(type.name, type);
    return type;
  }

  registerAll(definitions) {
    return definitions.map((definition) => this.register(definition));
  }

  get(id) {
    const type = this.#byId.get(id);
    if (!type) throw new RangeError(`BlockType desconocido: id ${id}.`);
    return type;
  }

  getByName(name) {
    const type = this.#byName.get(name);
    if (!type) throw new RangeError(`BlockType desconocido: "${name}".`);
    return type;
  }

  has(id) {
    return this.#byId.has(id);
  }

  isSolid(id) {
    return this.#byId.get(id)?.solid ?? false;
  }

  isOpaque(id) {
    return this.#byId.get(id)?.isOpaque ?? false;
  }

  /** Todos los tipos registrados, en orden de registro. */
  values() {
    return [...this.#byId.values()];
  }

  /** Tipos colocables por el jugador (todo lo que no sea aire). */
  placeableTypes() {
    return this.values().filter((type) => type.id !== BlockIds.AIR);
  }

  /** Tipos que se entregan en la hotbar al iniciar la partida. */
  starterTypes() {
    return this.values().filter((type) => type.starter);
  }

  /**
   * Tabla indexada por id con el valor booleano de una propiedad. Pensada para
   * los bucles de generación: consultar un Uint8Array por bloque es mucho más
   * barato que buscar el BlockType en el Map, y sigue sin comparar ids a mano.
   * @param {string} property nombre de la propiedad del BlockType (ej. 'carvable')
   * @returns {Uint8Array}
   */
  propertyTable(property) {
    const table = new Uint8Array(BlockRegistry.MAX_ID + 1);
    for (const type of this.#byId.values()) table[type.id] = type[property] ? 1 : 0;
    return table;
  }

  /** Nombres de textura únicos, para que TextureManager sepa qué precargar. */
  textureNames() {
    const names = [];
    for (const type of this.values()) {
      if (type.texture) names.push(type.texture);
      names.push(...Object.values(type.textures ?? {}).filter(Boolean));
    }
    return [...new Set(names)];
  }
}

/** Definiciones base de Nexo World. Para sumar un bloque, agregar acá su entrada. */
const DEFAULT_BLOCK_DEFINITIONS = [
  {
    id: BlockIds.AIR,
    name: 'Air',
    label: 'Aire',
    description: 'Espacio vacío invisible que nos rodea y permite respirar.',
    syllables: ['AI', 'RE'],
    syllableText: 'AI - RE',
    solid: false,
    transparent: true,
    texture: null,
    color: [0, 0, 0],
    breakable: false,
    drops: []
  },
  {
    id: BlockIds.GRASS,
    name: 'Grass',
    label: 'Cesped',
    description: 'Bloque de tierra cubierto de pasto verde donde crecen plantas y árboles.',
    syllables: ['CES', 'PED'],
    syllableText: 'CES - PED',
    solid: true,
    texture: 'grass_top.png',
    textures: { top: 'grass_top.png', side: 'grass_side.png', bottom: 'dirt.png' },
    color: [106, 170, 80],
    hardness: 1,
    carvable: true,
    sustainsTrees: true,
    starter: true
  },
  {
    id: BlockIds.DIRT,
    name: 'Dirt',
    label: 'Tierra',
    description: 'Suelo blando y marrón que forma la superficie natural del mundo.',
    syllables: ['TIE', 'RRA'],
    syllableText: 'TIE - RRA',
    solid: true,
    texture: 'dirt.png',
    color: [134, 96, 67],
    hardness: 1,
    carvable: true,
    sustainsTrees: true,
    starter: true
  },
  {
    id: BlockIds.STONE,
    name: 'Stone',
    label: 'Piedra',
    description: 'Roca gris común que forma la mayor parte del subsuelo; básica para construir y fabricar herramientas.',
    syllables: ['PIE', 'DRA'],
    syllableText: 'PIE - DRA',
    solid: true,
    texture: 'stone.png',
    color: [128, 128, 132],
    hardness: 3,
    drops: [BlockIds.COBBLESTONE],
    carvable: true,
    oreHost: true,
    starter: true
  },
  {
    id: BlockIds.LOG,
    name: 'Log',
    label: 'Tronco',
    description: 'Madera marrón clara, resistente y la más común en bosques templados.',
    syllables: ['TRON', 'CO'],
    syllableText: 'TRON - CO',
    solid: true,
    texture: 'log_side.png',
    textures: { top: 'log_top.png', side: 'log_side.png', bottom: 'log_top.png' },
    color: [132, 88, 48],
    hardness: 2
  },
  {
    id: BlockIds.LEAVES,
    name: 'Leaves',
    label: 'Hojas',
    description: 'Follaje verde de las copas de los árboles que deja pasar un poco de luz.',
    syllables: ['HO', 'JAS'],
    syllableText: 'HO - JAS',
    solid: true,
    transparent: true,
    texture: 'leaves.png',
    color: [70, 135, 52],
    hardness: 0.4,
    drops: []
  },
  {
    id: BlockIds.PLANKS,
    name: 'Planks',
    label: 'Tablones',
    description: 'Madera marrón clara, resistente y la más común en bosques templados.',
    syllables: ['TA', 'BLO', 'NES'],
    syllableText: 'TA - BLO - NES',
    solid: true,
    texture: 'planks.png',
    color: [154, 111, 62],
    hardness: 1.5,
    starter: true
  },
  {
    id: BlockIds.SAND,
    name: 'Sand',
    label: 'Arena',
    description: 'Granos finos de color claro que cubren las playas y los desiertos.',
    syllables: ['A', 'RE', 'NA'],
    syllableText: 'A - RE - NA',
    solid: true,
    texture: 'sand.png',
    color: [224, 204, 150],
    hardness: 0.8,
    carvable: true
  },
  {
    id: BlockIds.COBBLESTONE,
    name: 'Cobblestone',
    label: 'Piedra partida',
    description: 'Piedra fragmentada que se obtiene al picar piedra; resistente y fácil de conseguir.',
    syllables: ['PIE', 'DRA', 'PAR', 'TI', 'DA'],
    syllableText: 'PIE - DRA - PAR - TI - DA',
    solid: true,
    texture: 'cobblestone.png',
    color: [116, 116, 122],
    hardness: 3
  },
  {
    id: BlockIds.GLASS,
    name: 'Glass',
    label: 'Vidrio',
    description: 'Material transparente fabricado con arena que sirve para hacer ventanas luminosas.',
    syllables: ['VI', 'DRIO'],
    syllableText: 'VI - DRIO',
    solid: true,
    transparent: true,
    texture: 'glass.png',
    color: [170, 218, 230],
    hardness: 0.3,
    starter: true
  },
  {
    id: BlockIds.SANDSTONE,
    name: 'Sandstone',
    label: 'Arenisca',
    description: 'Roca sedimentaria formada por arena compactada; típica de desiertos y playas.',
    syllables: ['A', 'RE', 'NIS', 'CA'],
    syllableText: 'A - RE - NIS - CA',
    texture: 'sandstone.png',
    color: [212, 184, 122],
    hardness: 2.5,
    isOpaque: true,
    isBreakable: true,
    carvable: true
  },
  {
    id: BlockIds.BEDROCK,
    name: 'Bedrock',
    label: 'Roca madre',
    description: 'Capa más profunda del mundo; indestructible.',
    syllables: ['RO', 'CA', 'MA', 'DRE'],
    syllableText: 'RO - CA - MA - DRE',
    texture: 'bedrock.png',
    color: [62, 62, 66],
    hardness: Infinity,
    isOpaque: true,
    isBreakable: false,
    drops: []
  },
  {
    id: BlockIds.COAL_ORE,
    name: 'CoalOre',
    label: 'Mineral de carbon',
    description: 'Roca con vetas negras de carbón que sirve como combustible para dar calor y luz.',
    syllables: ['MI', 'NE', 'RAL', 'DE', 'CAR', 'BON'],
    syllableText: 'MI - NE - RAL - DE - CAR - BON',
    texture: 'coal_ore.png',
    color: [96, 96, 100],
    hardness: 3.5,
    isOpaque: true,
    isBreakable: true,
    drops: [BlockIds.COAL_ORE],
    carvable: true
  },
  {
    id: BlockIds.IRON_ORE,
    name: 'IronOre',
    label: 'Mineral de hierro',
    description: 'Roca con vetas de metal resistente usado para fabricar herramientas fuertes.',
    syllables: ['MI', 'NE', 'RAL', 'DE', 'HIE', 'RRO'],
    syllableText: 'MI - NE - RAL - DE - HIE - RRO',
    texture: 'iron_ore.png',
    color: [148, 132, 118],
    hardness: 4.5,
    isOpaque: true,
    isBreakable: true,
    drops: [BlockIds.IRON_ORE],
    carvable: true
  },
  {
    id: BlockIds.GOLD_ORE,
    name: 'GoldOre',
    label: 'Mineral de oro',
    description: 'Roca profunda con vetas de metal amarillo brillante y muy valioso.',
    syllables: ['MI', 'NE', 'RAL', 'DE', 'O', 'RO'],
    syllableText: 'MI - NE - RAL - DE - O - RO',
    texture: 'gold_ore.png',
    color: [170, 156, 96],
    hardness: 5.5,
    isOpaque: true,
    isBreakable: true,
    drops: [BlockIds.GOLD_ORE],
    carvable: true
  },
  {
    id: BlockIds.DIAMOND_ORE,
    name: 'DiamondOre',
    label: 'Mineral de diamante',
    description: 'Roca de gran profundidad que guarda cristales celestes de enorme dureza.',
    syllables: ['MI', 'NE', 'RAL', 'DE', 'DIA', 'MAN', 'TE'],
    syllableText: 'MI - NE - RAL - DE - DIA - MAN - TE',
    texture: 'diamond_ore.png',
    color: [112, 164, 166],
    hardness: 6,
    isOpaque: true,
    isBreakable: true,
    drops: [BlockIds.DIAMOND_ORE],
    carvable: true
  }
];

export function createDefaultBlockRegistry() {
  const registry = new BlockRegistry();
  registry.registerAll(DEFAULT_BLOCK_DEFINITIONS);
  return registry;
}
