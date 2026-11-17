/**
 * Configuración del servidor, leída de variables de entorno (o de un archivo
 * .env en la raíz del proyecto). Ver .env.example.
 *
 * Base de datos (PostgreSQL), una de dos formas:
 *   - DATABASE_URL=postgres://usuario:clave@host:5432/base  (la que da Render)
 *   - PGHOST, PGPORT, PGUSER, PGPASSWORD, PGDATABASE        (local)
 */
export class ServerConfig {
  static fromEnv(env = process.env) {
    const integer = (value, fallback) => {
      const parsed = Number.parseInt(value ?? '', 10);
      return Number.isInteger(parsed) ? parsed : fallback;
    };
    // Render indica el puerto en PORT y exige escuchar en todas las interfaces.
    const onPlatform = env.PORT !== undefined;
    const databaseUrl = env.DATABASE_URL?.trim() || null;
    return Object.freeze({
      host: env.API_HOST ?? (onPlatform ? '0.0.0.0' : '127.0.0.1'),
      port: integer(env.API_PORT ?? env.PORT, 3001),
      allowedOrigin: env.ALLOWED_ORIGIN ?? 'http://localhost:5173',
      /** 'postgres' (por defecto) o 'memory' para probar sin base de datos. */
      storage: env.STORAGE === 'memory' ? 'memory' : 'postgres',
      postgres: Object.freeze({
        connectionString: databaseUrl,
        host: env.PGHOST ?? '127.0.0.1',
        port: integer(env.PGPORT, 5432),
        user: env.PGUSER ?? 'postgres',
        password: env.PGPASSWORD ?? '',
        database: env.PGDATABASE ?? 'nexo_world',
        ssl: ServerConfig.#ssl(env.DATABASE_SSL, databaseUrl)
      }),
      /** Carpeta del juego compilado (npm run build) que el servidor publica; '' para no publicar nada. */
      clientDir: env.CLIENT_DIR ?? 'dist',
      /** Mundos que el servidor acepta regenerar para validar. */
      worlds: Object.freeze({
        maxWidth: integer(env.MAX_WORLD_WIDTH, 256),
        maxHeight: integer(env.MAX_WORLD_HEIGHT, 128),
        maxDepth: integer(env.MAX_WORLD_DEPTH, 256),
        cacheSize: integer(env.WORLD_CACHE_SIZE, 4)
      })
    });
  }

  /**
   * SSL: lo que diga DATABASE_SSL; si no, se activa para las URL externas de
   * Render (…render.com), que lo exigen. La URL interna de Render no lo usa.
   */
  static #ssl(flag, url) {
    if (flag === 'true') return true;
    if (flag === 'false') return false;
    if (!url) return false;
    try {
      return new URL(url).hostname.endsWith('.render.com');
    } catch {
      return false;
    }
  }

  /** Texto para el arranque y los errores: dónde están los datos, sin mostrar la contraseña. */
  static describeStorage(config) {
    if (config.storage === 'memory') return 'memoria (sin persistencia)';
    const { connectionString, host, port, database } = config.postgres;
    if (connectionString) {
      try {
        const url = new URL(connectionString);
        return `PostgreSQL ${url.hostname}${url.port ? `:${url.port}` : ''}${url.pathname}`;
      } catch {
        return 'PostgreSQL (DATABASE_URL)';
      }
    }
    return `PostgreSQL ${host}:${port}/${database}`;
  }

  /** Carga .env si existe (Node >= 20.12). Las variables ya definidas tienen prioridad. */
  static loadEnvFile(path = '.env') {
    if (typeof process.loadEnvFile !== 'function') return false;
    try {
      process.loadEnvFile(path);
      return true;
    } catch (error) {
      if (error?.code === 'ENOENT') return false;
      throw error;
    }
  }
}
