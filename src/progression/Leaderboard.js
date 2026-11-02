/**
 * Criterio de clasificación, compartido por todas las implementaciones de
 * almacenamiento (la consulta SQL replica exactamente este orden):
 *   1. Mayor puntuación primero.
 *   2. Empate: primero quien alcanzó esa puntuación antes (achievedAt menor).
 *   3. Empate exacto: id de jugador ascendente, para que el orden sea estable.
 * Con este criterio cada jugador tiene una posición única (no hay posiciones compartidas).
 */
export class Leaderboard {
  /**
   * @param {{score:number, achievedAt:number, playerId:string}} a
   * @param {{score:number, achievedAt:number, playerId:string}} b
   */
  static compare(a, b) {
    if (a.score !== b.score) return b.score - a.score;
    if (a.achievedAt !== b.achievedAt) return a.achievedAt - b.achievedAt;
    if (a.playerId === b.playerId) return 0;
    return a.playerId < b.playerId ? -1 : 1;
  }

  /** True si `a` va antes que `b` en la tabla. */
  static ranksAbove(a, b) {
    return Leaderboard.compare(a, b) < 0;
  }

  /**
   * Primeras posiciones, ya numeradas desde 1.
   * @param {Array<{score:number, achievedAt:number, playerId:string}>} entries una por jugador
   */
  static top(entries, limit) {
    return [...entries]
      .sort(Leaderboard.compare)
      .slice(0, Math.max(0, limit))
      .map((entry, index) => ({ ...entry, position: index + 1 }));
  }

  /** Posición de un jugador (desde 1), o null si no tiene entrada. */
  static positionOf(entries, playerId) {
    const own = entries.find((entry) => entry.playerId === playerId);
    if (!own) return null;
    return 1 + entries.filter((entry) => Leaderboard.ranksAbove(entry, own)).length;
  }

  /**
   * Regla de "mejor marca" (como KeepBest de Steam): la entrada solo cambia si
   * la nueva puntuación es estrictamente mayor; si empata, se conserva la fecha
   * en que se alcanzó por primera vez.
   */
  static improves(current, score) {
    return !current || score > current.score;
  }
}
