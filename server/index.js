/**
 * Servidor de puntuaciones de Nexo World.
 * Uso: npm run server   (lee .env; ver .env.example)
 */
import { ServerConfig } from './ServerConfig.js';
import { createProgressionServer } from './createServer.js';

ServerConfig.loadEnvFile();
const config = ServerConfig.fromEnv();

try {
  const server = await createProgressionServer(config);
  const port = await server.api.listen(config.port, config.host);
  const storage = config.storage === 'memory' ? 'memoria (sin persistencia)' : `MySQL ${config.mysql.host}:${config.mysql.port}/${config.mysql.database}`;
  console.log(`[Nexo World] API de puntuaciones en http://${config.host}:${port}/api · almacenamiento: ${storage}`);

  const shutdown = async () => {
    await server.close();
    process.exit(0);
  };
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
} catch (error) {
  console.error('[Nexo World] no se pudo iniciar el servidor de puntuaciones:', error.message);
  if (config.storage === 'mysql') console.error('Revisá que MySQL esté corriendo y los datos de conexión en .env.');
  process.exit(1);
}
