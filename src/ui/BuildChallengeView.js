import { resolveBlockSyllables } from '../blocks/BlockType.js';

const DIFFICULTY_LABELS = Object.freeze(['Fácil', 'Media', 'Difícil']);

/**
 * Traduce los datos del desafío de construcción (BuildChallenge, en
 * src/education) a lo que muestran PresetsScreen y BuildChallengeHUD: nombres
 * con sílabas, textura y color de cada material, cantidades colocadas y
 * faltantes.
 *
 * Las reglas (planos, ubicación, verificación) viven en un solo lugar,
 * BuildChallenge; la interfaz solo presenta.
 */
export class BuildChallengeView {
  /**
   * @param {import('../blocks/BlockRegistry.js').BlockRegistry} blockRegistry
   */
  constructor(blockRegistry) {
    this.blockRegistry = blockRegistry;
  }

  /**
   * Planos para la pantalla de selección. La dificultad sale del orden del
   * registro, que lista los planos de menor a mayor.
   * @param {ReadonlyArray<{id:string, name:string, description:string, materials:Array<{blockId:number, required:number}>}>} summaries
   */
  presets(summaries) {
    return Object.freeze((summaries ?? []).map((summary, index) => {
      const materials = summary.materials.map((material) => this.#material(material.blockId, { count: material.required }));
      return Object.freeze({
        id: summary.id,
        name: summary.name,
        description: summary.description,
        difficulty: DIFFICULTY_LABELS[Math.min(index, DIFFICULTY_LABELS.length - 1)],
        totalBlocks: materials.reduce((total, material) => total + material.count, 0),
        materials: Object.freeze(materials)
      });
    }));
  }

  /**
   * Estado del desafío activo para el HUD, o null si no hay.
   * @param {ReturnType<import('../education/BuildChallenge.js').BuildChallenge['snapshot']>|null} snapshot
   */
  challenge(snapshot) {
    if (!snapshot) return null;
    const materials = snapshot.materials.map((material) => this.#material(material.blockId, {
      count: material.required,
      placed: material.placed,
      remaining: Math.max(0, material.required - material.placed)
    }));

    let nextBlock = null;
    if (snapshot.nextBlock) {
      const material = materials.find((item) => item.blockId === snapshot.nextBlock.blockId);
      nextBlock = {
        ...this.#material(snapshot.nextBlock.blockId),
        count: material?.remaining ?? 1,
        remaining: material?.remaining ?? 1,
        position: snapshot.nextBlock.position ? { ...snapshot.nextBlock.position } : null
      };
    }

    return Object.freeze({
      id: snapshot.blueprintId,
      name: snapshot.name,
      totalBlocks: snapshot.total,
      placedBlocks: snapshot.placed,
      remainingBlocks: Math.max(0, snapshot.total - snapshot.placed),
      wrongBlocks: snapshot.wrong,
      progress: snapshot.progress,
      completed: snapshot.completed,
      materials,
      nextBlock
    });
  }

  #material(blockId, extra = {}) {
    const blockType = this.blockRegistry.get(blockId);
    const { syllables, syllableText } = resolveBlockSyllables(blockType);
    return {
      blockId,
      name: blockType.name,
      label: blockType.label,
      syllables,
      syllableText,
      texture: blockType.textures?.top || blockType.texture || null,
      color: blockType.color,
      ...extra
    };
  }
}
