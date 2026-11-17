import { InMemoryProgressionRepository } from '../server/persistence/InMemoryProgressionRepository.js';
import { PostgresDatabase } from '../server/persistence/PostgresDatabase.js';
import { PostgresProgressionRepository } from '../server/persistence/PostgresProgressionRepository.js';
import { defineRepositoryContract } from './support/repositoryContract.js';

defineRepositoryContract('memoria', async () => new InMemoryProgressionRepository());

/**
 * Contra PostgreSQL real solo si se configura una base de pruebas, por ejemplo:
 *   NEXO_TEST_POSTGRES=1 PGUSER=postgres PGPASSWORD=... npm test
 * Usa la base nexo_world_test (la crea si no existe) y la vacía antes de cada
 * prueba: no usar la base de desarrollo.
 */
const postgresOptions = {
  host: process.env.PGHOST ?? '127.0.0.1',
  port: Number(process.env.PGPORT ?? 5432),
  user: process.env.PGUSER ?? 'postgres',
  password: process.env.PGPASSWORD ?? '',
  database: process.env.PGDATABASE_TEST ?? 'nexo_world_test'
};

defineRepositoryContract('postgres', async () => {
  const database = new PostgresDatabase(postgresOptions);
  const repository = new PostgresProgressionRepository(database);
  await repository.init();
  await database.query('TRUNCATE leaderboard, progress, players CASCADE');
  // El contrato cierra el repositorio; la conexión compartida se cierra con él.
  repository.close = () => database.close();
  return repository;
}, { skip: process.env.NEXO_TEST_POSTGRES ? false : 'definir NEXO_TEST_POSTGRES y una base de pruebas para correr contra PostgreSQL' });
