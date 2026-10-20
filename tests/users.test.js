import { test } from 'node:test';
import assert from 'node:assert/strict';
import { UserManager } from '../src/users/UserManager.js';
import { UserRepository } from '../src/users/UserRepository.js';
import { UserAccount } from '../src/users/UserAccount.js';
import { UserResult } from '../src/users/UserResult.js';
import { UserValidator } from '../src/users/UserValidator.js';
import { PasswordHasher } from '../src/users/PasswordHasher.js';
import { SaveManager } from '../src/persistence/SaveManager.js';
import { GameConfig } from '../src/game/GameConfig.js';

const { Reasons } = UserResult;
const PASSWORD = 'contrasena123';

/** Storage en memoria con la interfaz de localStorage. */
class MemoryStorage {
  #items = new Map();

  getItem(key) {
    return this.#items.has(key) ? this.#items.get(key) : null;
  }

  setItem(key, value) {
    this.#items.set(key, String(value));
  }

  removeItem(key) {
    this.#items.delete(key);
  }

  get keys() {
    return [...this.#items.keys()];
  }

  get values() {
    return [...this.#items.values()];
  }
}

/**
 * PBKDF2 con pocas iteraciones. La configuración real usa 210.000, que tarda
 * ~40 ms por derivación; con decenas de casos la suite se iría a varios
 * segundos sin probar nada distinto. Un caso aparte usa la configuración real.
 */
function fastHasher() {
  return new PasswordHasher(globalThis.crypto, {
    PBKDF2_ITERATIONS: 1000,
    SALT_BYTES: GameConfig.users.SALT_BYTES,
    DERIVED_KEY_BYTES: GameConfig.users.DERIVED_KEY_BYTES
  });
}

function build(storage = new MemoryStorage()) {
  const manager = new UserManager(new UserRepository(storage), fastHasher());
  return { manager, storage };
}

// --- Modelo y registro -----------------------------------------------------

test('registra una cuenta con todos los campos del modelo', async () => {
  const { manager } = build();
  const result = await manager.register('Leandro', PASSWORD);

  assert.equal(result.ok, true);
  assert.equal(result.account.username, 'Leandro');
  assert.ok(typeof result.account.id === 'string' && result.account.id.length > 0);
  assert.ok(Number.isFinite(result.account.createdAt));
  assert.ok(Number.isFinite(result.account.updatedAt));
});

test('los identificadores son únicos entre cuentas', async () => {
  const { manager } = build();
  const uno = await manager.register('usuario-uno', PASSWORD);
  const dos = await manager.register('usuario-dos', PASSWORD);
  assert.notEqual(uno.account.id, dos.account.id);
});

test('la vista pública nunca incluye la credencial', async () => {
  const { manager } = build();
  const registrada = await manager.register('Leandro', PASSWORD);
  assert.equal('credential' in registrada.account, false);

  const buscada = await manager.findByUsername('Leandro');
  assert.equal('credential' in buscada.account, false);

  const listadas = await manager.listAccounts();
  assert.equal('credential' in listadas.accounts[0], false);
});

// --- Seguridad -------------------------------------------------------------

test('la contraseña no queda en texto plano en el almacenamiento', async () => {
  const { manager, storage } = build();
  await manager.register('Leandro', PASSWORD);

  const volcado = storage.values.join('\n');
  assert.equal(volcado.includes(PASSWORD), false, 'la contraseña aparece en el almacenamiento');
});

test('dos cuentas con la misma contraseña tienen hashes distintos', async () => {
  const { manager, storage } = build();
  await manager.register('usuario-uno', PASSWORD);
  await manager.register('usuario-dos', PASSWORD);

  const hashes = storage.values
    .map((raw) => JSON.parse(raw).payload?.credential?.hash)
    .filter(Boolean);
  assert.equal(hashes.length, 2);
  assert.notEqual(hashes[0], hashes[1], 'la sal no está cumpliendo su función');
});

test('no distingue usuario inexistente de contraseña incorrecta', async () => {
  const { manager } = build();
  await manager.register('Leandro', PASSWORD);

  const claveMala = await manager.verifyCredentials('Leandro', 'otra-clave-1');
  const usuarioInexistente = await manager.verifyCredentials('nadie', PASSWORD);

  assert.equal(claveMala.reason, Reasons.INVALID_CREDENTIALS);
  assert.equal(usuarioInexistente.reason, Reasons.INVALID_CREDENTIALS);
  assert.equal(claveMala.message, usuarioInexistente.message);
});

test('una credencial manipulada no deja entrar', async () => {
  const { manager, storage } = build();
  const registrada = await manager.register('Leandro', PASSWORD);

  const key = `${UserRepository.USER_PREFIX}${registrada.account.id}`;
  const envelope = JSON.parse(storage.getItem(key));
  envelope.payload.credential.hash = 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=';
  storage.setItem(key, JSON.stringify(envelope));

  const result = await manager.verifyCredentials('Leandro', PASSWORD);
  assert.equal(result.ok, false);
  assert.equal(result.reason, Reasons.INVALID_CREDENTIALS);
});

test('el mensaje mostrable no filtra detalles técnicos', () => {
  const fallo = UserResult.fail(Reasons.WRITE_FAILED, 'Error: QuotaExceededError en la clave interna');
  assert.equal(fallo.message.includes('QuotaExceededError'), false);
  assert.equal(fallo.detail.includes('QuotaExceededError'), true);
});

// --- Validación y duplicados ----------------------------------------------

test('rechaza nombres de usuario inválidos', async () => {
  const { manager } = build();
  for (const nombre of ['ab', 'x'.repeat(21), 'con espacio', 'acentós', 'sim@bolo', '', null, 42]) {
    const result = await manager.register(nombre, PASSWORD);
    assert.equal(result.ok, false, `aceptó el nombre ${JSON.stringify(nombre)}`);
    assert.equal(result.reason, Reasons.INVALID_USERNAME);
  }
});

test('rechaza contraseñas inválidas', async () => {
  const { manager } = build();
  for (const clave of ['corta', '', 'x'.repeat(129), null, 42]) {
    const result = await manager.register('usuario-valido', clave);
    assert.equal(result.ok, false, `aceptó la contraseña ${JSON.stringify(clave)}`);
    assert.equal(result.reason, Reasons.INVALID_PASSWORD);
  }
});

test('el nombre de usuario es único sin importar mayúsculas', async () => {
  const { manager } = build();
  assert.equal((await manager.register('Leandro', PASSWORD)).ok, true);

  for (const repetido of ['Leandro', 'leandro', 'LEANDRO', '  leandro  ']) {
    const result = await manager.register(repetido, PASSWORD);
    assert.equal(result.reason, Reasons.USERNAME_TAKEN, `dejó repetir ${JSON.stringify(repetido)}`);
  }
});

test('acepta el nombre con la capitalización que eligió el usuario', async () => {
  const { manager } = build();
  await manager.register('LeAnDrO', PASSWORD);
  const found = await manager.findByUsername('leandro');
  assert.equal(found.account.username, 'LeAnDrO');
});

test('UserValidator se puede usar por separado', () => {
  const validator = new UserValidator();
  assert.equal(validator.checkUsername('valido-1'), null);
  assert.equal(validator.checkUsername('no valido'), 'invalid-username');
  assert.equal(validator.checkPassword(PASSWORD), null);
  assert.equal(validator.checkPassword('corta'), 'invalid-password');
});

// --- Consulta y actualización ---------------------------------------------

test('consulta por nombre y por id', async () => {
  const { manager } = build();
  const registrada = await manager.register('Leandro', PASSWORD);

  const porNombre = await manager.findByUsername('Leandro');
  assert.equal(porNombre.account.id, registrada.account.id);

  const porId = await manager.findById(registrada.account.id);
  assert.equal(porId.account.username, 'Leandro');

  assert.equal((await manager.exists('Leandro')), true);
  assert.equal((await manager.exists('nadie')), false);
  assert.equal((await manager.findById('no-existe')).reason, Reasons.NOT_FOUND);
});

test('renombrar mantiene el id y libera el nombre anterior', async () => {
  const { manager } = build();
  const registrada = await manager.register('nombre-viejo', PASSWORD);

  const renombrada = await manager.renameAccount(registrada.account.id, 'nombre-nuevo');
  assert.equal(renombrada.ok, true);
  assert.equal(renombrada.account.id, registrada.account.id);

  assert.equal((await manager.exists('nombre-nuevo')), true);
  assert.equal((await manager.exists('nombre-viejo')), false);
  // El nombre liberado se puede volver a usar.
  assert.equal((await manager.register('nombre-viejo', PASSWORD)).ok, true);
});

test('renombrar no permite pisar un nombre tomado', async () => {
  const { manager } = build();
  const primera = await manager.register('usuario-uno', PASSWORD);
  await manager.register('usuario-dos', PASSWORD);

  const result = await manager.renameAccount(primera.account.id, 'usuario-dos');
  assert.equal(result.reason, Reasons.USERNAME_TAKEN);
  // La cuenta queda como estaba.
  assert.equal((await manager.findById(primera.account.id)).account.username, 'usuario-uno');
});

test('cambiar la contraseña exige la actual', async () => {
  const { manager } = build();
  const registrada = await manager.register('Leandro', PASSWORD);
  const id = registrada.account.id;

  const conClaveMala = await manager.changePassword(id, 'no-es-la-actual', 'nueva-clave-1');
  assert.equal(conClaveMala.reason, Reasons.INVALID_CREDENTIALS);
  assert.equal((await manager.verifyCredentials('Leandro', PASSWORD)).ok, true);

  const cambiada = await manager.changePassword(id, PASSWORD, 'nueva-clave-1');
  assert.equal(cambiada.ok, true);
  assert.equal((await manager.verifyCredentials('Leandro', 'nueva-clave-1')).ok, true);
  assert.equal((await manager.verifyCredentials('Leandro', PASSWORD)).ok, false);
});

test('cambiar la contraseña valida la nueva', async () => {
  const { manager } = build();
  const registrada = await manager.register('Leandro', PASSWORD);
  const result = await manager.changePassword(registrada.account.id, PASSWORD, 'corta');
  assert.equal(result.reason, Reasons.INVALID_PASSWORD);
});

test('actualizar cambia updatedAt y conserva createdAt', async () => {
  let ahora = 1000;
  const manager = new UserManager(
    new UserRepository(new MemoryStorage()),
    fastHasher(),
    new UserValidator(),
    () => ahora
  );
  const registrada = await manager.register('Leandro', PASSWORD);
  assert.equal(registrada.account.createdAt, 1000);

  ahora = 5000;
  const renombrada = await manager.renameAccount(registrada.account.id, 'otro-nombre');
  assert.equal(renombrada.account.createdAt, 1000);
  assert.equal(renombrada.account.updatedAt, 5000);
});

test('borrar exige la contraseña y saca la cuenta del índice', async () => {
  const { manager } = build();
  const registrada = await manager.register('Leandro', PASSWORD);
  const id = registrada.account.id;

  assert.equal((await manager.deleteAccount(id, 'clave-equivocada')).reason, Reasons.INVALID_CREDENTIALS);
  assert.equal((await manager.exists('Leandro')), true);

  assert.equal((await manager.deleteAccount(id, PASSWORD)).ok, true);
  assert.equal((await manager.exists('Leandro')), false);
  assert.equal((await manager.findById(id)).reason, Reasons.NOT_FOUND);
  // El nombre queda libre.
  assert.equal((await manager.register('Leandro', PASSWORD)).ok, true);
});

// --- Errores de almacenamiento --------------------------------------------

test('informa cuando no hay almacenamiento', async () => {
  const manager = new UserManager(new UserRepository(null), fastHasher());
  assert.equal(manager.isAvailable, false);
  assert.equal((await manager.register('Leandro', PASSWORD)).reason, Reasons.STORAGE_UNAVAILABLE);
});

test('informa cuando no hay Web Crypto', async () => {
  const manager = new UserManager(new UserRepository(new MemoryStorage()), new PasswordHasher(null));
  assert.equal(manager.isAvailable, false);
  assert.equal((await manager.register('Leandro', PASSWORD)).reason, Reasons.CRYPTO_UNAVAILABLE);
  assert.equal((await manager.verifyCredentials('Leandro', PASSWORD)).reason, Reasons.CRYPTO_UNAVAILABLE);
});

test('informa cuota llena', async () => {
  const storage = new MemoryStorage();
  storage.setItem = () => {
    throw Object.assign(new Error('full'), { name: 'QuotaExceededError', code: 22 });
  };
  const manager = new UserManager(new UserRepository(storage), fastHasher());
  assert.equal((await manager.register('Leandro', PASSWORD)).reason, Reasons.QUOTA_EXCEEDED);
});

test('informa datos dañados sin lanzar', async () => {
  const { manager, storage } = build();
  const registrada = await manager.register('Leandro', PASSWORD);
  const key = `${UserRepository.USER_PREFIX}${registrada.account.id}`;

  storage.setItem(key, '{"format": "nexo-world-us');
  assert.equal((await manager.findById(registrada.account.id)).reason, Reasons.CORRUPT_DATA);

  storage.setItem(key, JSON.stringify({ format: 'otra-cosa', dataVersion: 1, payload: {} }));
  assert.equal((await manager.findById(registrada.account.id)).reason, Reasons.CORRUPT_DATA);
});

test('informa versión incompatible', async () => {
  const { manager, storage } = build();
  const registrada = await manager.register('Leandro', PASSWORD);
  const key = `${UserRepository.USER_PREFIX}${registrada.account.id}`;

  const envelope = JSON.parse(storage.getItem(key));
  envelope.dataVersion = 99;
  storage.setItem(key, JSON.stringify(envelope));

  assert.equal((await manager.findById(registrada.account.id)).reason, Reasons.INCOMPATIBLE_VERSION);
});

test('un índice dañado no se lleva puesto el almacenamiento', async () => {
  const { manager, storage } = build();
  await manager.register('Leandro', PASSWORD);
  storage.setItem(UserRepository.INDEX_KEY, '[1,2,3]');

  const result = await manager.findByUsername('Leandro');
  assert.equal(result.ok, false);
  assert.equal(result.reason, Reasons.CORRUPT_DATA);
});

// Si falla la escritura del índice, la cuenta recién creada no debe quedar
// huérfana: sería invisible para cualquier búsqueda por nombre.
test('deshace la cuenta si no se puede escribir el índice', async () => {
  const storage = new MemoryStorage();
  const original = storage.setItem.bind(storage);
  storage.setItem = (key, value) => {
    if (key === UserRepository.INDEX_KEY) {
      throw Object.assign(new Error('full'), { name: 'QuotaExceededError', code: 22 });
    }
    original(key, value);
  };

  const manager = new UserManager(new UserRepository(storage), fastHasher());
  const result = await manager.register('Leandro', PASSWORD);
  assert.equal(result.reason, Reasons.QUOTA_EXCEEDED);

  const huerfanas = storage.keys.filter((key) => key.startsWith(UserRepository.USER_PREFIX));
  assert.deepEqual(huerfanas, [], 'quedó una cuenta sin entrada en el índice');
});

// --- Compatibilidad con los guardados del juego ---------------------------

test('no toca las partidas guardadas', async () => {
  const storage = new MemoryStorage();
  const claveDePartida = `${SaveManager.STORAGE_PREFIX}mundo-1`;
  storage.setItem(claveDePartida, 'contenido-de-la-partida');

  const manager = new UserManager(new UserRepository(storage), fastHasher());
  const registrada = await manager.register('Leandro', PASSWORD);
  await manager.renameAccount(registrada.account.id, 'otro-nombre');
  await manager.deleteAccount(registrada.account.id, PASSWORD);

  assert.equal(storage.getItem(claveDePartida), 'contenido-de-la-partida');
});

test('los prefijos de cuentas y de partidas no se cruzan', () => {
  assert.equal(UserRepository.USER_PREFIX.startsWith(SaveManager.STORAGE_PREFIX), false);
  assert.equal(SaveManager.STORAGE_PREFIX.startsWith(UserRepository.USER_PREFIX), false);
  assert.equal(UserRepository.INDEX_KEY.startsWith(SaveManager.STORAGE_PREFIX), false);
});

// --- Normalización y configuración real -----------------------------------

test('normalizeUsername tolera cualquier entrada', () => {
  assert.equal(UserAccount.normalizeUsername('  LeAnDrO '), 'leandro');
  assert.equal(UserAccount.normalizeUsername(null), '');
  assert.equal(UserAccount.normalizeUsername(undefined), '');
});

test('funciona con la configuración real de PBKDF2', async () => {
  const manager = new UserManager(new UserRepository(new MemoryStorage()));
  const registrada = await manager.register('Leandro', PASSWORD);
  assert.equal(registrada.ok, true);

  assert.equal((await manager.verifyCredentials('Leandro', PASSWORD)).ok, true);
  assert.equal((await manager.verifyCredentials('Leandro', 'mala-clave-1')).ok, false);
});

test('la credencial guardada declara el algoritmo y las iteraciones usadas', async () => {
  const storage = new MemoryStorage();
  const manager = new UserManager(new UserRepository(storage));
  const registrada = await manager.register('Leandro', PASSWORD);

  const key = `${UserRepository.USER_PREFIX}${registrada.account.id}`;
  const { credential } = JSON.parse(storage.getItem(key)).payload;
  assert.equal(credential.algorithm, PasswordHasher.ALGORITHM);
  assert.equal(credential.iterations, GameConfig.users.PBKDF2_ITERATIONS);
  assert.ok(credential.salt.length > 0);
  assert.ok(credential.hash.length > 0);
});

// Si mañana se sube el costo, las cuentas viejas tienen que seguir entrando:
// la verificación usa las iteraciones del registro, no las de la configuración.
test('verifica cuentas creadas con otro costo de derivación', async () => {
  const storage = new MemoryStorage();
  const barato = new UserManager(new UserRepository(storage), fastHasher());
  await barato.register('Leandro', PASSWORD);

  const caro = new UserManager(new UserRepository(storage), new PasswordHasher());
  assert.equal((await caro.verifyCredentials('Leandro', PASSWORD)).ok, true);
});
