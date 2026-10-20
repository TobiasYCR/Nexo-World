import { InMemoryProgressionRepository } from '../server/persistence/InMemoryProgressionRepository.js';
import { MySqlProgressionRepository } from '../server/persistence/MySqlProgressionRepository.js';
import { defineRepositoryContract } from './support/repositoryContract.js';

defineRepositoryContract('memoria', async () => new InMemoryProgressionRepository());

/**
 * Contra MySQL real solo si se configura una base de pruebas, por ejemplo:
 *   NEXO_TEST_MYSQL=1 MYSQL_USER=root MYSQL_PASSWORD=... MYSQL_DATABASE=nexo_world_test npm test
 * La base se vacía antes de cada prueba: no usar la base de desarrollo.
 */
const mysqlOptions = {
  host: process.env.MYSQL_HOST ?? '127.0.0.1',
  port: Number(process.env.MYSQL_PORT ?? 3306),
  user: process.env.MYSQL_USER ?? 'root',
  password: process.env.MYSQL_PASSWORD ?? '',
  database: process.env.MYSQL_DATABASE ?? 'nexo_world_test'
};

defineRepositoryContract('mysql', async () => {
  const repository = new MySqlProgressionRepository(mysqlOptions);
  await repository.init();
  const mysql = (await import('mysql2/promise')).default;
  const connection = await mysql.createConnection(mysqlOptions);
  await connection.query('DELETE FROM leaderboard');
  await connection.query('DELETE FROM progress');
  await connection.query('DELETE FROM players');
  await connection.end();
  return repository;
}, { skip: process.env.NEXO_TEST_MYSQL ? false : 'definir NEXO_TEST_MYSQL y una base de pruebas para correr contra MySQL' });
