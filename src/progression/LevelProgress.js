import { GameConfig } from '../game/GameConfig.js';
import { LevelRules } from './LevelRules.js';

/**
 * Estado derivado de niveles. Mantiene la experiencia alcanzada como un
 * máximo: quitar una construcción puede reducir los puntos, pero nunca hace
 * retroceder el nivel del jugador.
 */
export class LevelProgress {
  #experience = 0;
  #level = 1;

  constructor(rules = new LevelRules(GameConfig.levels)) {
    this.rules = rules;
  }

  /** Inicializa desde un guardado sin producir eventos de subida. */
  load(stats = {}) {
    this.#experience = this.rules.experienceFromStats(stats);
    this.#level = this.rules.levelForExperience(this.#experience);
    return this.snapshot();
  }

  /**
   * Recalcula desde las estadísticas y devuelve las subidas nuevas. La lista
   * permite emitir un evento por nivel cuando una acción cruza varios umbrales.
   */
  update(stats = {}) {
    const nextExperience = this.rules.experienceFromStats(stats);
    const previousLevel = this.#level;
    this.#experience = Math.max(this.#experience, nextExperience);
    this.#level = this.rules.levelForExperience(this.#experience);

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
