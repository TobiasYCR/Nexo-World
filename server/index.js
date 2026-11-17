/**
 * Servidor de puntuaciones y cuentas de Nexo World.
 * Uso: npm run server   (lee .env; ver .env.example)
 */
import { ServerConfig } from './ServerConfig.js';
import { createProgressionServer } from './createServer.js';

ServerConfig.loadEnvFile();
const config = ServerConfig.fromEnv();

try {
  const server = await createProgressionServer(config);
  const port = await server.api.listen(config.port, config.host);
  console.log(`[Nexo World] API de puntuaciones y cuentas en http://${config.host}:${port}/api · almacenamiento: ${ServerConfig.describeStorage(config)}`);
  if (server.servesClient) console.log(`[Nexo World] juego publicado desde ${config.clientDir}/ en http://${config.host}:${port}/`);

  const shutdown = async () => {
    await server.close();
    process.exit(0);
  };
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
} catch (error) {
  console.error('[Nexo World] no se pudo iniciar el servidor de puntuaciones:', error.message);
  if (config.storage === 'postgres') console.error(`Revisá que PostgreSQL esté corriendo y los datos de conexión (${ServerConfig.describeStorage(config)}).`);
  process.exit(1);
}
