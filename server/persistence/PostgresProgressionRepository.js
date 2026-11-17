import { ProgressionRepository } from './ProgressionRepository.js';
import { PostgresDatabase } from './PostgresDatabase.js';

/**
 * Repositorio de jugadores, progreso y clasificación sobre PostgreSQL.
 *
 * Decisiones:
 *   - Todas las consultas usan parámetros ($1, $2…); nada de concatenar datos del cliente.
 *   - saveProgress es una transacción: la escritura condicional por revisión y
 *     la actualización de la mejor marca se confirman juntas o no se confirma nada.
 *   - El orden de la clasificación replica Leaderboard.compare:
 *     best_score DESC, achieved_at ASC, player_id ASC.
 *   - BIGINT llega como texto desde pg: se convierte con Number (los tiempos
 *     en milisegundos entran sin pérdida en un número de JavaScript).
 */
export class PostgresProgressionRepository extends ProgressionRepository {
  #database;
  #ownsDatabase;

  /**
   * @param {PostgresDatabase|object} source una conexión compartida, o los datos para abrir una propia
   */
  constructor(source) {
    super();
    this.#ownsDatabase = !(source instanceof PostgresDatabase);
    this.#database = this.#ownsDatabase ? new PostgresDatabase(source) : source;
  }

  async init() {
    await this.#database.init();
  }

  async createPlayer({ id, name, tokenHash, accountId = null, createdAt }) {
    await this.#database.query(
      'INSERT INTO players (id, display_name, token_hash, account_id, created_at) VALUES ($1, $2, $3, $4, $5)',
      [id, name, tokenHash, accountId, createdAt]
    );
  }

  async findPlayerById(playerId) {
    const { rows } = await this.#database.query('SELECT * FROM players WHERE id = $1', [playerId]);
    return rows.length ? PostgresProgressionRepository.#toPlayer(rows[0]) : null;
  }

  async findPlayerByTokenHash(tokenHash) {
    const { rows } = await this.#database.query('SELECT * FROM players WHERE token_hash = $1', [tokenHash]);
    return rows.length ? PostgresProgressionRepository.#toPlayer(rows[0]) : null;
  }

  async getProgress(playerId, mode, worldKey) {
    const { rows } = await this.#database.query(
      'SELECT * FROM progress WHERE player_id = $1 AND mode = $2 AND world_key = $3',
      [playerId, mode, worldKey]
    );
    return rows.length ? PostgresProgressionRepository.#toProgress(rows[0]) : null;
  }

  async saveProgress(progress, expectedRevision) {
    const { playerId, mode, worldKey, revision, score, stats, state, updatedAt } = progress;
    try {
      return await this.#database.transaction(async (client) => {
        if (expectedRevision === 0) {
          // Si ya existe la fila, alguien guardó antes: la revisión quedó vieja.
          const inserted = await client.query(
            `INSERT INTO progress (player_id, mode, world_key, revision, score, stats, state, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
             ON CONFLICT (player_id, mode, world_key) DO NOTHING`,
            [playerId, mode, worldKey, revision, score, JSON.stringify(stats), JSON.stringify(state), updatedAt]
          );
          if (inserted.rowCount !== 1) throw new StaleRevision();
        } else {
          const updated = await client.query(
            `UPDATE progress SET revision = $1, score = $2, stats = $3, state = $4, updated_at = $5
             WHERE player_id = $6 AND mode = $7 AND world_key = $8 AND revision = $9`,
            [revision, score, JSON.stringify(stats), JSON.stringify(state), updatedAt, playerId, mode, worldKey, expectedRevision]
          );
          if (updated.rowCount !== 1) throw new StaleRevision();
        }

        // Mejor marca: solo cambia si la nueva puntuación es estrictamente mayor.
        await client.query(
          `INSERT INTO leaderboard (mode, player_id, best_score, achieved_at, world_key) VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (mode, player_id) DO UPDATE
             SET best_score = EXCLUDED.best_score, achieved_at = EXCLUDED.achieved_at, world_key = EXCLUDED.world_key
             WHERE EXCLUDED.best_score > leaderboard.best_score`,
          [mode, playerId, score, updatedAt, worldKey]
        );
        return { ok: true };
      });
    } catch (error) {
      if (error instanceof StaleRevision) return { ok: false, reason: 'stale' };
      throw error;
    }
  }

  async topScores(mode, limit) {
    const { rows } = await this.#database.query(
      `SELECT l.player_id, p.display_name, l.best_score, l.achieved_at, l.world_key
       FROM leaderboard l JOIN players p ON p.id = l.player_id
       WHERE l.mode = $1
       ORDER BY l.best_score DESC, l.achieved_at ASC, l.player_id ASC
       LIMIT $2`,
      [mode, limit]
    );
    return rows.map((row, index) => ({ ...PostgresProgressionRepository.#toStanding(row), position: index + 1 }));
  }

  async standingOf(mode, playerId) {
    const { rows } = await this.#database.query(
      `SELECT l.player_id, p.display_name, l.best_score, l.achieved_at, l.world_key
       FROM leaderboard l JOIN players p ON p.id = l.player_id
       WHERE l.mode = $1 AND l.player_id = $2`,
      [mode, playerId]
    );
    if (!rows.length) return null;
    const standing = PostgresProgressionRepository.#toStanding(rows[0]);
    const { rows: [{ ahead }] } = await this.#database.query(
      `SELECT COUNT(*) AS ahead FROM leaderboard
       WHERE mode = $1 AND (
         best_score > $2
         OR (best_score = $2 AND achieved_at < $3)
         OR (best_score = $2 AND achieved_at = $3 AND player_id < $4)
       )`,
      [mode, standing.score, standing.achievedAt, playerId]
    );
    return { ...standing, position: Number(ahead) + 1 };
  }

  async findPlayerByAccountId(accountId) {
    const { rows } = await this.#database.query('SELECT * FROM players WHERE account_id = $1', [accountId]);
    return rows.length ? PostgresProgressionRepository.#toPlayer(rows[0]) : null;
  }

  async linkPlayerToAccount(playerId, accountId, name) {
    try {
      const { rowCount } = await this.#database.query(
        'UPDATE players SET account_id = $1, display_name = $2 WHERE id = $3 AND account_id IS NULL',
        [accountId, name, playerId]
      );
      return rowCount === 1;
    } catch (error) {
      // La cuenta ya tiene otro jugador (clave única de account_id).
      if (error?.code === PostgresDatabase.UNIQUE_VIOLATION) return false;
      throw error;
    }
  }

  async renameAccountPlayer(accountId, name) {
    await this.#database.query('UPDATE players SET display_name = $1 WHERE account_id = $2', [name, accountId]);
  }

  /** Cierra la conexión solo si es propia; la compartida la cierra quien la creó. */
  async close() {
    if (this.#ownsDatabase) await this.#database.close();
  }

  static #toPlayer(row) {
    return {
      id: row.id,
      name: row.display_name,
      tokenHash: row.token_hash,
      accountId: row.account_id,
      createdAt: Number(row.created_at)
    };
  }

  static #toProgress(row) {
    return {
      playerId: row.player_id,
      mode: row.mode,
      worldKey: row.world_key,
      revision: Number(row.revision),
      score: Number(row.score),
      stats: row.stats,
      state: row.state,
      updatedAt: Number(row.updated_at)
    };
  }

  static #toStanding(row) {
    return {
      playerId: row.player_id,
      name: row.display_name,
      score: Number(row.best_score),
      achievedAt: Number(row.achieved_at),
      worldKey: row.world_key
    };
  }
}

/** La revisión esperada ya no coincide: otro guardado llegó antes. */
class StaleRevision extends Error {}
