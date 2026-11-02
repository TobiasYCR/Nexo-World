import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PlayerTokens } from '../../server/security/PlayerTokens.js';

/**
 * Pruebas de contrato de AccountRepository y de la parte de cuentas de
 * ProgressionRepository. Se ejecutan igual en memoria y sobre MySQL.
 * @param {string} label
 * @param {() => Promise<{accounts:object, players:object, close:()=>Promise<void>}>} createStores repositorios vacíos
 * @param {{skip?: string|false}} [options]
 */
export function defineAccountRepositoryContract(label, createStores, { skip = false } = {}) {
  let sequence = 0;

  function account(name, email = `${name}@nexo.test`) {
    sequence += 1;
    return {
      id: `10000000-0000-4000-8000-${String(sequence).padStart(12, '0')}`,
      username: name,
      usernameKey: name.toLowerCase(),
      email,
      emailKey: email.toLowerCase(),
      credential: { algorithm: 'PBKDF2-SHA-256', iterations: 1000, salt: 'c2Fs', hash: 'aGFzaA==' },
      createdAt: 1000,
      updatedAt: 1000
    };
  }

  function guest(name = 'Jugador') {
    sequence += 1;
    return {
      id: `20000000-0000-4000-8000-${String(sequence).padStart(12, '0')}`,
      name,
      tokenHash: PlayerTokens.hash(`guest-${label}-${sequence}`),
      accountId: null,
      createdAt: 1000
    };
  }

  async function withStores(run) {
    const stores = await createStores();
    try {
      await run(stores);
    } finally {
      await stores.close();
    }
  }

  test(`[${label}] guarda cuentas y las encuentra por nombre o correo`, { skip }, () => withStores(async ({ accounts }) => {
    const tobias = account('Tobias');
    assert.deepEqual(await accounts.createAccount(tobias), { ok: true });
    assert.deepEqual(await accounts.findAccountById(tobias.id), tobias);
    assert.deepEqual(await accounts.findAccountByLogin('tobias'), tobias);
    assert.deepEqual(await accounts.findAccountByLogin('tobias@nexo.test'), tobias);
    assert.equal(await accounts.findAccountByLogin('nadie'), null);
    assert.equal(await accounts.findAccountById('10000000-0000-4000-8000-999999999999'), null);
  }));

  test(`[${label}] rechaza nombres y correos repetidos`, { skip }, () => withStores(async ({ accounts }) => {
    await accounts.createAccount(account('Tobias'));
    assert.deepEqual(await accounts.createAccount(account('TOBIAS', 'otro@nexo.test')), { ok: false, reason: 'username-taken' });
    assert.deepEqual(await accounts.createAccount(account('otro', 'Tobias@nexo.test')), { ok: false, reason: 'email-taken' });
  }));

  test(`[${label}] actualiza nombre y credencial`, { skip }, () => withStores(async ({ accounts }) => {
    const tobias = account('Tobias');
    const andrea = account('Andrea');
    await accounts.createAccount(tobias);
    await accounts.createAccount(andrea);

    const credential = { ...tobias.credential, hash: 'bnVldm8=' };
    assert.deepEqual(await accounts.updateAccount(tobias.id, { username: 'Tobi', usernameKey: 'tobi', credential, updatedAt: 2000 }), { ok: true });
    const updated = await accounts.findAccountById(tobias.id);
    assert.equal(updated.username, 'Tobi');
    assert.deepEqual(updated.credential, credential);
    assert.equal(updated.updatedAt, 2000);

    assert.deepEqual(await accounts.updateAccount(tobias.id, { username: 'andrea', usernameKey: 'andrea', updatedAt: 3000 }), { ok: false, reason: 'username-taken' });
    assert.deepEqual(await accounts.updateAccount('10000000-0000-4000-8000-999999999999', { updatedAt: 1 }), { ok: false, reason: 'not-found' });
  }));

  test(`[${label}] guarda, busca y borra sesiones`, { skip }, () => withStores(async ({ accounts }) => {
    const tobias = account('Tobias');
    await accounts.createAccount(tobias);
    const sessions = ['a', 'b', 'c'].map((seed, index) => ({
      tokenHash: PlayerTokens.hash(`${label}-${seed}-${sequence}`),
      accountId: tobias.id,
      createdAt: 1000,
      expiresAt: 5000 + index * 1000
    }));
    for (const session of sessions) await accounts.createSession(session);
    assert.deepEqual(await accounts.findSession(sessions[0].tokenHash), sessions[0]);

    await accounts.deleteSession(sessions[0].tokenHash);
    assert.equal(await accounts.findSession(sessions[0].tokenHash), null);

    await accounts.deleteExpiredSessions(6000);
    assert.equal(await accounts.findSession(sessions[1].tokenHash), null, 'vencida');
    assert.deepEqual(await accounts.findSession(sessions[2].tokenHash), sessions[2]);

    const extra = { ...sessions[2], tokenHash: PlayerTokens.hash(`${label}-extra-${sequence}`) };
    await accounts.createSession(extra);
    await accounts.deleteSessionsOfAccount(tobias.id, extra.tokenHash);
    assert.equal(await accounts.findSession(sessions[2].tokenHash), null);
    assert.deepEqual(await accounts.findSession(extra.tokenHash), extra, 'la excluida sigue abierta');
  }));

  test(`[${label}] vincula un invitado a una cuenta una sola vez`, { skip }, () => withStores(async ({ accounts, players }) => {
    const tobias = account('Tobias');
    const andrea = account('Andrea');
    await accounts.createAccount(tobias);
    await accounts.createAccount(andrea);
    const first = guest('Jugador-0001');
    const second = guest('Jugador-0002');
    await players.createPlayer(first);
    await players.createPlayer(second);

    assert.equal(await players.findPlayerByAccountId(tobias.id), null);
    assert.equal(await players.linkPlayerToAccount(first.id, tobias.id, 'Tobias'), true);
    assert.deepEqual(await players.findPlayerByAccountId(tobias.id), { ...first, accountId: tobias.id, name: 'Tobias' });

    assert.equal(await players.linkPlayerToAccount(first.id, andrea.id, 'Andrea'), false, 'ya tiene cuenta');
    assert.equal(await players.linkPlayerToAccount(second.id, tobias.id, 'Tobias'), false, 'la cuenta ya tiene jugador');

    await players.renameAccountPlayer(tobias.id, 'Tobi');
    assert.equal((await players.findPlayerById(first.id)).name, 'Tobi');
    assert.equal((await players.findPlayerById(second.id)).name, 'Jugador-0002');
  }));
}
