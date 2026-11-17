import { createDefaultBlockRegistry } from './BlockRegistry.js';

/** Grupos del catálogo educativo, en el orden en que se muestran. */
export const MATERIAL_CATEGORIES = Object.freeze(['stones', 'woods']);

/**
 * Catálogo educativo de materiales: piedras y maderas. Cada material es un
 * bloque real del registro (con su id, su textura y su descripción), así lo
 * que se ve en el inventario es exactamente lo que se coloca en el mundo.
 * @param {import('./BlockRegistry.js').BlockRegistry} [blockRegistry]
 * @returns {ReadonlyArray<import('./BlockType.js').BlockType>}
 */
export function createEducationalMaterials(blockRegistry = createDefaultBlockRegistry()) {
  return Object.freeze(MATERIAL_CATEGORIES.flatMap((category) => blockRegistry.typesInCategory(category)));
}
