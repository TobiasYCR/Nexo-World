/**
 * Bloques visibles de un frame agrupados por tipo. Recolectar primero y dibujar
 * después permite un solo cambio de material por tipo en lugar de uno por bloque.
 *
 * Los arrays planos [x, y, z, ...] se reutilizan entre frames para no generar
 * basura en el ciclo de dibujado.
 */
export class RenderQueue {
  /** blockId -> number[] con coordenadas de bloque en tripletes. */
  #groups = new Map();
  #size = 0;

  get size() {
    return this.#size;
  }

  /** Vacía la cola conservando la capacidad reservada. */
  clear() {
    for (const positions of this.#groups.values()) positions.length = 0;
    this.#size = 0;
  }

  push(blockId, x, y, z) {
    let positions = this.#groups.get(blockId);
    if (!positions) {
      positions = [];
      this.#groups.set(blockId, positions);
    }
    positions.push(x, y, z);
    this.#size += 1;
  }

  /**
   * Recorre solo los grupos con contenido.
   * @param {(blockId:number, positions:number[]) => void} visit
   */
  forEachGroup(visit) {
    for (const [blockId, positions] of this.#groups) {
      if (positions.length > 0) visit(blockId, positions);
    }
  }

  get groupCount() {
    let count = 0;
    this.forEachGroup(() => { count += 1; });
    return count;
  }
}
