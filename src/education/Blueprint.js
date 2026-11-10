/**
 * Plano inmutable de un desafío. Solo describe bloques relativos: no conoce
 * el mundo, el jugador ni cómo se dibuja.
 */
export class Blueprint {
  constructor({ id, name, description, blocks }, blockRegistry, maxBlocks = Infinity) {
    if (!id || typeof id !== 'string') throw new TypeError('Blueprint requiere un id.');
    if (!name || typeof name !== 'string') throw new TypeError(`Blueprint "${id}" requiere un nombre.`);
    if (!Array.isArray(blocks) || blocks.length === 0) {
      throw new TypeError(`Blueprint "${id}" requiere al menos un bloque.`);
    }
    if (blocks.length > maxBlocks) {
      throw new RangeError(`Blueprint "${id}" supera el máximo de ${maxBlocks} bloques.`);
    }

    const positions = new Set();
    const normalized = blocks.map((block, index) => {
      const { x, y, z, blockId, stage = 0 } = block ?? {};
      if (![x, y, z].every(Number.isInteger) || y < 0) {
        throw new TypeError(`Blueprint "${id}": posición inválida en el bloque ${index}.`);
      }
      if (!Number.isInteger(stage) || stage < 0) {
        throw new TypeError(`Blueprint "${id}": etapa inválida en el bloque ${index}.`);
      }
      const key = `${x},${y},${z}`;
      if (positions.has(key)) {
        throw new Error(`Blueprint "${id}": posición repetida (${key}).`);
      }
      positions.add(key);
      if (!Number.isInteger(blockId) || !blockRegistry?.has(blockId)) {
        throw new RangeError(`Blueprint "${id}": tipo de bloque inexistente en (${key}).`);
      }
      return Object.freeze({ x, y, z, blockId, stage });
    });

    const bounds = Blueprint.#bounds(normalized);
    this.id = id;
    this.name = name;
    this.description = description ?? '';
    this.blocks = Object.freeze(normalized);
    this.size = Object.freeze({
      x: bounds.maxX - bounds.minX + 1,
      y: bounds.maxY - bounds.minY + 1,
      z: bounds.maxZ - bounds.minZ + 1
    });
    this.materials = Object.freeze(Blueprint.#materials(normalized, blockRegistry));
    Object.freeze(this);
  }

  /**
   * Rota el plano alrededor de Y en cuartos de vuelta y normaliza el mínimo a
   * cero, para que cualquier orientación pueda ubicarse con un solo ancla.
   */
  rotated(rotation = 0) {
    const quarterTurns = Blueprint.normalizeRotation(rotation);
    const rotated = this.blocks.map((block) => {
      let x = block.x;
      let z = block.z;
      for (let turn = 0; turn < quarterTurns; turn += 1) {
        [x, z] = [z, -x];
      }
      return { x, y: block.y, z, blockId: block.blockId, stage: block.stage };
    });
    const bounds = Blueprint.#bounds(rotated);
    return Object.freeze(rotated.map((block) => Object.freeze({
      ...block,
      x: block.x - bounds.minX,
      z: block.z - bounds.minZ
    })));
  }

  rotatedSize(rotation = 0) {
    const blocks = this.rotated(rotation);
    const bounds = Blueprint.#bounds(blocks);
    return Object.freeze({
      x: bounds.maxX - bounds.minX + 1,
      y: this.size.y,
      z: bounds.maxZ - bounds.minZ + 1
    });
  }

  toSummary() {
    return {
      id: this.id,
      name: this.name,
      description: this.description,
      size: { ...this.size },
      materials: this.materials.map((material) => ({ ...material }))
    };
  }

  static normalizeRotation(rotation) {
    if (!Number.isInteger(rotation)) throw new TypeError('La rotación del plano debe ser un entero.');
    return ((rotation % 4) + 4) % 4;
  }

  static #bounds(blocks) {
    return blocks.reduce((bounds, block) => ({
      minX: Math.min(bounds.minX, block.x),
      maxX: Math.max(bounds.maxX, block.x),
      minY: Math.min(bounds.minY, block.y),
      maxY: Math.max(bounds.maxY, block.y),
      minZ: Math.min(bounds.minZ, block.z),
      maxZ: Math.max(bounds.maxZ, block.z)
    }), {
      minX: Infinity,
      maxX: -Infinity,
      minY: Infinity,
      maxY: -Infinity,
      minZ: Infinity,
      maxZ: -Infinity
    });
  }

  static #materials(blocks, blockRegistry) {
    const counts = new Map();
    for (const block of blocks) counts.set(block.blockId, (counts.get(block.blockId) ?? 0) + 1);
    return [...counts.entries()]
      .map(([blockId, required]) => ({
        blockId,
        name: blockRegistry.get(blockId).label,
        required
      }))
      .sort((first, second) => first.blockId - second.blockId);
  }
}
