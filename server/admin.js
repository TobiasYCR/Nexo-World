/**
 * Herramientas de administración de Nexo World. Se corren en la máquina del
 * servidor, con la misma base de datos (lee .env).
 * Uso: npm run admin -- <comando> (npm run admin sin argumentos lista los comandos)
 */
import { ServerConfig } from './ServerConfig.js';
import { createProgressionServer } from './createServer.js';
import { AdminCommands } from './admin/AdminCommands.js';

ServerConfig.loadEnvFile();
const config = ServerConfig.fromEnv();

let server = null;
let exitCode = 1;
try {
  server = await createProgressionServer(config);
  exitCode = await new AdminCommands(server.accounts, console, {
    accountStore: server.accountRepository,
    players: server.repository
  }).run(process.argv.slice(2));
} catch (error) {
  console.error('[Nexo World] no se pudo conectar con la base de datos:', error.message);
} finally {
  await server?.close();
}
process.exit(exitCode);
