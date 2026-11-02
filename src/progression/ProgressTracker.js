import { GameEventTypes } from '../game/GameEvents.js';
import { ProgressState } from './ProgressState.js';

/** Motivos de cambio de puntuación, para que la interfaz elija el feedback. */
export const ScoreReasons = Object.freeze({
  EXPLORATION: 'exploration',
  BIOME: 'biome',
  ORE: 'ore',
  BUILD: 'build',
  BUILD_REMOVED: 'build-removed'
});

/**
 * Traduce acciones válidas del juego en hechos de progreso. Escucha los mismos
 * eventos que ya emite BlockInteraction (blockBroken, blockPlaced), así que
 * solo cuenta acciones que las reglas del juego confirmaron; nunca lee la
 * interfaz. Las posiciones del jugador las recibe de Game.
 *
 * Contra el abuso de colocar y romper:
 *   - Un mineral solo puntúa si en esa posición el generador había puesto ese
 *     mismo mineral (NaturalTerrain), y una sola vez por posición.
 *   - Construir suma 1 y quitar algo construido resta 1: el saldo de repetir
 *     colocar/romper es siempre cero.
 */
export class ProgressTracker {
  #state = new ProgressState();
  #lastCell = -1;
  #unsubscribers = [];

  /**
   * @param {import('../world/NaturalTerrain.js').NaturalTerrain} terrain
   * @param {import('./ScoreRules.js').ScoreRules} rules
   * @param {(change: {delta:number, reason:string}) => void} [onChange]
   */
  constructor(terrain, rules, onChange = () => {}) {
    this.terrain = terrain;
    this.rules = rules;
    this.onChange = onChange;
  }

  get state() {
    return this.#state;
  }

  /** Reemplaza el estado (al recuperar progreso guardado). */
  load(state) {
    this.#state = state;
    this.#lastCell = -1;
  }

  get score() {
    return this.rules.scoreOf(this.#state.stats());
  }

  /** Se suscribe una sola vez: volver a llamar no duplica recompensas. */
  attach(events) {
    if (this.#unsubscribers.length > 0) return;
    this.#unsubscribers.push(
      events.on(GameEventTypes.BLOCK_BROKEN, (payload) => this.onBlockBroken(payload)),
      events.on(GameEventTypes.BLOCK_PLACED, (payload) => this.onBlockPlaced(payload))
    );
  }

  detach() {
    for (const unsubscribe of this.#unsubscribers) unsubscribe();
    this.#unsubscribers = [];
  }

  /** Registra exploración y biomas a partir de la columna donde está el jugador. */
  observePosition(blockX, blockZ) {
    if (blockX < 0 || blockZ < 0 || blockX >= this.terrain.width || blockZ >= this.terrain.depth) return;
    const points = this.rules.config.POINTS;

    const cell = this.rules.explorationCellOf(blockX, blockZ, this.terrain.width);
    if (cell !== this.#lastCell) {
      this.#lastCell = cell;
      if (this.#state.markExplored(cell)) this.#notify(points.EXPLORATION_CELL, ScoreReasons.EXPLORATION);
    }

    const biome = this.terrain.biomeIdAt(blockX, blockZ);
    if (biome >= 0 && this.#state.markBiome(biome)) this.#notify(points.BIOME_DISCOVERED, ScoreReasons.BIOME);
  }

  onBlockBroken({ position, blockType }) {
    const { x, y, z } = position;
    const natural = this.terrain.blockIdAt(x, y, z);
    if (natural === blockType.id) {
      if (!this.rules.isScoringOre(blockType.id)) return;
      if (this.#state.markMined(blockType.id, this.terrain.indexOf(x, y, z))) {
        this.#notify(this.rules.pointsForOre(blockType.id), ScoreReasons.ORE);
      }
      return;
    }
    // No es lo que dejó el generador: lo puso el jugador. Quitarlo descuenta la construcción.
    const before = this.score;
    if (this.#state.addBuilt(-1) !== 0) this.#notify(this.score - before, ScoreReasons.BUILD_REMOVED);
  }

  onBlockPlaced({ position, blockType }) {
    const { x, y, z } = position;
    // Restaurar el bloque original de una celda no es construir.
    if (this.terrain.blockIdAt(x, y, z) === blockType.id) return;
    const before = this.score;
    this.#state.addBuilt(1);
    this.#notify(this.score - before, ScoreReasons.BUILD);
  }

  /** Los cambios de 0 puntos (tope de construcción alcanzado) igual se informan: el estado cambió. */
  #notify(delta, reason) {
    this.onChange({ delta, reason });
  }
}
