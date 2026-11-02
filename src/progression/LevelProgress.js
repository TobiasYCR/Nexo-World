import { GameConfig } from '../game/GameConfig.js';
import { LevelRules } from './LevelRules.js';

/**
 * Estado derivado de nivel. Mantiene el mayor valor de experiencia observado
 * durante la sesión para que quitar una construcción nunca baje el nivel.
 * La recuperación inicial es silenciosa y vuelve a calcularse desde stats.
 */
export class LevelProgress {
  #experience = 0;
  #level = 1;

  constructor(rules = new LevelRules(GameConfig.levels)) {
    this.rules = rules;
  }

  /** Recupera el nivel desde un estado guardado sin producir eventos. */
  load(stats = {}) {
    this.#experience = this.rules.experienceFromStats(stats);
    this.#level = this.rules.levelForExperience(this.#experience);
    return this.snapshot();
  }

  /**
   * Actualiza el nivel después de una acción válida.
   * @returns {{level:number, previousLevel:number}[]} un evento por nivel cruzado
   */
  update(stats = {}) {
    const calculated = this.rules.experienceFromStats(stats);
    const previousLevel = this.#level;
    this.#experience = Math.max(this.#experience, calculated);
    const nextLevel = this.rules.levelForExperience(this.#experience);
    this.#level = Math.max(this.#level, nextLevel);

    const levelUps = [];
    for (let level = previousLevel + 1; level <= this.#level; level += 1) {
      levelUps.push({ level, previousLevel: level - 1 });
    }
    return levelUps;
  }

  get level() {
    return this.#level;
  }

  get experience() {
    return this.#experience;
  }

  get experienceForNextLevel() {
    return this.rules.experienceForNextLevel(this.#experience);
  }

  get levelProgress() {
    return this.rules.levelProgress(this.#experience);
  }

  get isMaxLevel() {
    return this.rules.isMaxLevel(this.#level);
  }

  snapshot() {
    return Object.freeze({
      level: this.level,
      experience: this.experience,
      experienceForNextLevel: this.experienceForNextLevel,
      levelProgress: this.levelProgress,
      isMaxLevel: this.isMaxLevel
    });
  }
}
