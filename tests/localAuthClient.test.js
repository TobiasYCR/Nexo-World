import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LocalAuthClient } from '../src/users/LocalAuthClient.js';
import { UserManager } from '../src/users/UserManager.js';
import { UserRepository } from '../src/users/UserRepository.js';
import { PasswordHasher } from '../src/users/PasswordHasher.js';
import { AuthService } from '../src/auth/AuthService.js';
import { SessionManager } from '../src/auth/SessionManager.js';
import { GameConfig } from '../src/game/GameConfig.js';

const PASSWORD = 'contrasena123';

/** Storage en memoria con la interfaz de localStorage. */
class MemoryStorage {
  #items = new Map();
  getItem(key) { return this.#items.has(key) ? this.#items.get(key) : null; }
  setItem(key, value) { this.#items.set(key, String(value)); }
  removeItem(key) { this.#items.delete(key); }
  get keys() { return [...this.#items.keys()]; }
}

/** PBKDF2 barato: la configuración real tarda ~40 ms por derivación. */
function fastHasher() {
  return new PasswordHasher(globalThis.crypto, {
    PBKDF2_ITERATIONS: 1000,
    SALT_BYTES: GameConfig.users.SALT_BYTES,
    DERIVED_KEY_BYTES: GameConfig.users.DERIVED_KEY_BYTES
  });
}

function build() {
  const storage = new MemoryStorage();
  const users = new UserManager(new UserRepository(storage), fastHasher());
  return { client: new LocalAuthClient({ users, storage }), storage, users };
}

test('registrarse abre sesión y devuelve token, vencimiento y usuario', async () => {
  const { client } = build();
  const r = await client.register({ username: 'Leandro', email: 'leandro@test.com', password: PASSWORD });

  assert.equal(r.ok, true);
  assert.ok(typeof r.data.token === 'string' && r.data.token.length > 0);
  assert.ok(Number.isFinite(r.data.expiresAt));
  assert.equal(r.data.user.username, 'Leandro');
  assert.equal(r.data.user.email, 'leandro@test.com');
  // La credencial no se filtra nunca a la interfaz.
  assert.equal('credential' in r.data.user, false);
});

test('se puede iniciar sesión con el nombre o con el correo', async () => {
  const { client } = build();
  await client.register({ username: 'Leandro', email: 'leandro@test.com', password: PASSWORD });

  assert.equal((await client.login({ identifier: 'Leandro', password: PASSWORD })).ok, true);
  assert.equal((await client.login({ identifier: 'LEANDRO@TEST.COM', password: PASSWORD })).ok, true);
});

test('rechaza credenciales incorrectas sin decir cuál falló', async () => {
  const { client } = build();
  await client.register({ username: 'Leandro', email: 'leandro@test.com', password: PASSWORD });

  const claveMala = await client.login({ identifier: 'Leandro', password: 'otra-clave-1' });
  const inexistente = await client.login({ identifier: 'nadie', password: PASSWORD });

  assert.equal(claveMala.code, 'INVALID_CREDENTIALS');
  assert.equal(inexistente.code, 'INVALID_CREDENTIALS');
  assert.equal(claveMala.message, inexistente.message);
});

test('la sesión se verifica, se cierra y entonces deja de valer', async () => {
  const { client } = build();
  const { data } = await client.register({ username: 'Leandro', email: 'leandro@test.com', password: PASSWORD });

  assert.equal((await client.verifySession(data.token)).ok, true);
  assert.equal((await client.getProfile(data.token)).data.user.username, 'Leandro');

  await client.logout(data.token);
  assert.equal((await client.verifySession(data.token)).code, 'UNAUTHORIZED');
});

test('una sesión vencida no sirve', async () => {
  const storage = new MemoryStorage();
  const users = new UserManager(new UserRepository(storage), fastHasher());
  let ahora = 1000;
  const client = new LocalAuthClient({ users, storage, ttlMs: 5000, clock: () => ahora });

  const { data } = await client.register({ username: 'Leandro', password: PASSWORD });
  assert.equal((await client.verifySession(data.token)).ok, true);

  ahora += 6000;
  assert.equal((await client.verifySession(data.token)).code, 'UNAUTHORIZED');
});

test('un token inventado no abre nada', async () => {
  const { client } = build();
  await client.register({ username: 'Leandro', password: PASSWORD });
  for (const token of ['inventado', '', null, undefined]) {
    assert.equal((await client.verifySession(token)).ok, false);
  }
});

test('actualizar el perfil cambia nombre y contraseña', async () => {
  const { client } = build();
  const { data } = await client.register({ username: 'Leandro', password: PASSWORD });

  const renombrado = await client.updateProfile(data.token, { username: 'leandro-nuevo' });
  assert.equal(renombrado.ok, true);
  assert.equal(renombrado.data.user.username, 'leandro-nuevo');

  const conClaveMala = await client.updateProfile(data.token, {
    currentPassword: 'no-es', newPassword: 'nueva-clave-1'
  });
  assert.equal(conClaveMala.code, 'INVALID_CREDENTIALS');

  const cambiada = await client.updateProfile(data.token, {
    currentPassword: PASSWORD, newPassword: 'nueva-clave-1'
  });
  assert.equal(cambiada.ok, true);
  assert.equal((await client.login({ identifier: 'leandro-nuevo', password: 'nueva-clave-1' })).ok, true);
});

// Sin servidor de correo no hay forma de verificar que quien pide la
// recuperación es el dueño. Se dice, en vez de fingir que se mandó un mail.
test('recuperar la contraseña avisa que no está disponible', async () => {
  const { client } = build();
  const r = await client.recoverPassword({ email: 'leandro@test.com' });
  assert.equal(r.ok, false);
  assert.equal(r.code, 'NOT_SUPPORTED');
  assert.ok(r.message.includes('servidor'));
});

test('no se guarda la contraseña en texto plano', async () => {
  const { client, storage } = build();
  await client.register({ username: 'Leandro', email: 'leandro@test.com', password: PASSWORD });
  const volcado = storage.keys.map((k) => storage.getItem(k)).join('\n');
  assert.equal(volcado.includes(PASSWORD), false);
});

// La prueba que cierra el problema documentado: AuthService con este cliente
// registra de verdad, en vez de fallar con "No se pudo conectar con el
// servidor de autenticación".
test('AuthService completo registra e inicia sesión sin servidor', async () => {
  const storage = new MemoryStorage();
  const users = new UserManager(new UserRepository(storage), fastHasher());
  const service = new AuthService({
    client: new LocalAuthClient({ users, storage }),
    sessionManager: new SessionManager(storage)
  });

  const registro = await service.register({
    username: 'Leandro',
    email: 'leandro@test.com',
    password: PASSWORD,
    confirmPassword: PASSWORD
  });
  assert.equal(registro.ok, true, registro.message);
  assert.equal(registro.user.username, 'Leandro');

  const ingreso = await service.login({ identifier: 'leandro@test.com', password: PASSWORD });
  assert.equal(ingreso.ok, true, ingreso.message);
});

// Regresión: la interfaz pedía 6 caracteres y la capa de datos exigía 8, así
// que una contraseña de 7 pasaba la pantalla y fallaba después sin explicación.
test('la interfaz y la capa de datos exigen el mismo largo de contraseña', async () => {
  const minimo = GameConfig.users.PASSWORD_MIN_LENGTH;
  const corta = 'a'.repeat(minimo - 1);
  const { client } = build();

  const service = new AuthService({ client, sessionManager: new SessionManager(new MemoryStorage()) });

  const r = await service.register({
    username: 'Leandro', email: 'leandro@test.com', password: corta, confirmPassword: corta
  });
  assert.equal(r.ok, false);
  assert.equal(r.code, 'INVALID_PASSWORD');
  assert.ok(r.message.includes(String(minimo)), `el mensaje debería nombrar ${minimo}: ${r.message}`);
});
