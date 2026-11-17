import { ApiServer } from './http/ApiServer.js';
import { ProgressionService } from './progression/ProgressionService.js';
import { WorldVerifier } from './progression/WorldVerifier.js';
import { PostgresProgressionRepository } from './persistence/PostgresProgressionRepository.js';
import { InMemoryProgressionRepository } from './persistence/InMemoryProgressionRepository.js';
import { PostgresDatabase } from './persistence/PostgresDatabase.js';
import { PostgresAccountRepository } from './persistence/PostgresAccountRepository.js';
import { StaticFiles } from './http/StaticFiles.js';
import { InMemoryAccountRepository } from './persistence/InMemoryAccountRepository.js';
import { AccountService } from './accounts/AccountService.js';
import { AuthRoutes } from './http/AuthRoutes.js';

/**
 * Arma el servidor completo a partir de una configuración. Separado de
 * index.js para que los tests levanten el mismo servidor con otros repositorios.
 * Progresión y cuentas comparten la misma base de datos.
 * @param {ReturnType<import('./ServerConfig.js').ServerConfig.fromEnv>} config
 * @param {{repository?: object, accountRepository?: object, logger?: object}} [overrides]
 */
export async function createProgressionServer(config, { repository, accountRepository, logger = console } = {}) {
  const database = config.storage === 'memory' ? null : new PostgresDatabase(config.postgres);
  const store = repository ?? (database ? new PostgresProgressionRepository(database) : new InMemoryProgressionRepository());
  const accountStore = accountRepository ?? (database ? new PostgresAccountRepository(database) : new InMemoryAccountRepository());
  await store.init();
  await accountStore.init();

  const accounts = new AccountService(accountStore, store, { logger });
  const service = new ProgressionService(store, new WorldVerifier(config.worlds), { logger, sessions: accounts });
  const healthCheck = async () => {
    if (!database) return { storage: repository ? 'custom' : 'memory' };
    await database.ping();
    return { storage: 'postgres', database: database.databaseName };
  };
  // En producción el mismo servidor publica el juego compilado (si existe la carpeta).
  const staticFiles = config.clientDir ? new StaticFiles(config.clientDir) : null;
  const servesClient = Boolean(staticFiles && (await staticFiles.isAvailable()));
  const api = new ApiServer(service, {
    allowedOrigin: config.allowedOrigin,
    logger,
    authRoutes: new AuthRoutes(accounts),
    healthCheck,
    staticFiles: servesClient ? staticFiles : null
  });
  return {
    api,
    service,
    accounts,
    repository: store,
    accountRepository: accountStore,
    servesClient,
    async close() {
      await api.close();
      await accountStore.close();
      await store.close();
      await database?.close();
    }
  };
}
