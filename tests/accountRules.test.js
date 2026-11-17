import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { startTestApi } from './support/apiServer.js';
import { AdminCommands } from '../server/admin/AdminCommands.js';
import { DemoPlayers } from '../server/admin/DemoPlayers.js';
import { UserValidator } from '../src/users/UserValidator.js';
import { AuthService } from '../src/auth/AuthService.js';

const servers = [];
after(() => Promise.all(servers.map((server) => server.close())));

async function api() {
  const server = await startTestApi();
  servers.push(server);
  return server;
}

function register(server, username, email, password = 'clave-segura-1') {
  return server.call('POST', '/auth/register', { body: { username, email, password } });
}

async function admin(server, ...args) {
  const lines = [];
  const output = { log: (text) => lines.push(text), error: (text) => lines.push(text) };
  const commands = new AdminCommands(server.accounts, output, {
    accountStore: server.accountRepository,
    players: server.repository,
    clock: server.clock.read
  });
  const exitCode = await commands.run(args);
  return { exitCode, text: lines.join('\n') };
}

test('nombres de usuario: solo letras, números, guion y guion bajo, empezando con letra o número', () => {
  const validator = new UserValidator();
  for (const ok of ['tobias', 'Tobias_2', 'leo-crafter', '123', 'a_b']) {
    assert.equal(validator.checkUsername(ok), null, ok);
  }
  for (const bad of ['ab', 'a'.repeat(21), '_tobias', '-tobias', 'tobi as', 'tobías', 'tobi@s', '<script>', 'tobi.as', "o'neil", '', null, 42]) {
    assert.equal(validator.checkUsername(bad), 'invalid-username', String(bad));
  }
});

test('correos: forma usuario@dominio.ext, sin símbolos raros, espacios ni puntos seguidos', () => {
  const validator = new UserValidator();
  for (const ok of ['tobias@gmail.com', 'Tobi.Caballero+nexo@live.com.ar', 'a_b-c@mi-dominio.edu.ar', 'x@nexo.test']) {
    assert.equal(validator.checkEmail(ok), null, ok);
  }
  for (const bad of [
    'tobias', 'tobias@', '@gmail.com', 'tobias@gmail', 'tobias@gmail.c', 'tobi as@gmail.com', 'tobias@@gmail.com',
    '<script>@x.com', 'tobias"@x.com', "o'neil@x.com", 'a..b@x.com', '.tobias@x.com', 'tobias.@x.com',
    'tobias@-x.com', 'tobias@x-.com', 'tobias@x..com', 'tobías@x.com', 'tobias@x.com1', 'tobias@x.com;drop', `${'a'.repeat(250)}@x.com`
  ]) {
    assert.equal(validator.checkEmail(bad), 'invalid-email', bad);
  }
});

test('la pantalla de registro usa las mismas reglas que el servidor', () => {
  const auth = new AuthService();
  assert.equal(auth.validateUsername('leo-crafter').ok, true, 'el guion también vale en pantalla');
  assert.equal(auth.validateUsername('_leo').ok, false);
  assert.equal(auth.validateEmail('<script>@x.com').ok, false);
  assert.equal(auth.validateEmail('a..b@x.com').ok, false);
  assert.equal(auth.validateEmail('tobias@live.com.ar').ok, true);
});

test('no se repiten nombres ni correos, sin importar mayúsculas ni espacios', async () => {
  const server = await api();
  assert.equal((await register(server, 'tobias', 'tobias@live.com.ar')).status, 201);

  const sameName = await register(server, '  TOBIAS ', 'otro@live.com.ar');
  assert.equal(sameName.status, 409);
  assert.equal(sameName.body.code, 'USERNAME_TAKEN');

  const sameEmail = await register(server, 'tobias2', ' Tobias@Live.com.AR ');
  assert.equal(sameEmail.status, 409);
  assert.equal(sameEmail.body.code, 'EMAIL_TAKEN');

  const bad = await register(server, 'hacker', '<img src=x>@x.com');
  assert.equal(bad.status, 400);
  assert.equal(bad.body.code, 'INVALID_EMAIL');
  const badName = await register(server, 'drop table;', 'drop@x.com');
  assert.equal(badName.body.code, 'INVALID_USERNAME');

  // Cambiar el nombre a uno ocupado tampoco se puede.
  const other = await register(server, 'leandro', 'leandro@gmail.com');
  const rename = await server.call('PUT', '/user/profile', { token: other.body.token, body: { username: 'Tobias' } });
  assert.equal(rename.body.code, 'USERNAME_TAKEN');
});

test('seed crea jugadores de ejemplo con puntaje, no duplica y unseed los borra', async () => {
  const server = await api();
  await register(server, 'tobias', 'tobias@live.com.ar');

  const first = await admin(server, 'seed', '5');
  assert.equal(first.exitCode, 0, first.text);
  assert.match(first.text, /Creados: lucia_mc, mateo2010, valen-crafter, sofi_builder, juanpi/);

  const top = await server.call('GET', '/leaderboard?mode=survival&limit=10');
  assert.deepEqual(top.body.entries.map((entry) => entry.name), ['lucia_mc', 'mateo2010', 'juanpi']);
  assert.ok(top.body.entries.every((entry) => entry.score > 0));
  const creative = await server.call('GET', '/leaderboard?mode=creative&limit=10');
  assert.equal(creative.body.entries.length, 2);

  const again = await admin(server, 'seed');
  assert.match(again.text, /Ya existían: lucia_mc, mateo2010, valen-crafter, sofi_builder, juanpi/);
  assert.equal((await server.call('GET', '/leaderboard?mode=survival&limit=20')).body.entries.length,
    DemoPlayers.ROSTER.filter(([, mode]) => mode === 'survival').length);

  const removed = await admin(server, 'unseed');
  assert.match(removed.text, /borrados: 12/);
  assert.equal((await server.call('GET', '/leaderboard?mode=survival&limit=20')).body.entries.length, 0);
  assert.equal((await admin(server, 'usuario', 'tobias')).exitCode, 0, 'la cuenta real no se toca');
  assert.equal((await server.call('POST', '/auth/login', { body: { identifier: 'lucia_mc', password: 'x' } })).status, 401);
});

test('el comando usuario muestra la cuenta y avisa si algo está mal', async () => {
  const server = await api();
  await register(server, 'Tobias', 'Tobias@Live.com.ar');

  const byEmail = await admin(server, 'usuario', 'tobias@live.com.ar');
  assert.equal(byEmail.exitCode, 0, byEmail.text);
  assert.match(byEmail.text, /Usuario: {2}Tobias/);
  assert.match(byEmail.text, /Correo: {3}tobias@live\.com\.ar/);
  assert.match(byEmail.text, /survival +sin puntaje todavía/);
  assert.match(byEmail.text, /Todo en orden\./);

  const missing = await admin(server, 'usuario', 'nadie');
  assert.equal(missing.exitCode, 1);
  assert.match(missing.text, /No hay ninguna cuenta/);
});
