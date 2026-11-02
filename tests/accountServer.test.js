import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { startTestApi, FakeClock } from './support/apiServer.js';
import { defaultWorld } from './support/progression.js';
import { LoginThrottle } from '../server/security/LoginThrottle.js';
import { BackendAuthClient } from '../src/auth/BackendAuthClient.js';
import { AuthService } from '../src/auth/AuthService.js';
import { SessionManager } from '../src/auth/SessionManager.js';

const servers = [];
after(() => Promise.all(servers.map((server) => server.close())));

async function api(options) {
  const server = await startTestApi(options);
  servers.push(server);
  return server;
}

const PASSWORD = 'clave-segura-1';

function register(server, { username = 'tobias', email = 'tobias@nexo.test', password = PASSWORD, guestToken } = {}) {
  return server.call('POST', '/auth/register', { body: { username, email, password, guestToken } });
}

function login(server, identifier, password = PASSWORD, guestToken) {
  return server.call('POST', '/auth/login', { body: { identifier, password, guestToken } });
}

function emptyState() {
  return { version: 1, explored: [], biomes: [], mined: {}, blocksBuilt: 0 };
}

test('registrarse crea la cuenta, abre una sesión y le asigna un jugador', async () => {
  const server = await api();
  const { status, body } = await register(server, { username: 'Tobias_C', email: ' Tobias@Nexo.Test ' });
  assert.equal(status, 201);
  assert.ok(body.token.length >= 40);
  assert.ok(body.expiresAt > server.clock.now);
  assert.equal(body.user.username, 'Tobias_C');
  assert.equal(body.user.email, 'tobias@nexo.test');
  assert.match(body.user.playerId, /^[0-9a-f-]{36}$/);
  assert.equal(body.user.credential, undefined, 'la credencial nunca sale del servidor');

  const stored = await server.accountRepository.findAccountById(body.user.id);
  assert.equal(stored.usernameKey, 'tobias_c');
  assert.notEqual(stored.credential.hash, PASSWORD);
  assert.equal(JSON.stringify(stored).includes(PASSWORD), false, 'la contraseña no se guarda');
});

test('no se repiten nombres (sin importar mayúsculas) ni correos', async () => {
  const server = await api();
  await register(server);
  const sameName = await register(server, { username: 'TOBIAS', email: 'otro@nexo.test' });
  assert.equal(sameName.status, 409);
  assert.equal(sameName.body.code, 'USERNAME_TAKEN');
  const sameEmail = await register(server, { username: 'otro', email: 'TOBIAS@nexo.test' });
  assert.equal(sameEmail.status, 409);
  assert.equal(sameEmail.body.code, 'EMAIL_TAKEN');
});

test('el registro valida los datos con las mismas reglas que el juego', async () => {
  const server = await api();
  const cases = [
    [{ username: 'ab' }, 'INVALID_USERNAME'],
    [{ username: 'con espacio' }, 'INVALID_USERNAME'],
    [{ email: 'sin-arroba' }, 'INVALID_EMAIL'],
    [{ email: '' }, 'INVALID_EMAIL'],
    [{ password: 'corta' }, 'INVALID_PASSWORD']
  ];
  for (const [data, code] of cases) {
    const { status, body } = await register(server, data);
    assert.equal(status, 400, JSON.stringify(data));
    assert.equal(body.code, code);
    assert.ok(body.message.length > 0);
  }
});

test('se inicia sesión con el usuario o con el correo', async () => {
  const server = await api();
  const created = (await register(server)).body;

  for (const identifier of ['tobias', 'TOBIAS', 'tobias@nexo.test']) {
    const { status, body } = await login(server, identifier);
    assert.equal(status, 200, identifier);
    assert.equal(body.user.id, created.user.id);
    assert.equal(body.user.playerId, created.user.playerId, 'la cuenta conserva su jugador');
    assert.notEqual(body.token, created.token, 'cada inicio abre una sesión nueva');
  }
});

test('usuario inexistente y contraseña errónea dan el mismo error', async () => {
  const server = await api();
  await register(server);
  const wrongPassword = await login(server, 'tobias', 'otra-clave-123');
  const unknownUser = await login(server, 'nadie', PASSWORD);
  assert.equal(wrongPassword.status, 401);
  assert.deepEqual(wrongPassword.body, unknownUser.body);
  assert.equal(wrongPassword.body.code, 'INVALID_CREDENTIALS');

  const missing = await server.call('POST', '/auth/login', { body: { identifier: 'tobias' } });
  assert.equal(missing.status, 400);
});

test('demasiados intentos fallidos bloquean esa cuenta por un rato', async () => {
  const server = await api({ throttle: new LoginThrottle({ maxFailures: 3, windowMs: 60_000 }) });
  await register(server);
  for (let attempt = 0; attempt < 3; attempt += 1) assert.equal((await login(server, 'tobias', 'mala-clave-1')).status, 401);

  const blocked = await login(server, 'tobias');
  assert.equal(blocked.status, 429, 'ni siquiera la clave correcta entra mientras dura el bloqueo');
  assert.equal(blocked.body.code, 'RATE_LIMITED');
  assert.ok(blocked.body.retryAfterSeconds > 0);

  server.clock.advanceMinutes(2);
  assert.equal((await login(server, 'tobias')).status, 200);
});

test('la sesión se verifica, se cierra y vence', async () => {
  const server = await api();
  const { token, user } = (await register(server)).body;

  const session = await server.call('GET', '/auth/session', { token });
  assert.equal(session.status, 200);
  assert.equal(session.body.user.id, user.id);
  const profile = await server.call('GET', '/user/profile', { token });
  assert.equal(profile.body.user.username, 'tobias');

  assert.equal((await server.call('POST', '/auth/logout', { token })).status, 200);
  const closed = await server.call('GET', '/auth/session', { token });
  assert.equal(closed.status, 401);
  assert.equal(closed.body.code, 'UNAUTHORIZED');

  const second = (await login(server, 'tobias')).body;
  server.clock.advanceMinutes(8 * 24 * 60);
  assert.equal((await server.call('GET', '/auth/session', { token: second.token })).status, 401, 'vence a los 7 días');
  assert.equal((await server.call('GET', '/auth/session')).status, 401, 'sin token');
});

test('al registrarse, el invitado del navegador pasa a la cuenta con su progreso', async () => {
  const server = await api();
  const guest = (await server.call('POST', '/players', { body: { name: 'Jugador-0042' } })).body;
  const { worldKey } = defaultWorld();
  const saved = await server.call('PUT', '/progress', {
    token: guest.token,
    body: { mode: 'survival', world: worldKey, revision: 1, state: { ...emptyState(), explored: [0, 1] } }
  });
  assert.equal(saved.status, 200);

  const { body } = await register(server, { guestToken: guest.token });
  assert.equal(body.user.playerId, guest.playerId);

  const board = await server.call('GET', '/leaderboard?mode=survival');
  assert.deepEqual(board.body.entries.map((entry) => [entry.playerId, entry.name]), [[guest.playerId, 'tobias']]);

  // Con la sesión iniciada, el token de sesión sirve para leer y guardar ese mismo progreso.
  const progress = await server.call('GET', `/progress?mode=survival&world=${worldKey}`, { token: body.token });
  assert.equal(progress.status, 200);
  assert.deepEqual(progress.body.progress.state.explored, [0, 1]);
});

test('un invitado ya vinculado no se adopta en otra cuenta', async () => {
  const server = await api();
  const guest = (await server.call('POST', '/players', { body: { name: 'Jugador-0001' } })).body;
  const first = (await register(server, { guestToken: guest.token })).body;
  const second = (await register(server, { username: 'andrea', email: 'andrea@nexo.test', guestToken: guest.token })).body;
  assert.equal(first.user.playerId, guest.playerId);
  assert.notEqual(second.user.playerId, guest.playerId);
  assert.ok(second.user.playerId);

  // Iniciar sesión desde otro navegador no cambia el jugador de una cuenta que ya tiene uno.
  const other = (await server.call('POST', '/players', { body: { name: 'Jugador-0002' } })).body;
  const again = (await login(server, 'andrea', PASSWORD, other.token)).body;
  assert.equal(again.user.playerId, second.user.playerId);
});

test('una cuenta sin progreso puede guardar con el token de sesión', async () => {
  const server = await api();
  const { token, user } = (await register(server)).body;
  const { worldKey } = defaultWorld();
  const saved = await server.call('PUT', '/progress', {
    token,
    body: { mode: 'survival', world: worldKey, revision: 1, state: { ...emptyState(), explored: [0] } }
  });
  assert.equal(saved.status, 200);
  const standing = await server.call('GET', `/leaderboard/players/${user.playerId}?mode=survival`);
  assert.equal(standing.body.name, 'tobias');
  assert.equal(standing.body.position, 1);
});

test('editar el perfil cambia el nombre en la clasificación y la contraseña exige la actual', async () => {
  const server = await api();
  const { token, user } = (await register(server)).body;
  const otherDevice = (await login(server, 'tobias')).body.token;

  const renamed = await server.call('PUT', '/user/profile', { token, body: { username: 'Tobi' } });
  assert.equal(renamed.status, 200);
  assert.equal(renamed.body.user.username, 'Tobi');
  assert.equal((await server.repository.findPlayerByAccountId(user.id)).name, 'Tobi');

  const noCurrent = await server.call('PUT', '/user/profile', { token, body: { newPassword: 'nueva-clave-1' } });
  assert.equal(noCurrent.status, 401);
  const wrongCurrent = await server.call('PUT', '/user/profile', { token, body: { currentPassword: 'x', newPassword: 'nueva-clave-1' } });
  assert.equal(wrongCurrent.body.message, 'La contraseña actual no es correcta.');

  const changed = await server.call('PUT', '/user/profile', { token, body: { currentPassword: PASSWORD, newPassword: 'nueva-clave-1' } });
  assert.equal(changed.status, 200);
  assert.equal((await login(server, 'tobi', 'nueva-clave-1')).status, 200);
  assert.equal((await login(server, 'tobi', PASSWORD)).status, 401);
  assert.equal((await server.call('GET', '/auth/session', { token })).status, 200, 'la sesión que hizo el cambio sigue abierta');
  assert.equal((await server.call('GET', '/auth/session', { token: otherDevice })).status, 401, 'las demás se cierran');

  await register(server, { username: 'andrea', email: 'andrea@nexo.test' });
  const taken = await server.call('PUT', '/user/profile', { token, body: { username: 'ANDREA' } });
  assert.equal(taken.body.code, 'USERNAME_TAKEN');
});

test('recuperar la contraseña responde que no está disponible', async () => {
  const server = await api();
  const { status, body } = await server.call('POST', '/auth/recover-password', { body: { email: 'a@b.c' } });
  assert.equal(status, 501);
  assert.equal(body.code, 'NOT_SUPPORTED');
});

test('AuthService y BackendAuthClient funcionan contra el servidor real', async () => {
  // AuthSession compara el vencimiento con la hora real: el servidor usa la misma.
  const server = await api({ clock: new FakeClock(Date.now()) });
  const guest = (await server.call('POST', '/players', { body: { name: 'Jugador-0007' } })).body;
  const client = new BackendAuthClient({ fetchFn: server.fetchFn, guestTokenProvider: () => guest.token });
  const auth = new AuthService({ client, sessionManager: new SessionManager(null) });

  const created = await auth.register({ username: 'leandro', email: 'leandro@nexo.test', password: PASSWORD, confirmPassword: PASSWORD });
  assert.equal(created.ok, true, created.message);
  assert.equal(auth.isAuthenticated, true);
  assert.equal(auth.getCurrentUser().playerId, guest.playerId, 'se envió el token de invitado');

  const updated = await auth.updateProfile({ username: 'Leandro_C' });
  assert.equal(updated.ok, true, updated.message);
  await auth.logout();
  assert.equal(auth.isAuthenticated, false);

  const wrong = await auth.login({ identifier: 'leandro_c', password: 'mala-clave-1' });
  assert.equal(wrong.ok, false);
  assert.equal(wrong.code, 'INVALID_CREDENTIALS');
  assert.equal((await auth.login({ identifier: 'leandro@nexo.test', password: PASSWORD })).ok, true);
});

test('sin servidor, BackendAuthClient avisa que no hay conexión', async () => {
  const proxyWithoutServer = async () => new Response('', { status: 502 });
  const client = new BackendAuthClient({ fetchFn: proxyWithoutServer });
  const result = await client.login({ identifier: 'x', password: 'y' });
  assert.equal(result.ok, false);
  assert.equal(result.code, 'NETWORK_ERROR');

  const unreachable = new BackendAuthClient({ fetchFn: async () => { throw new TypeError('fetch failed'); } });
  assert.equal((await unreachable.login({ identifier: 'x', password: 'y' })).code, 'NETWORK_ERROR');
});
