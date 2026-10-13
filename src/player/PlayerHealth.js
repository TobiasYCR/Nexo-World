import { GameConfig } from '../game/GameConfig.js';
import { GameEventTypes } from '../game/GameEvents.js';

/** Causas de daño conocidas, para que la interfaz pueda distinguir efectos. */
export const DamageCauses = Object.freeze({
  FALL: 'fall',
  VOID: 'void'
});

/**
 * Salud del jugador. Solo administra puntos de vida y avisa los cambios por
 * GameEvents: no mueve al jugador, no conoce el mundo ni decide la reaparición
 * (eso lo orquesta Game). Una muerte emite playerDied exactamente una vez,
 * hasta que reset() la vuelve a habilitar.
 */
export class PlayerHealth {
  #current;
  #dead = false;

  /**
   * @param {object} [config] GameConfig.survival
   * @param {import('../game/GameEvents.js').GameEvents|null} [events]
   */
  constructor(config = GameConfig.survival, events = null) {
    this.config = config;
    this.events = events;
    this.#current = config.MAX_HEALTH;
  }

  get current() {
    return this.#current;
  }

  get max() {
    return this.config.MAX_HEALTH;
  }

  get isDead() {
    return this.#dead;
  }

  /**
   * Daño por caída para una velocidad vertical de impacto, en unidades/s.
   * Por debajo del umbral no hay daño: saltar o bajar un escalón es gratis.
   */
  static fallDamageFor(impactSpeed, config = GameConfig.survival) {
    if (!(impactSpeed > config.FALL_DAMAGE_THRESHOLD)) return 0;
    return Math.ceil((impactSpeed - config.FALL_DAMAGE_THRESHOLD) * config.FALL_DAMAGE_MULTIPLIER);
  }

  /** @returns {number} daño aplicado por el aterrizaje */
  applyFallImpact(impactSpeed) {
    return this.damage(PlayerHealth.fallDamageFor(impactSpeed, this.config), DamageCauses.FALL);
  }

  /**
   * Resta vida y emite playerDamaged; si llega a cero, emite playerDied.
   * @returns {number} daño efectivamente aplicado (0 si ya estaba muerto)
   */
  damage(amount, cause) {
    if (this.#dead || !(amount > 0)) return 0;
    const applied = Math.min(amount, this.#current);
    this.#current -= applied;
    this.events?.emit(GameEventTypes.PLAYER_DAMAGED, {
      amount: applied,
      cause,
      health: this.#current,
      maxHealth: this.max
    });
    if (this.#current <= 0) {
      this.#dead = true;
      this.events?.emit(GameEventTypes.PLAYER_DIED, { cause });
    }
    return applied;
  }

  /** Muerte inmediata (caída al vacío). No hace nada si ya estaba muerto. */
  kill(cause) {
    return this.damage(this.#current, cause) > 0;
  }

  /** Vida completa y muerte rehabilitada; lo llama Game al reaparecer. */
  reset() {
    this.#current = this.max;
    this.#dead = false;
  }
}
