import { readFile } from 'node:fs/promises';
import pg from 'pg';

const SCHEMA_URL = new URL('./schema.sql', import.meta.url);

/**
 * Conexión compartida a PostgreSQL.
 *
 * Los repositorios de progresión y de cuentas usan la misma base y el mismo
 * pool: una sola instancia aplica el esquema y se cierra una vez. init() se
 * puede llamar desde los dos repositorios; el trabajo se hace una sola vez.
 *
 * Se conecta con una URL (DATABASE_URL, la que da Render) o con los datos
 * sueltos (host, puerto, usuario…). Con datos sueltos, si la base no existe se
 * intenta crear.
 */
export class PostgresDatabase {
  #pool = null;
  #initializing = null;

  /**
   * @param {{connectionString?:string, host?:string, port?:number, user?:string, password?:string,
   *   database?:string, ssl?:boolean, max?:number}} options
   */
  constructor(options) {
    this.options = options;
  }

  /** Nombre de la base, para mostrarlo en /api/health y en el arranque. */
  get databaseName() {
    if (this.options.connectionString) {
      try {
        return new URL(this.options.connectionString).pathname.replace(/^\//, '') || 'postgres';
      } catch {
        return 'postgres';
      }
    }
    return this.options.database;
  }

  /** Aplica el esquema (y crea la base si hace falta y se puede). */
  init() {
    this.#initializing ??= this.#initialize();
    return this.#initializing;
  }

  /** Pool listo para consultar. Lanza si todavía no se llamó a init(). */
  get pool() {
    if (!this.#pool) throw new Error('La base de datos no está inicializada: falta llamar a init().');
    return this.#pool;
  }

  /** Consulta con parámetros ($1, $2…). */
  query(text, values = []) {
    return this.pool.query(text, values);
  }

  /**
   * Corre fn dentro de una transacción con un cliente propio; confirma si
   * termina bien y deshace si lanza.
   * @template T
   * @param {(client: import('pg').PoolClient) => Promise<T>} fn
   * @returns {Promise<T>}
   */
  async transaction(fn) {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await fn(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {});
      throw error;
    } finally {
      client.release();
    }
  }

  /** Consulta mínima para saber si la base responde. Lanza si no. */
  async ping() {
    await this.pool.query('SELECT 1');
  }

  async close() {
    await this.#pool?.end();
    this.#pool = null;
    this.#initializing = null;
  }

  #connectionOptions(database = undefined) {
    const { connectionString, ssl, max, ...rest } = this.options;
    // Render y la mayoría de los servicios externos piden SSL; con certificados propios del proveedor.
    const sslOption = ssl ? { rejectUnauthorized: false } : undefined;
    if (connectionString) return { connectionString, ssl: sslOption, max: max ?? 10 };
    return { ...rest, ...(database ? { database } : {}), ssl: sslOption, max: max ?? 10 };
  }

  async #initialize() {
    if (!this.options.connectionString) await this.#createDatabaseIfMissing();
    this.#pool = new pg.Pool(this.#connectionOptions());
    // Un error de una conexión ociosa (por ejemplo, la base se reinicia) no debe tirar el servidor.
    this.#pool.on('error', () => {});

    const schema = await readFile(SCHEMA_URL, 'utf8');
    await this.#pool.query(schema);
  }

  /** Con datos sueltos, crea la base si no existe (necesita permiso; si no lo hay, se sigue). */
  async #createDatabaseIfMissing() {
    const database = this.options.database;
    if (!/^[A-Za-z0-9_]{1,63}$/.test(database ?? '')) throw new Error(`Nombre de base de datos inválido: "${database}".`);
    const admin = new pg.Client(this.#connectionOptions('postgres'));
    try {
      await admin.connect();
      const { rowCount } = await admin.query('SELECT 1 FROM pg_database WHERE datname = $1', [database]);
      if (rowCount === 0) await admin.query(`CREATE DATABASE "${database}"`);
    } catch (error) {
      // Sin permiso o sin base "postgres" se sigue: la base puede existir y haberla creado un administrador.
      if (!['42501', '3D000', '42P04'].includes(error?.code)) throw error;
    } finally {
      await admin.end().catch(() => {});
    }
  }

  /** Código de PostgreSQL para una clave única repetida. */
  static UNIQUE_VIOLATION = '23505';
  static CHECK_VIOLATION = '23514';
}
