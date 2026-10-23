import { GameConfig } from '../game/GameConfig.js';

/**
 * Reglas de puntuación centralizadas. Traduce estadísticas de progreso en
 * puntos usando solo GameConfig.progression: no hay valores en otro lado.
 * Es código puro (sin DOM ni red) para que el juego y el servidor calculen
 * exactamente lo mismo.
 */
export class ScoreRules {
  constructor(config = GameConfig.progression) {
    this.config = config;
  }

  /** Puntos que da un mineral natural; 0 si el bloque no puntúa. */
  pointsForOre(blockId) {
    return this.config.POINTS.ORES[blockId] ?? 0;
  }

  isScoringOre(blockId) {
    return this.pointsForOre(blockId) > 0;
  }

  /** Celda de exploración de una columna, para un mundo del ancho dado. */
  explorationCellOf(blockX, blockZ, worldWidth) {
    const size = this.config.EXPLORATION_CELL_SIZE;
    const cellsX = Math.ceil(worldWidth / size);
    return Math.floor(blockZ / size) * cellsX + Math.floor(blockX / size);
  }

  explorationCellCount(worldWidth, worldDepth) {
    const size = this.config.EXPLORATION_CELL_SIZE;
    return Math.ceil(worldWidth / size) * Math.ceil(worldDepth / size);
  }

  /** Construcciones que efectivamente puntúan (con tope). */
  countedBlocksBuilt(blocksBuilt) {
    return Math.min(blocksBuilt, this.config.MAX_BLOCKS_BUILT_COUNTED);
  }

  /**
   * @param {{exploredCells:number, biomesDiscovered:number, oresMined:Object<string,number>, blocksBuilt:number}} stats
   * @returns {{exploration:number, biomes:number, mining:number, building:number, total:number}}
   */
  breakdown(stats) {
    const points = this.config.POINTS;
    const exploration = stats.exploredCells * points.EXPLORATION_CELL;
    const biomes = stats.biomesDiscovered * points.BIOME_DISCOVERED;
    let mining = 0;
    for (const [blockId, count] of Object.entries(stats.oresMined)) mining += this.pointsForOre(Number(blockId)) * count;
    const building = this.countedBlocksBuilt(stats.blocksBuilt) * points.BLOCK_BUILT;
    return { exploration, biomes, mining, building, total: exploration + biomes + mining + building };
  }

  scoreOf(stats) {
    return this.breakdown(stats).total;
  }

  isValidMode(mode) {
    return this.config.MODES.includes(mode);
  }
}
