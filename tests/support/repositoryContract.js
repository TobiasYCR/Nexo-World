import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PlayerTokens } from '../../server/security/PlayerTokens.js';

/**
 * Pruebas de contrato de ProgressionRepository. Se ejecutan igual sobre la
 * implementación en memoria y sobre MySQL: así la consulta SQL de la
 * clasificación se valida contra el mismo criterio que Leaderboard.
 * @param {string} label
 * @param {() => Promise<object>} createRepository repositorio vacío e inicializado
 * @param {{skip?: string|false}} [options]
 */
export function defineRepositoryContract(label, createRepository, { skip = false } = {}) {
  const WORLD = 's1-v2-32x24x32';
  let sequence = 0;

  async function player(repository, name = 'Jugador') {
    sequence += 1;
    const id = `00000000-0000-4000-8000-${String(sequence).padStart(12, '0')}`;
    const record = { id, name, tokenHash: PlayerTokens.hash(`token-${label}-${sequence}`), accountId: null, createdAt: 1000 };
    await repository.createPlayer(record);
    return record;
  }

  function progress(playerId, { score, revision = 1, updatedAt = 1000, mode = 'survival', worldKey = WORLD }) {
    const state = { version: 1, explored: [0], biomes: [], mined: {}, blocksBuilt: 0 };
    return { playerId, mode, worldKey, revision, score, stats: { exploredCells: 1 }, state, updatedAt };
  }

  test(`[${label}] guarda y recupera jugadores y progreso`, { skip }, async () => {
    const repository = await createRepository();
    try {
      const created = await player(repository, 'Tobías');
      assert.deepEqual(await repository.findPlayerById(created.id), created);
      assert.deepEqual(await repository.findPlayerByTokenHash(created.tokenHash), created);
      assert.equal(await repository.findPlayerById('00000000-0000-4000-8000-999999999999'), null);
      assert.equal(await repository.getProgress(created.id, 'survival', WORLD), null);

      assert.deepEqual(await repository.saveProgress(progress(created.id, { score: 40 }), 0), { ok: true });
      const stored = await repository.getProgress(created.id, 'survival', WORLD);
      assert.equal(stored.score, 40);
      assert.equal(stored.revision, 1);
      assert.deepEqual(stored.state.explored, [0]);
    } finally {
      await repository.close();
    }
  });

  test(`[${label}] la escritura condicional por revisión evita duplicados y datos viejos`, { skip }, async () => {
    const repository = await createRepository();
    try {
      const { id } = await player(repository);
      assert.equal((await repository.saveProgress(progress(id, { score: 10 }), 0)).ok, true);
      assert.deepEqual(await repository.saveProgress(progress(id, { score: 99 }), 0), { ok: false, reason: 'stale' }, 'no se crea un segundo registro');
      assert.deepEqual(await repository.saveProgress(progress(id, { score: 99, revision: 3 }), 2), { ok: false, reason: 'stale' });
      assert.equal((await repository.getProgress(id, 'survival', WORLD)).score, 10);
      assert.equal((await repository.saveProgress(progress(id, { score: 20, revision: 2 }), 1)).ok, true);
      assert.equal((await repository.getProgress(id, 'survival', WORLD)).score, 20);
    } finally {
      await repository.close();
    }
  });

  test(`[${label}] la clasificación ordena de mayor a menor y desempata por quién llegó primero`, { skip }, async () => {
    const repository = await createRepository();
    try {
      const ana = await player(repository, 'Ana');
      const beto = await player(repository, 'Beto');
      const caro = await player(repository, 'Caro');
      const dani = await player(repository, 'Dani');
      await repository.saveProgress(progress(ana.id, { score: 50, updatedAt: 3000 }), 0);
      await repository.saveProgress(progress(beto.id, { score: 80, updatedAt: 5000 }), 0);
      await repository.saveProgress(progress(caro.id, { score: 50, updatedAt: 2000 }), 0);

      const top = await repository.topScores('survival', 10);
      assert.deepEqual(top.map(({ name, position, score }) => [position, name, score]), [[1, 'Beto', 80], [2, 'Caro', 50], [3, 'Ana', 50]]);
      assert.deepEqual((await repository.topScores('survival', 2)).map(({ name }) => name), ['Beto', 'Caro'], 'respeta el límite');
      assert.equal((await repository.standingOf('survival', ana.id)).position, 3);
      assert.equal((await repository.standingOf('survival', caro.id)).position, 2);
      assert.equal(await repository.standingOf('survival', dani.id), null, 'sin puntuación no figura');
    } finally {
      await repository.close();
    }
  });

  test(`[${label}] la mejor marca solo sube y conserva cuándo se alcanzó`, { skip }, async () => {
    const repository = await createRepository();
    try {
      const { id } = await player(repository);
      await repository.saveProgress(progress(id, { score: 70, updatedAt: 1000 }), 0);
      await repository.saveProgress(progress(id, { score: 30, revision: 2, updatedAt: 2000 }), 1);
      await repository.saveProgress(progress(id, { score: 70, revision: 3, updatedAt: 3000 }), 2);
      const standing = await repository.standingOf('survival', id);
      assert.equal(standing.score, 70);
      assert.equal(standing.achievedAt, 1000, 'empatar la propia marca no cambia la fecha');

      await repository.saveProgress(progress(id, { score: 90, revision: 4, updatedAt: 4000 }), 3);
      assert.equal((await repository.standingOf('survival', id)).achievedAt, 4000);
    } finally {
      await repository.close();
    }
  });

  test(`[${label}] cada modo tiene su propia clasificación y un jugador figura una sola vez`, { skip }, async () => {
    const repository = await createRepository();
    try {
      const { id } = await player(repository);
      await repository.saveProgress(progress(id, { score: 500, mode: 'creative' }), 0);
      await repository.saveProgress(progress(id, { score: 20 }), 0);
      await repository.saveProgress(progress(id, { score: 35, worldKey: 's2-v2-32x24x32' }), 0);

      const survival = await repository.topScores('survival', 10);
      assert.equal(survival.length, 1, 'varios mundos, una sola entrada por jugador');
      assert.equal(survival[0].score, 35, 'cuenta el mejor mundo');
      assert.equal((await repository.topScores('creative', 10))[0].score, 500);
      assert.deepEqual(await repository.topScores('nonexistent', 10), []);
    } finally {
      await repository.close();
    }
  });

  test(`[${label}] una tabla vacía responde sin errores`, { skip }, async () => {
    const repository = await createRepository();
    try {
      assert.deepEqual(await repository.topScores('survival', 10), []);
      assert.equal(await repository.standingOf('survival', '00000000-0000-4000-8000-000000000000'), null);
    } finally {
      await repository.close();
    }
  });
}
