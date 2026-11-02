import { InMemoryAccountRepository } from '../server/persistence/InMemoryAccountRepository.js';
import { InMemoryProgressionRepository } from '../server/persistence/InMemoryProgressionRepository.js';
import { MySqlDatabase } from '../server/persistence/MySqlDatabase.js';
import { MySqlAccountRepository } from '../server/persistence/MySqlAccountRepository.js';
import { MySqlProgressionRepository } from '../server/persistence/MySqlProgressionRepository.js';
import { defineAccountRepositoryContract } from './support/accountRepositoryContract.js';

defineAccountRepositoryContract('memoria', async () => ({
  accounts: new InMemoryAccountRepository(),
  players: new InMemoryProgressionRepository(),
  close: async () => {}
}));

/**
 * Contra MySQL real solo con una base de pruebas (ver progressionRepository.test.js):
 *   NEXO_TEST_MYSQL=1 MYSQL_DATABASE=nexo_world_test npm test
 * Usa su propia base (<nombre>_cuentas): node --test corre los archivos en
 * paralelo y este test vacía tablas que también usa progressionRepository.
 */
const mysqlOptions = {
  host: process.env.MYSQL_HOST ?? '127.0.0.1',
  port: Number(process.env.MYSQL_PORT ?? 3306),
  user: process.env.MYSQL_USER ?? 'root',
  password: process.env.MYSQL_PASSWORD ?? '',
  database: `${process.env.MYSQL_DATABASE ?? 'nexo_world_test'}_cuentas`
};

defineAccountRepositoryContract('mysql', async () => {
  const database = new MySqlDatabase(mysqlOptions);
  const accounts = new MySqlAccountRepository(database);
  const players = new MySqlProgressionRepository(database);
  await accounts.init();
  await players.init();
  for (const table of ['sessions', 'accounts', 'leaderboard', 'progress', 'players']) {
    await database.pool.query(`DELETE FROM ${table}`);
  }
  return { accounts, players, close: () => database.close() };
}, { skip: process.env.NEXO_TEST_MYSQL ? false : 'definir NEXO_TEST_MYSQL y una base de pruebas para correr contra MySQL' });
