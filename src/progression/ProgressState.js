/**
 * Progreso de un jugador en un mundo y modo concretos. Guarda HECHOS, no puntos:
 * qué celdas exploró, qué biomas pisó, qué minerales naturales extrajo (por
 * posición) y cuántos bloques construidos tiene en pie. La puntuación se
 * calcula siempre a partir de esto con ScoreRules, en el cliente y en el
 * servidor, así que nunca se confía en un número de puntos enviado.
 *
 * Los conjuntos solo crecen: una posición ya recompensada no vuelve a contar.
 */
export class ProgressState {
  static VERSION = 1;

  #explored;
  #biomes;
  #mined;
  #blocksBuilt;

  constructor({ explored = [], biomes = [], mined = {}, blocksBuilt = 0 } = {}) {
    this.#explored = new Set(explored);
    this.#biomes = new Set(biomes);
    this.#mined = new Map();
    for (const [blockId, indices] of Object.entries(mined)) this.#mined.set(Number(blockId), new Set(indices));
    this.#blocksBuilt = Math.max(0, blocksBuilt);
  }

  hasExplored(cell) {
    return this.#explored.has(cell);
  }

  /** @returns {boolean} true si la celda era nueva */
  markExplored(cell) {
    if (this.#explored.has(cell)) return false;
    this.#explored.add(cell);
    return true;
  }

  hasBiome(biomeId) {
    return this.#biomes.has(biomeId);
  }

  markBiome(biomeId) {
    if (this.#biomes.has(biomeId)) return false;
    this.#biomes.add(biomeId);
    return true;
  }

  /** True si la posición ya dio puntos por cualquier mineral. */
  hasMined(index) {
    for (const indices of this.#mined.values()) if (indices.has(index)) return true;
    return false;
  }

  markMined(blockId, index) {
    if (this.hasMined(index)) return false;
    if (!this.#mined.has(blockId)) this.#mined.set(blockId, new Set());
    this.#mined.get(blockId).add(index);
    return true;
  }

  get blocksBuilt() {
    return this.#blocksBuilt;
  }

  /** Suma o resta construcciones; nunca baja de cero. Devuelve el cambio efectivo. */
  addBuilt(delta) {
    const next = Math.max(0, this.#blocksBuilt + delta);
    const applied = next - this.#blocksBuilt;
    this.#blocksBuilt = next;
    return applied;
  }

  exploredCells() {
    return [...this.#explored].sort((a, b) => a - b);
  }

  biomes() {
    return [...this.#biomes].sort((a, b) => a - b);
  }

  /** @returns {Map<number, number[]>} id de mineral -> posiciones */
  minedPositions() {
    return new Map([...this.#mined].map(([blockId, indices]) => [blockId, [...indices].sort((a, b) => a - b)]));
  }

  /** Estadísticas que usan las reglas de puntuación. */
  stats() {
    const oresMined = {};
    for (const [blockId, indices] of this.#mined) oresMined[blockId] = indices.size;
    return {
      exploredCells: this.#explored.size,
      biomesDiscovered: this.#biomes.size,
      oresMined,
      blocksBuilt: this.#blocksBuilt
    };
  }

  /**
   * True si este estado contiene todo lo de `other` (salvo construcciones, que
   * pueden bajar). Sirve para rechazar envíos desactualizados.
   */
  includes(other) {
    for (const cell of other.#explored) if (!this.#explored.has(cell)) return false;
    for (const biome of other.#biomes) if (!this.#biomes.has(biome)) return false;
    for (const [blockId, indices] of other.#mined) {
      const mine = this.#mined.get(blockId);
      for (const index of indices) if (!mine?.has(index)) return false;
    }
    return true;
  }

  /** Unión de dos progresos del mismo mundo; para construcciones se toma el mayor. */
  static merge(first, second) {
    const merged = new ProgressState(first.toJSON());
    for (const cell of second.#explored) merged.#explored.add(cell);
    for (const biome of second.#biomes) merged.#biomes.add(biome);
    for (const [blockId, indices] of second.#mined) for (const index of indices) merged.markMined(blockId, index);
    merged.#blocksBuilt = Math.max(first.#blocksBuilt, second.#blocksBuilt);
    return merged;
  }

  toJSON() {
    const mined = {};
    for (const [blockId, indices] of this.minedPositions()) mined[blockId] = indices;
    return {
      version: ProgressState.VERSION,
      explored: this.exploredCells(),
      biomes: this.biomes(),
      mined,
      blocksBuilt: this.#blocksBuilt
    };
  }

  /**
   * Lee un estado serializado validando solo su forma (tipos y rangos básicos).
   * La validación contra un mundo concreto la hace ProgressValidator.
   * @returns {ProgressState|null} null si la estructura no es válida
   */
  static parse(data) {
    if (data === null || typeof data !== 'object' || Array.isArray(data)) return null;
    if (data.version !== ProgressState.VERSION) return null;
    const isIndexList = (value) => Array.isArray(value) && value.every((item) => Number.isSafeInteger(item) && item >= 0);
    if (!isIndexList(data.explored) || !isIndexList(data.biomes)) return null;
    if (data.mined === null || typeof data.mined !== 'object' || Array.isArray(data.mined)) return null;
    for (const [blockId, indices] of Object.entries(data.mined)) {
      if (!/^\d{1,3}$/.test(blockId) || !isIndexList(indices)) return null;
    }
    if (!Number.isSafeInteger(data.blocksBuilt) || data.blocksBuilt < 0) return null;
    // Una posición no puede figurar con dos minerales distintos.
    const seen = new Set();
    for (const indices of Object.values(data.mined)) {
      for (const index of indices) {
        if (seen.has(index)) return null;
        seen.add(index);
      }
    }
    return new ProgressState(data);
  }
}
