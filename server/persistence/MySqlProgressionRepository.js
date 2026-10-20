import { readFile } from 'node:fs/promises';
import mysql from 'mysql2/promise';
import { ProgressionRepository } from './ProgressionRepository.js';

const SCHEMA_URL = new URL('./schema.sql', import.meta.url);

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
  #pool = null;

  /**
   * @param {{host:string, port:number, user:string, password:string, database:string, connectionLimit?:number}} options
   */
  constructor(options) {
    super();
    this.options = options;
  }

  /** Crea la base (si el usuario tiene permiso) y las tablas que falten. */
  async init() {
    const { database, ...connection } = this.options;
    if (!/^[A-Za-z0-9_]{1,64}$/.test(database)) throw new Error(`Nombre de base de datos inválido: "${database}".`);

    const bootstrap = await mysql.createConnection(connection);
    try {
      await bootstrap.query(`CREATE DATABASE IF NOT EXISTS \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    } catch (error) {
      // Sin permiso para crear bases se sigue: puede existir y haberla creado un administrador.
      if (error?.code !== 'ER_DBACCESS_DENIED_ERROR' && error?.code !== 'ER_ACCESS_DENIED_ERROR') throw error;
    } finally {
      await bootstrap.end();
    }

    this.#pool = mysql.createPool({
      ...this.options,
      connectionLimit: this.options.connectionLimit ?? 10,
      waitForConnections: true,
      supportBigNumbers: true,
      bigNumberStrings: false
    });

    const schema = await readFile(SCHEMA_URL, 'utf8');
    const statements = schema
      .split(/;\s*(?:\r?\n|$)/)
      .map((statement) => statement.replace(/^\s*--.*$/gm, '').trim())
      .filter(Boolean);
    for (const statement of statements) await this.#pool.query(statement);
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

  async close() {
    await this.#pool?.end();
    this.#pool = null;
  }

  /** MySQL devuelve JSON ya parseado; MariaDB lo devuelve como texto. */
  static #json(value) {
    return typeof value === 'string' ? JSON.parse(value) : value;
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
      stats: MySqlProgressionRepository.#json(row.stats),
      state: MySqlProgressionRepository.#json(row.state),
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
