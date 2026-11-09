import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { startTestApi, FakeClock } from './support/apiServer.js';
import { installDomStub, uninstallDomStub } from './support/domStub.js';
import { AdminCommands } from '../server/admin/AdminCommands.js';
import { ResetCode } from '../server/security/ResetCode.js';
import { LoginThrottle } from '../server/security/LoginThrottle.js';
import { BackendAuthClient } from '../src/auth/BackendAuthClient.js';
import { AuthService } from '../src/auth/AuthService.js';
import { SessionManager } from '../src/auth/SessionManager.js';
import { PasswordRecoveryScreen } from '../src/interface/screens/PasswordRecoveryScreen.js';

const servers = [];
after(() => Promise.all(servers.map((server) => server.close())));

async function api(options) {
  const server = await startTestApi(options);
  servers.push(server);
  await server.call('POST', '/auth/register', { body: { username: 'tobias', email: 'tobias@nexo.test', password: 'clave-vieja-1' } });
  return server;
}

/** Corre el comando de administrador y devuelve lo que imprimió. */
async function admin(server, ...args) {
  const lines = [];
  const output = { log: (text) => lines.push(text), error: (text) => lines.push(text) };
  const exitCode = await new AdminCommands(server.accounts, output).run(args);
  return { exitCode, text: lines.join('\n') };
}

function codeFrom(text) {
  return /([A-Z2-9]{4}-[A-Z2-9]{4})/.exec(text)?.[1];
}

function reset(server, identifier, code, newPassword = 'clave-nueva-1') {
  return server.call('POST', '/auth/reset-password', { body: { identifier, code, newPassword } });
}

test('ResetCode genera códigos legibles y acepta cómo los escribe la gente', () => {
  const code = ResetCode.generate();
  assert.match(code, /^[A-Z2-9]{4}-[A-Z2-9]{4}$/);
  assert.doesNotMatch(code, /[01ILO]/);
  assert.equal(ResetCode.normalize(' abcd efgh '), 'ABCDEFGH');
  assert.equal(ResetCode.normalize('ABCD-EFGH'), 'ABCDEFGH');
});

test('el administrador genera un código y con él se pone una contraseña nueva', async () => {
  const server = await api();
  const session = (await server.call('POST', '/auth/login', { body: { identifier: 'tobias', password: 'clave-vieja-1' } })).body.token;

  const { exitCode, text } = await admin(server, 'reset-password', 'tobias@nexo.test');
  assert.equal(exitCode, 0);
  assert.match(text, /tobias \(tobias@nexo\.test\)/);
  const code = codeFrom(text);
  assert.ok(code, text);

  const changed = await reset(server, 'TOBIAS', code.toLowerCase().replace('-', ' '));
  assert.equal(changed.status, 200, JSON.stringify(changed.body));
  assert.equal((await server.call('POST', '/auth/login', { body: { identifier: 'tobias', password: 'clave-nueva-1' } })).status, 200);
  assert.equal((await server.call('POST', '/auth/login', { body: { identifier: 'tobias', password: 'clave-vieja-1' } })).status, 401);
  assert.equal((await server.call('GET', '/auth/session', { token: session })).status, 401, 'cierra las sesiones abiertas');

  const again = await reset(server, 'tobias', code, 'otra-clave-12');
  assert.equal(again.body.code, 'INVALID_RESET_CODE', 'sirve una sola vez');
});

test('el código vence, es de una sola cuenta y generar otro anula el anterior', async () => {
  const server = await api();
  await server.call('POST', '/auth/register', { body: { username: 'andrea', email: 'andrea@nexo.test', password: 'clave-andrea-1' } });

  const first = codeFrom((await admin(server, 'reset-password', 'tobias')).text);
  const second = codeFrom((await admin(server, 'reset-password', 'tobias')).text);
  assert.equal((await reset(server, 'tobias', first)).body.code, 'INVALID_RESET_CODE', 'el viejo quedó anulado');
  assert.equal((await reset(server, 'andrea', second)).body.code, 'INVALID_RESET_CODE', 'no sirve para otra cuenta');

  server.clock.advanceMinutes(31);
  assert.equal((await reset(server, 'tobias', second)).body.code, 'INVALID_RESET_CODE', 'vence a los 30 minutos');
});

test('valida la contraseña nueva y limita los intentos', async () => {
  const server = await api({ throttle: new LoginThrottle({ maxFailures: 3, windowMs: 60_000 }) });
  const code = codeFrom((await admin(server, 'reset-password', 'tobias')).text);
  assert.equal((await reset(server, 'tobias', code, 'corta')).body.code, 'INVALID_PASSWORD');
  assert.equal((await server.call('POST', '/auth/reset-password', { body: { identifier: 'tobias' } })).status, 400);

  for (let attempt = 0; attempt < 3; attempt += 1) await reset(server, 'tobias', 'AAAA-AAAA');
  const blocked = await reset(server, 'tobias', code);
  assert.equal(blocked.body.code, 'RATE_LIMITED', 'ni el código correcto pasa durante el bloqueo');
  server.clock.advanceMinutes(2);
  assert.equal((await reset(server, 'tobias', code)).status, 200);
});

test('el comando de administrador explica cómo se usa', async () => {
  const server = await api();
  const missing = await admin(server, 'reset-password');
  assert.equal(missing.exitCode, 1);
  assert.match(missing.text, /Falta el usuario/);
  const unknown = await admin(server, 'borrar-todo');
  assert.equal(unknown.exitCode, 1);
  assert.match(unknown.text, /Comando desconocido/);
  const nobody = await admin(server, 'reset-password', 'nadie');
  assert.equal(nobody.exitCode, 1);
  assert.match(nobody.text, /No hay ninguna cuenta/);
});

test('la pantalla de recuperación usa el código contra el servidor real', async () => {
  installDomStub();
  try {
    const server = await api({ clock: new FakeClock(Date.now()) });
    const code = codeFrom((await admin(server, 'reset-password', 'tobias')).text);
    const auth = new AuthService({ client: new BackendAuthClient({ fetchFn: server.fetchFn }), sessionManager: new SessionManager(null) });
    const screen = new PasswordRecoveryScreen(auth);

    screen.identifierInput.value = 'tobias';
    screen.codeInput.value = code;
    screen.passwordInput.value = 'clave-nueva-1';
    screen.confirmInput.value = 'otra-cosa-123';
    assert.equal((await screen.submit()).code, 'PASSWORD_MISMATCH');

    screen.confirmInput.value = 'clave-nueva-1';
    const result = await screen.submit();
    assert.equal(result.ok, true, result.message);
    assert.match(screen.statusMessage.textContent, /iniciar sesión/);
    assert.equal(screen.codeInput.value, '');
    assert.equal((await auth.login({ identifier: 'tobias', password: 'clave-nueva-1' })).ok, true);
  } finally {
    uninstallDomStub();
  }
});
