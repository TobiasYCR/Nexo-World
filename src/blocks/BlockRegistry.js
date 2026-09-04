import { BlockType } from './BlockType.js';
import { BlockIds } from '../utils/Constants.js';

/**
 * Catálogo central de tipos de bloque. Es el único lugar donde se declaran
 * propiedades por tipo: el resto del código consulta el registro en vez de
 * comparar ids a mano, de modo que agregar un bloque nuevo es una sola entrada.
 */
export class BlockRegistry {
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

  /** Nombres de textura únicos, para que TextureManager sepa qué precargar. */
  textureNames() {
    return [...new Set(this.values().map((type) => type.texture).filter(Boolean))];
  }
}

/** Definiciones base de Nexo World. Para sumar un bloque, agregar acá su entrada. */
const DEFAULT_BLOCK_DEFINITIONS = [
  { id: BlockIds.AIR, name: 'Air', solid: false, transparent: true, texture: null, color: [0, 0, 0], breakable: false },
  { id: BlockIds.GRASS, name: 'Grass', solid: true, texture: 'grass.png', color: [106, 170, 80], hardness: 1 },
  { id: BlockIds.DIRT, name: 'Dirt', solid: true, texture: 'dirt.png', color: [134, 96, 67], hardness: 1 },
  { id: BlockIds.STONE, name: 'Stone', solid: true, texture: 'stone.png', color: [128, 128, 132], hardness: 3 }
];

export function createDefaultBlockRegistry() {
  const registry = new BlockRegistry();
  registry.registerAll(DEFAULT_BLOCK_DEFINITIONS);
  return registry;
}
