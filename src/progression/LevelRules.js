import { GameConfig } from '../game/GameConfig.js';

/**
 * Reglas puras de experiencia y niveles. La experiencia no es una segunda
 * puntuación: usa pesos propios y se calcula a partir de los hechos que ya
 * conserva ProgressState.
 */
export class LevelRules {
  constructor(config = GameConfig.levels) {
    this.config = config;
    this.#validateConfig();
  }

  /** Experiencia total derivada del estado de progreso actual. */
  experienceFromStats(stats = {}) {
    const ores = Object.values(stats.oresMined ?? {}).reduce(
      (total, count) => total + Math.max(0, Number(count) || 0),
      0
    );
    const exploredCells = Math.max(0, Number(stats.exploredCells) || 0);
    const biomesDiscovered = Math.max(0, Number(stats.biomesDiscovered) || 0);
    const blocksBuilt = Math.max(0, Number(stats.blocksBuilt) || 0);

    return exploredCells * this.config.XP_EXPLORATION_CELL
      + biomesDiscovered * this.config.XP_BIOME
      + ores * this.config.XP_ORES
      + blocksBuilt * this.config.XP_BLOCK_BUILT;
  }

  /** Alias explícito para consumidores que hablan de XP en vez de experiencia. */
  xpFromStats(stats = {}) {
    return this.experienceFromStats(stats);
  }

  experienceForStats(stats = {}) {
    return this.experienceFromStats(stats);
  }

  experienceOf(stats = {}) {
    return this.experienceFromStats(stats);
  }

  /** Experiencia acumulada necesaria para alcanzar un nivel. El nivel inicial es 1. */
  experienceForLevel(level) {
    const targetLevel = Math.max(1, Math.floor(Number(level) || 1));
    let total = 0;
    for (let current = 1; current < targetLevel; current += 1) {
      total += this.experienceForLevelStep(current);
    }
    return total;
  }

  /** XP necesaria para pasar del nivel indicado al siguiente. */
  experienceForLevelStep(level) {
    const currentLevel = Math.max(1, Math.floor(Number(level) || 1));
    return Math.ceil(this.config.BASE_XP * this.config.GROWTH ** (currentLevel - 1));
  }

  /** Nivel correspondiente a una cantidad de experiencia, respetando el tope. */
  levelForExperience(experience = 0) {
    const xp = Math.max(0, Number(experience) || 0);
    const maxLevel = this.maxLevel;
    let level = 1;
    while ((maxLevel === null || level < maxLevel) && xp >= this.experienceForLevel(level + 1)) level += 1;
    return level;
  }

  levelAt(experience = 0) {
    return this.levelForExperience(experience);
  }

  /** Umbral acumulado del siguiente nivel; en el máximo devuelve la XP actual. */
  experienceForNextLevel(experience = 0) {
    const xp = Math.max(0, Number(experience) || 0);
    const level = this.levelForExperience(xp);
    return this.isMaxLevel(level) ? xp : this.experienceForLevel(level + 1);
  }

  /** XP restante hasta el siguiente nivel. */
  experienceToNextLevel(experience = 0) {
    return Math.max(0, this.experienceForNextLevel(experience) - Math.max(0, Number(experience) || 0));
  }

  /** Progreso del nivel actual en el intervalo [0, 1]. */
  levelProgress(experience = 0) {
    const xp = Math.max(0, Number(experience) || 0);
    const level = this.levelForExperience(xp);
    if (this.isMaxLevel(level)) return 1;

    const currentThreshold = this.experienceForLevel(level);
    const nextThreshold = this.experienceForLevel(level + 1);
    return Math.min(1, Math.max(0, (xp - currentThreshold) / (nextThreshold - currentThreshold)));
  }

  progressFor(experience = 0) {
    return this.levelProgress(experience);
  }

  get maxLevel() {
    return this.config.MAX_LEVEL === null || this.config.MAX_LEVEL === Infinity
      ? null
      : Math.max(1, Math.floor(this.config.MAX_LEVEL));
  }

  isMaxLevel(level) {
    return this.maxLevel !== null && level >= this.maxLevel;
  }

  #validateConfig() {
    if (!(this.config.BASE_XP > 0) || !(this.config.GROWTH >= 1)) {
      throw new RangeError('LevelRules requiere BASE_XP positivo y GROWTH mayor o igual a 1.');
    }
    if (this.config.MAX_LEVEL !== null && this.config.MAX_LEVEL !== Infinity
      && (!Number.isSafeInteger(this.config.MAX_LEVEL) || this.config.MAX_LEVEL < 1)) {
      throw new RangeError('LevelRules requiere MAX_LEVEL nulo o un entero positivo.');
    }
  }
}
