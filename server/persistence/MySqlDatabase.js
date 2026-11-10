import { readFile } from 'node:fs/promises';
import mysql from 'mysql2/promise';

const SCHEMA_URL = new URL('./schema.sql', import.meta.url);

/**
 * Conexión compartida a MySQL (también probada con MariaDB 10.11).
 *
 * Los repositorios de progresión y de cuentas usan la misma base y el mismo
 * pool: así una sola instancia crea la base, aplica el esquema y se cierra una
 * vez. init() se puede llamar desde los dos repositorios; el trabajo se hace
 * una sola vez.
 */
export class MySqlDatabase {
  #pool = null;
  #initializing = null;

  /**
   * @param {{host:string, port:number, user:string, password:string, database:string, connectionLimit?:number}} options
   */
  constructor(options) {
    this.options = options;
  }

  /** Crea la base (si el usuario tiene permiso) y las tablas que falten. */
  init() {
    this.#initializing ??= this.#initialize();
    return this.#initializing;
  }

  /** Pool listo para consultar. Lanza si todavía no se llamó a init(). */
  get pool() {
    if (!this.#pool) throw new Error('La base de datos no está inicializada: falta llamar a init().');
    return this.#pool;
  }

  /** Consulta mínima para saber si MySQL responde. Lanza si no. */
  async ping() {
    await this.pool.query('SELECT 1');
  }

  async close() {
    await this.#pool?.end();
    this.#pool = null;
    this.#initializing = null;
  }

  async #initialize() {
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

  /** MySQL devuelve JSON ya parseado; MariaDB lo devuelve como texto. */
  static json(value) {
    return typeof value === 'string' ? JSON.parse(value) : value;
  }
}
