import { ApiServer } from './http/ApiServer.js';
import { ProgressionService } from './progression/ProgressionService.js';
import { WorldVerifier } from './progression/WorldVerifier.js';
import { MySqlProgressionRepository } from './persistence/MySqlProgressionRepository.js';
import { InMemoryProgressionRepository } from './persistence/InMemoryProgressionRepository.js';
import { MySqlDatabase } from './persistence/MySqlDatabase.js';
import { MySqlAccountRepository } from './persistence/MySqlAccountRepository.js';
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
  const database = config.storage === 'memory' ? null : new MySqlDatabase(config.mysql);
  const store = repository ?? (database ? new MySqlProgressionRepository(database) : new InMemoryProgressionRepository());
  const accountStore = accountRepository ?? (database ? new MySqlAccountRepository(database) : new InMemoryAccountRepository());
  await store.init();
  await accountStore.init();

  const accounts = new AccountService(accountStore, store, { logger });
  const service = new ProgressionService(store, new WorldVerifier(config.worlds), { logger, sessions: accounts });
  const api = new ApiServer(service, { allowedOrigin: config.allowedOrigin, logger, authRoutes: new AuthRoutes(accounts) });
  return {
    api,
    service,
    accounts,
    repository: store,
    accountRepository: accountStore,
    async close() {
      await api.close();
      await accountStore.close();
      await store.close();
      await database?.close();
    }
  };
}
