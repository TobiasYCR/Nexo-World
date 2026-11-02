import { ScoreRules } from './ScoreRules.js';

/**
 * Contrasta un ProgressState con el mundo natural que lo originó. Rechaza lo
 * que no pudo pasar en ese mundo: celdas inexistentes, biomas que el mundo no
 * tiene o minerales en posiciones donde el generador no puso ese mineral.
 *
 * Limita lo inventado, pero no prueba que el jugador haya hecho cada acción:
 * con el cliente como única fuente, el máximo alcanzable sigue siendo el
 * máximo natural del mundo.
 */
export class ProgressValidator {
  /**
   * @param {ScoreRules} [rules]
   */
  constructor(rules = new ScoreRules()) {
    this.rules = rules;
  }

  /**
   * @param {import('./ProgressState.js').ProgressState} state
   * @param {import('../world/NaturalTerrain.js').NaturalTerrain} terrain
   * @returns {{ok:boolean, detail?:string}}
   */
  validate(state, terrain) {
    const cellCount = this.rules.explorationCellCount(terrain.width, terrain.depth);
    for (const cell of state.exploredCells()) {
      if (cell >= cellCount) return { ok: false, detail: `celda de exploración ${cell} fuera del mundo` };
    }

    const worldBiomes = terrain.biomeIds();
    for (const biome of state.biomes()) {
      if (!worldBiomes.has(biome)) return { ok: false, detail: `el bioma ${biome} no existe en este mundo` };
    }

    for (const [blockId, indices] of state.minedPositions()) {
      if (!this.rules.isScoringOre(blockId)) return { ok: false, detail: `el bloque ${blockId} no es un mineral que puntúe` };
      for (const index of indices) {
        if (index >= terrain.cellCount) return { ok: false, detail: `posición ${index} fuera del mundo` };
        const { x, y, z } = terrain.positionOf(index);
        if (terrain.blockIdAt(x, y, z) !== blockId) {
          return { ok: false, detail: `en ${x},${y},${z} no había el mineral ${blockId}` };
        }
      }
    }

    if (state.blocksBuilt > terrain.cellCount) return { ok: false, detail: 'más construcciones que celdas en el mundo' };
    return { ok: true };
  }
}
