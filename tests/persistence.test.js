import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SaveManager } from '../src/persistence/SaveManager.js';
import { WorldSerializer } from '../src/persistence/WorldSerializer.js';
import { SaveResult } from '../src/persistence/SaveResult.js';
import { Base64Codec } from '../src/utils/Base64Codec.js';
import { RunLengthCodec } from '../src/utils/RunLengthCodec.js';
import { World } from '../src/world/World.js';
import { WorldGenerator } from '../src/world/WorldGenerator.js';
import { Player } from '../src/player/Player.js';
import { createDefaultBlockRegistry } from '../src/blocks/BlockRegistry.js';
import { GameConfig } from '../src/game/GameConfig.js';
import { BlockIds } from '../src/utils/Constants.js';

const { Reasons } = SaveResult;
const SLOT = 'test';
const KEY = `${SaveManager.STORAGE_PREFIX}${SLOT}`;

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
}

function buildWorld() {
  const world = new World(createDefaultBlockRegistry(), GameConfig);
  new WorldGenerator(GameConfig.world).generate(world);
  return world;
}

function snapshot(world) {
  const blocks = [];
  for (let y = 0; y < world.height; y += 1) {
    for (let z = 0; z < world.depth; z += 1) {
      for (let x = 0; x < world.width; x += 1) blocks.push(world.getBlockId(x, y, z));
    }
  }
  return blocks.join('');
}

function setup() {
  const storage = new MemoryStorage();
  const manager = new SaveManager(storage);
  const world = buildWorld();
  const player = new Player(GameConfig.player);
  return { storage, manager, world, player };
}

/** Guarda, modifica el guardado con `mutate` y lo vuelve a escribir. */
function tamper(storage, mutate) {
  const envelope = JSON.parse(storage.getItem(KEY));
  mutate(envelope);
  storage.setItem(KEY, JSON.stringify(envelope));
}

test('Base64Codec ida y vuelta conserva todos los bytes', () => {
  const bytes = Uint8Array.from({ length: 70000 }, (_, index) => (index * 31) % 256);
  const decoded = Base64Codec.decode(Base64Codec.encode(bytes));
  assert.deepEqual(decoded, bytes);
});

test('Base64Codec rechaza texto que no es base64', () => {
  assert.equal(Base64Codec.decode('no es base64!'), null);
  assert.equal(Base64Codec.decode('abc'), null);
  assert.equal(Base64Codec.decode(42), null);
});

test('guardar y cargar restaura mundo y posición del jugador', () => {
  const { manager, world, player } = setup();
  player.teleportTo(123.5, 160, 87.25);
  const saved = snapshot(world);
  assert.equal(manager.save(SLOT, world, player).ok, true);

  world.setBlockId(3, 2, 3, BlockIds.AIR);
  world.setBlockId(10, 20, 10, BlockIds.STONE);
  player.teleportTo(0, 0, 0);
  player.velocity.set(5, 5, 5);

  const result = manager.load(SLOT, world, player);
  assert.equal(result.ok, true, result.message);
  assert.equal(snapshot(world), saved);
  assert.deepEqual({ ...player.position }, { x: 123.5, y: 160, z: 87.25 });
  assert.deepEqual({ ...player.velocity }, { x: 0, y: 0, z: 0 });
});

test('el guardado es compatible con la firma save(slot, world) sin jugador', () => {
  const { manager, world } = setup();
  assert.equal(manager.save(SLOT, world).ok, true);
  assert.equal(manager.load(SLOT, world).ok, true);
});

test('los chunks en base64 ocupan menos que en JSON numérico', () => {
  const world = buildWorld();
  const encoded = JSON.stringify(new WorldSerializer().serialize(world));
  const numeric = JSON.stringify([...world.chunks].map((chunk) => Array.from(chunk.blocks)));
  // Con ids de un dígito el JSON numérico gasta 2 bytes por bloque y base64 ~1,33.
  assert.ok(encoded.length < numeric.length * 0.75, `${encoded.length} vs ${numeric.length}`);
});

test('cargar una ranura inexistente devuelve not-found', () => {
  const { manager, world } = setup();
  const result = manager.load('nada', world);
  assert.equal(result.ok, false);
  assert.equal(result.reason, Reasons.NOT_FOUND);
  assert.ok(result.message.length > 0);
});

/** Verifica que la carga falle con `reason` y que el mundo y el jugador queden intactos. */
function assertRejectedIntact(reason, mutate) {
  const { storage, manager, world, player } = setup();
  manager.save(SLOT, world, player);
  mutate(storage);

  world.setBlockId(10, 20, 10, BlockIds.STONE);
  player.teleportTo(1, 2, 3);
  const before = snapshot(world);

  const result = manager.load(SLOT, world, player);
  assert.equal(result.ok, false);
  assert.equal(result.reason, reason);
  assert.equal(snapshot(world), before, 'el mundo en memoria no debe tocarse');
  assert.deepEqual({ ...player.position }, { x: 1, y: 2, z: 3 });
}

test('JSON corrupto devuelve corrupt-data sin tocar el mundo', () => {
  assertRejectedIntact(Reasons.CORRUPT_DATA, (storage) => storage.setItem(KEY, '{"format": "nexo-wor'));
});

test('un JSON ajeno al juego devuelve corrupt-data', () => {
  assertRejectedIntact(Reasons.CORRUPT_DATA, (storage) => storage.setItem(KEY, '[1,2,3]'));
});

test('una versión de guardado desconocida devuelve incompatible-version', () => {
  assertRejectedIntact(Reasons.INCOMPATIBLE_VERSION, (storage) => tamper(storage, (save) => { save.saveVersion = 99; }));
});

test('una versión de mundo desconocida devuelve incompatible-version', () => {
  assertRejectedIntact(Reasons.INCOMPATIBLE_VERSION, (storage) => tamper(storage, (save) => { save.world.version = 1; }));
});

test('un mundo de otras dimensiones devuelve world-mismatch', () => {
  assertRejectedIntact(Reasons.WORLD_MISMATCH, (storage) => tamper(storage, (save) => { save.world.dimensions.width = 64; }));
});

test('un chunk corrupto al final no deja el mundo a medio pisar', () => {
  assertRejectedIntact(Reasons.CORRUPT_CHUNK, (storage) => tamper(storage, (save) => {
    save.world.chunks.at(-1).rle = save.world.chunks.at(-1).rle.slice(0, 40);
  }));
});

test('un chunk con base64 inválido devuelve corrupt-chunk', () => {
  assertRejectedIntact(Reasons.CORRUPT_CHUNK, (storage) => tamper(storage, (save) => { save.world.chunks[0].rle = '%%%%'; }));
});

test('un chunk con ids de bloque desconocidos devuelve corrupt-chunk', () => {
  assertRejectedIntact(Reasons.CORRUPT_CHUNK, (storage) => tamper(storage, (save) => {
    const bytes = Base64Codec.decode(save.world.chunks[0].rle);
    bytes[1] = 200; // [largo, id]: el segundo byte es el id del primer tramo
    save.world.chunks[0].rle = Base64Codec.encode(bytes);
  }));
});

test('un chunk fuera del mundo o duplicado devuelve corrupt-chunk', () => {
  assertRejectedIntact(Reasons.CORRUPT_CHUNK, (storage) => tamper(storage, (save) => { save.world.chunks[0].x = 50; }));
  assertRejectedIntact(Reasons.CORRUPT_CHUNK, (storage) => tamper(storage, (save) => {
    save.world.chunks.push({ ...save.world.chunks[0] });
  }));
});

test('una posición de jugador inválida devuelve corrupt-player sin tocar el mundo', () => {
  assertRejectedIntact(Reasons.CORRUPT_PLAYER, (storage) => tamper(storage, (save) => { save.player.position.x = 'x'; }));
});

test('localStorage bloqueado: el acceso lanza y el manager lo reporta', () => {
  const blocked = {
    getItem() { throw Object.assign(new Error('denied'), { name: 'SecurityError' }); },
    setItem() { throw Object.assign(new Error('denied'), { name: 'SecurityError' }); },
    removeItem() { throw Object.assign(new Error('denied'), { name: 'SecurityError' }); }
  };
  const manager = new SaveManager(blocked);
  const world = buildWorld();

  assert.equal(manager.isAvailable, false);
  assert.equal(manager.save(SLOT, world).reason, Reasons.STORAGE_UNAVAILABLE);
  assert.equal(manager.load(SLOT, world).reason, Reasons.STORAGE_UNAVAILABLE);
  assert.equal(manager.delete(SLOT).reason, Reasons.STORAGE_UNAVAILABLE);
  assert.equal(manager.exists(SLOT), false);
});

test('sin storage disponible devuelve storage-unavailable', () => {
  const manager = new SaveManager(null);
  assert.equal(manager.isAvailable, false);
  assert.equal(manager.save(SLOT, buildWorld()).reason, Reasons.STORAGE_UNAVAILABLE);
});

test('si el acceso a globalThis.localStorage lanza, el constructor no falla', () => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    get() { throw new Error('SecurityError'); }
  });
  try {
    const manager = new SaveManager();
    assert.equal(manager.isAvailable, false);
  } finally {
    if (descriptor) Object.defineProperty(globalThis, 'localStorage', descriptor);
    else delete globalThis.localStorage;
  }
});

test('cuota llena devuelve quota-exceeded y conserva el guardado anterior', () => {
  const storage = new MemoryStorage();
  const manager = new SaveManager(storage);
  const world = buildWorld();
  manager.save(SLOT, world);
  const previous = storage.getItem(KEY);

  storage.setItem = () => { throw Object.assign(new Error('full'), { name: 'QuotaExceededError', code: 22 }); };
  const result = manager.save(SLOT, world);

  assert.equal(result.ok, false);
  assert.equal(result.reason, Reasons.QUOTA_EXCEEDED);
  assert.equal(storage.getItem(KEY), previous);
});

test('exists y delete reflejan el estado de la ranura', () => {
  const { manager, world } = setup();
  assert.equal(manager.exists(SLOT), false);
  manager.save(SLOT, world);
  assert.equal(manager.exists(SLOT), true);
  assert.equal(manager.delete(SLOT).ok, true);
  assert.equal(manager.exists(SLOT), false);
});

test('una ranura sin nombre se rechaza', () => {
  const { manager, world } = setup();
  assert.equal(manager.save('', world).reason, Reasons.INVALID_SLOT);
  assert.equal(manager.load(undefined, world).reason, Reasons.INVALID_SLOT);
});

test('RunLengthCodec: ida y vuelta, tramos de más de 255 y datos inválidos', () => {
  const bytes = new Uint8Array(1000);
  bytes.fill(3, 0, 600);
  bytes[700] = 9;
  const encoded = RunLengthCodec.encode(bytes);
  assert.ok(encoded.length < 20, `${encoded.length} bytes`);
  assert.deepEqual(RunLengthCodec.decode(encoded, bytes.length), bytes);
  assert.equal(RunLengthCodec.decode(encoded, bytes.length + 1), null, 'faltan bloques');
  assert.equal(RunLengthCodec.decode(encoded, bytes.length - 1), null, 'sobran bloques');
  assert.equal(RunLengthCodec.decode(Uint8Array.of(0, 1), 0), null, 'tramo de largo 0');
  assert.equal(RunLengthCodec.decode(Uint8Array.of(1), 1), null, 'largo impar');
});

test('el guardado comprimido ocupa mucho menos que el formato v2', () => {
  const world = buildWorld();
  const serializer = new WorldSerializer();
  const compressed = JSON.stringify(serializer.serialize(world)).length;
  const v2 = JSON.stringify([...world.chunks].map((chunk) => Base64Codec.encode(chunk.blocks))).length;
  assert.ok(compressed < v2 / 3, `${compressed} vs ${v2}`);
});

test('los guardados v2 (sin comprimir) se siguen cargando', () => {
  const world = buildWorld();
  const saved = snapshot(world);
  const v2 = {
    version: 2,
    dimensions: { width: world.width, height: world.height, depth: world.depth },
    chunkSize: { x: world.chunkSizeX, z: world.chunkSizeZ },
    chunks: [...world.chunks].map((chunk) => ({ x: chunk.chunkX, z: chunk.chunkZ, data: Base64Codec.encode(chunk.blocks) }))
  };
  world.setBlockId(10, 20, 10, BlockIds.STONE);
  assert.equal(new WorldSerializer().deserialize(world, v2).ok, true);
  assert.equal(snapshot(world), saved);
});

/** MemoryStorage con length/key, como localStorage. */
class ListableStorage extends MemoryStorage {
  #keys = new Set();
  get length() { return this.#keys.size; }
  key(index) { return [...this.#keys][index] ?? null; }
  setItem(key, value) { this.#keys.add(key); super.setItem(key, value); }
  removeItem(key) { this.#keys.delete(key); super.removeItem(key); }
}

test('SaveManager lista los mundos y los encuentra sin importar mayúsculas ni espacios', () => {
  const storage = new ListableStorage();
  storage.setItem('otra-app:clave', 'x');
  const manager = new SaveManager(storage);
  const world = buildWorld();
  manager.save('Nuevo Mundo', world);
  manager.save('default', world);
  assert.deepEqual(manager.listSlots().sort(), ['Nuevo Mundo', 'default']);
  assert.equal(manager.findSlot('  nuevo MUNDO '), 'Nuevo Mundo');
  assert.equal(manager.findSlot('Mundo 2'), null);
  assert.equal(manager.findSlot(''), null);
  assert.deepEqual(new SaveManager(new MemoryStorage()).listSlots(), [], 'sin length/key no lista');
});
