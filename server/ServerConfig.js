/**
 * Configuración del servidor, leída de variables de entorno (o de un archivo
 * .env en la raíz del proyecto). Ver .env.example.
 */
export class ServerConfig {
  static fromEnv(env = process.env) {
    const integer = (value, fallback) => {
      const parsed = Number.parseInt(value ?? '', 10);
      return Number.isInteger(parsed) ? parsed : fallback;
    };
    return Object.freeze({
      host: env.API_HOST ?? '127.0.0.1',
      port: integer(env.API_PORT, 3001),
      allowedOrigin: env.ALLOWED_ORIGIN ?? 'http://localhost:5173',
      /** 'mysql' (por defecto) o 'memory' para probar sin base de datos. */
      storage: env.STORAGE === 'memory' ? 'memory' : 'mysql',
      mysql: Object.freeze({
        host: env.MYSQL_HOST ?? '127.0.0.1',
        port: integer(env.MYSQL_PORT, 3306),
        user: env.MYSQL_USER ?? 'root',
        password: env.MYSQL_PASSWORD ?? '',
        database: env.MYSQL_DATABASE ?? 'nexo_world'
      }),
      /** Mundos que el servidor acepta regenerar para validar. */
      worlds: Object.freeze({
        maxWidth: integer(env.MAX_WORLD_WIDTH, 256),
        maxHeight: integer(env.MAX_WORLD_HEIGHT, 128),
        maxDepth: integer(env.MAX_WORLD_DEPTH, 256),
        cacheSize: integer(env.WORLD_CACHE_SIZE, 4)
      })
    });
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
