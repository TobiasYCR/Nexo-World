import { InMemoryAccountRepository } from '../server/persistence/InMemoryAccountRepository.js';
import { InMemoryProgressionRepository } from '../server/persistence/InMemoryProgressionRepository.js';
import { PostgresDatabase } from '../server/persistence/PostgresDatabase.js';
import { PostgresAccountRepository } from '../server/persistence/PostgresAccountRepository.js';
import { PostgresProgressionRepository } from '../server/persistence/PostgresProgressionRepository.js';
import { defineAccountRepositoryContract } from './support/accountRepositoryContract.js';

defineAccountRepositoryContract('memoria', async () => ({
  accounts: new InMemoryAccountRepository(),
  players: new InMemoryProgressionRepository(),
  close: async () => {}
}));

/**
 * Contra PostgreSQL real solo con una base de pruebas (ver progressionRepository.test.js):
 *   NEXO_TEST_POSTGRES=1 npm test
 * Usa su propia base (<nombre>_cuentas): node --test corre los archivos en
 * paralelo y este test vacía tablas que también usa progressionRepository.
 */
const postgresOptions = {
  host: process.env.PGHOST ?? '127.0.0.1',
  port: Number(process.env.PGPORT ?? 5432),
  user: process.env.PGUSER ?? 'postgres',
  password: process.env.PGPASSWORD ?? '',
  database: `${process.env.PGDATABASE_TEST ?? 'nexo_world_test'}_cuentas`
};

defineAccountRepositoryContract('postgres', async () => {
  const database = new PostgresDatabase(postgresOptions);
  const accounts = new PostgresAccountRepository(database);
  const players = new PostgresProgressionRepository(database);
  await accounts.init();
  await players.init();
  await database.query('TRUNCATE password_resets, sessions, accounts, leaderboard, progress, players CASCADE');
  return { accounts, players, close: () => database.close() };
}, { skip: process.env.NEXO_TEST_POSTGRES ? false : 'definir NEXO_TEST_POSTGRES y una base de pruebas para correr contra PostgreSQL' });
