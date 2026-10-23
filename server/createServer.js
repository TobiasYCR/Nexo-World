import { ApiServer } from './http/ApiServer.js';
import { ProgressionService } from './progression/ProgressionService.js';
import { WorldVerifier } from './progression/WorldVerifier.js';
import { MySqlProgressionRepository } from './persistence/MySqlProgressionRepository.js';
import { InMemoryProgressionRepository } from './persistence/InMemoryProgressionRepository.js';

/**
 * Arma el servidor completo a partir de una configuración. Separado de
 * index.js para que los tests levanten el mismo servidor con otro repositorio.
 * @param {ReturnType<import('./ServerConfig.js').ServerConfig.fromEnv>} config
 * @param {{repository?: object, logger?: object}} [overrides]
 */
export async function createProgressionServer(config, { repository, logger = console } = {}) {
  const store = repository ?? (config.storage === 'memory'
    ? new InMemoryProgressionRepository()
    : new MySqlProgressionRepository(config.mysql));
  await store.init();
  const service = new ProgressionService(store, new WorldVerifier(config.worlds), { logger });
  const api = new ApiServer(service, { allowedOrigin: config.allowedOrigin, logger });
  return {
    api,
    service,
    repository: store,
    async close() {
      await api.close();
      await store.close();
    }
  };
}
