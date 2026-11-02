import { ProgressionRepository } from './ProgressionRepository.js';
import { MySqlDatabase } from './MySqlDatabase.js';

/**
 * Repositorio sobre MySQL 8 (también probado con MariaDB 10.11).
 *
 * Decisiones:
 *   - Todas las consultas usan parámetros; nada de concatenar datos del cliente.
 *   - saveProgress es una transacción: la escritura condicional por revisión y
 *     la actualización de la mejor marca se confirman juntas o no se confirma nada.
 *   - El orden de la clasificación replica Leaderboard.compare:
 *     best_score DESC, achieved_at ASC, player_id ASC.
 */
export class MySqlProgressionRepository extends ProgressionRepository {
  #database;
  #ownsDatabase;

  /**
   * @param {MySqlDatabase|{host:string, port:number, user:string, password:string, database:string, connectionLimit?:number}} source
   *   una conexión compartida, o los datos para abrir una propia
   */
  constructor(source) {
    super();
    this.#ownsDatabase = !(source instanceof MySqlDatabase);
    this.#database = this.#ownsDatabase ? new MySqlDatabase(source) : source;
  }

  get #pool() {
    return this.#database.pool;
  }

  /** Crea la base (si el usuario tiene permiso) y las tablas que falten. */
  async init() {
    await this.#database.init();
  }

  async createPlayer({ id, name, tokenHash, accountId = null, createdAt }) {
    await this.#pool.query(
      'INSERT INTO players (id, display_name, token_hash, account_id, created_at) VALUES (?, ?, ?, ?, ?)',
      [id, name, tokenHash, accountId, createdAt]
    );
  }

  async findPlayerById(playerId) {
    const [rows] = await this.#pool.query('SELECT * FROM players WHERE id = ?', [playerId]);
    return rows.length ? MySqlProgressionRepository.#toPlayer(rows[0]) : null;
  }

  async findPlayerByTokenHash(tokenHash) {
    const [rows] = await this.#pool.query('SELECT * FROM players WHERE token_hash = ?', [tokenHash]);
    return rows.length ? MySqlProgressionRepository.#toPlayer(rows[0]) : null;
  }

  async getProgress(playerId, mode, worldKey) {
    const [rows] = await this.#pool.query(
      'SELECT * FROM progress WHERE player_id = ? AND mode = ? AND world_key = ?',
      [playerId, mode, worldKey]
    );
    return rows.length ? MySqlProgressionRepository.#toProgress(rows[0]) : null;
  }

  async saveProgress(progress, expectedRevision) {
    const { playerId, mode, worldKey, revision, score, stats, state, updatedAt } = progress;
    const connection = await this.#pool.getConnection();
    try {
      await connection.beginTransaction();

      if (expectedRevision === 0) {
        try {
          await connection.query(
            `INSERT INTO progress (player_id, mode, world_key, revision, score, stats, state, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [playerId, mode, worldKey, revision, score, JSON.stringify(stats), JSON.stringify(state), updatedAt]
          );
        } catch (error) {
          if (error?.code !== 'ER_DUP_ENTRY') throw error;
          await connection.rollback();
          return { ok: false, reason: 'stale' };
        }
      } else {
        const [result] = await connection.query(
          `UPDATE progress SET revision = ?, score = ?, stats = ?, state = ?, updated_at = ?
           WHERE player_id = ? AND mode = ? AND world_key = ? AND revision = ?`,
          [revision, score, JSON.stringify(stats), JSON.stringify(state), updatedAt, playerId, mode, worldKey, expectedRevision]
        );
        if (result.affectedRows !== 1) {
          await connection.rollback();
          return { ok: false, reason: 'stale' };
        }
      }

      // Mejor marca: solo cambia si la nueva puntuación es estrictamente mayor.
      // MySQL evalúa las asignaciones en orden, por eso best_score se actualiza al final:
      // las dos primeras todavía comparan contra la marca anterior.
      await connection.query(
        `INSERT INTO leaderboard (mode, player_id, best_score, achieved_at, world_key) VALUES (?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           achieved_at = IF(? > best_score, ?, achieved_at),
           world_key = IF(? > best_score, ?, world_key),
           best_score = IF(? > best_score, ?, best_score)`,
        [mode, playerId, score, updatedAt, worldKey, score, updatedAt, score, worldKey, score, score]
      );

      await connection.commit();
      return { ok: true };
    } catch (error) {
      await connection.rollback().catch(() => {});
      throw error;
    } finally {
      connection.release();
    }
  }

  async topScores(mode, limit) {
    const [rows] = await this.#pool.query(
      `SELECT l.player_id, p.display_name, l.best_score, l.achieved_at, l.world_key
       FROM leaderboard l JOIN players p ON p.id = l.player_id
       WHERE l.mode = ?
       ORDER BY l.best_score DESC, l.achieved_at ASC, l.player_id ASC
       LIMIT ?`,
      [mode, limit]
    );
    return rows.map((row, index) => ({ ...MySqlProgressionRepository.#toStanding(row), position: index + 1 }));
  }

  async standingOf(mode, playerId) {
    const [rows] = await this.#pool.query(
      `SELECT l.player_id, p.display_name, l.best_score, l.achieved_at, l.world_key
       FROM leaderboard l JOIN players p ON p.id = l.player_id
       WHERE l.mode = ? AND l.player_id = ?`,
      [mode, playerId]
    );
    if (!rows.length) return null;
    const standing = MySqlProgressionRepository.#toStanding(rows[0]);
    const [[{ ahead }]] = await this.#pool.query(
      `SELECT COUNT(*) AS ahead FROM leaderboard
       WHERE mode = ? AND (
         best_score > ?
         OR (best_score = ? AND achieved_at < ?)
         OR (best_score = ? AND achieved_at = ? AND player_id < ?)
       )`,
      [mode, standing.score, standing.score, standing.achievedAt, standing.score, standing.achievedAt, playerId]
    );
    return { ...standing, position: Number(ahead) + 1 };
  }

  async findPlayerByAccountId(accountId) {
    const [rows] = await this.#pool.query('SELECT * FROM players WHERE account_id = ?', [accountId]);
    return rows.length ? MySqlProgressionRepository.#toPlayer(rows[0]) : null;
  }

  async linkPlayerToAccount(playerId, accountId, name) {
    try {
      const [result] = await this.#pool.query(
        'UPDATE players SET account_id = ?, display_name = ? WHERE id = ? AND account_id IS NULL',
        [accountId, name, playerId]
      );
      return result.affectedRows === 1;
    } catch (error) {
      // La cuenta ya tiene otro jugador (índice único de account_id).
      if (error?.code === 'ER_DUP_ENTRY') return false;
      throw error;
    }
  }

  async renameAccountPlayer(accountId, name) {
    await this.#pool.query('UPDATE players SET display_name = ? WHERE account_id = ?', [name, accountId]);
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
      stats: MySqlDatabase.json(row.stats),
      state: MySqlDatabase.json(row.state),
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
