import { GameConfig } from '../game/GameConfig.js';

/**
 * Reglas puras de experiencia y niveles. No conoce el juego, la persistencia
 * ni la interfaz: recibe estadísticas y devuelve valores derivados.
 */
export class LevelRules {
  constructor(config = GameConfig.levels) {
    this.config = config;
    if (!Number.isFinite(config.BASE_XP) || config.BASE_XP <= 0) {
      throw new RangeError('BASE_XP debe ser mayor que cero.');
    }
    if (!Number.isFinite(config.GROWTH) || config.GROWTH < 1) {
      throw new RangeError('GROWTH debe ser mayor o igual que uno.');
    }
    if (config.MAX_LEVEL !== null && config.MAX_LEVEL !== Infinity
      && (!Number.isInteger(config.MAX_LEVEL) || config.MAX_LEVEL < 1)) {
      throw new RangeError('MAX_LEVEL debe ser nulo, infinito o un entero positivo.');
    }
  }

  /** Calcula experiencia únicamente desde las estadísticas persistidas. */
  experienceFromStats(stats = {}) {
    const exploredCells = this.#nonNegativeCount(stats.exploredCells);
    const biomesDiscovered = this.#nonNegativeCount(stats.biomesDiscovered);
    const blocksBuilt = this.#nonNegativeCount(stats.blocksBuilt);
    const oresMined = stats.oresMined && typeof stats.oresMined === 'object' ? stats.oresMined : {};
    const oreCount = Object.values(oresMined).reduce(
      (total, count) => total + this.#nonNegativeCount(count),
      0
    );

    return exploredCells * this.config.XP_EXPLORATION_CELL +
      biomesDiscovered * this.config.XP_BIOME +
      oreCount * this.config.XP_ORES +
      blocksBuilt * this.config.XP_BLOCK_BUILT;
  }

  xpFromStats(stats = {}) {
    return this.experienceFromStats(stats);
  }

  experienceForStats(stats = {}) {
    return this.experienceFromStats(stats);
  }

  experienceOf(stats = {}) {
    return this.experienceFromStats(stats);
  }

  /** Experiencia acumulada necesaria para comenzar un nivel. El nivel 1 empieza en cero. */
  experienceForLevel(level) {
    const boundedLevel = Math.max(1, Math.floor(Number(level) || 1));
    let required = 0;
    for (let current = 2; current <= boundedLevel; current += 1) {
      required += Math.ceil(this.config.BASE_XP * this.config.GROWTH ** (current - 2));
    }
    return required;
  }

  experienceForLevelStep(level) {
    const currentLevel = Math.max(1, Math.floor(Number(level) || 1));
    return Math.ceil(this.config.BASE_XP * this.config.GROWTH ** (currentLevel - 1));
  }

  levelForExperience(experience) {
    const value = Math.max(0, Number.isFinite(experience) ? experience : 0);
    let level = 1;
    while ((this.maxLevel === null || level < this.maxLevel) && value >= this.experienceForLevel(level + 1)) level += 1;
    return level;
  }

  /** Umbral absoluto del nivel siguiente; en el máximo devuelve la experiencia actual. */
  experienceForNextLevel(experience) {
    const level = this.levelForExperience(experience);
    return this.isMaxLevel(level) ? Math.max(0, experience) : this.experienceForLevel(level + 1);
  }

  experienceToNextLevel(experience) {
    const next = this.experienceForNextLevel(experience);
    return Math.max(0, next - Math.max(0, experience));
  }

  /** Progreso dentro del tramo actual, siempre acotado a [0, 1]. */
  levelProgress(experience) {
    const value = Math.max(0, Number.isFinite(experience) ? experience : 0);
    const level = this.levelForExperience(value);
    if (this.isMaxLevel(level)) return 1;
    const start = this.experienceForLevel(level);
    const end = this.experienceForLevel(level + 1);
    return Math.min(1, Math.max(0, (value - start) / (end - start)));
  }

  isMaxLevel(level) {
    return this.maxLevel !== null && level >= this.maxLevel;
  }

  get maxLevel() {
    return this.config.MAX_LEVEL === null || this.config.MAX_LEVEL === Infinity
      ? null
      : Math.max(1, Math.floor(this.config.MAX_LEVEL));
  }

  #nonNegativeCount(value) {
    return Number.isFinite(value) ? Math.max(0, value) : 0;
  }
}
