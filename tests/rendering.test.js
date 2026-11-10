import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createP5Stub } from './support/domStub.js';
import { TextureManager } from '../src/rendering/TextureManager.js';
import { BlockRenderer } from '../src/rendering/BlockRenderer.js';
import { LightingManager } from '../src/rendering/LightingManager.js';
import { ChunkMeshBuilder } from '../src/rendering/ChunkMeshBuilder.js';
import { World } from '../src/world/World.js';
import { WorldGenerator } from '../src/world/WorldGenerator.js';
import { createDefaultBlockRegistry } from '../src/blocks/BlockRegistry.js';
import { GameConfig } from '../src/game/GameConfig.js';
import { BlockIds } from '../src/utils/Constants.js';

const ASSETS = { TEXTURE_BASE_PATH: '/textures/blocks/', AUDIO_BASE_PATH: '/audio/' };

/** p5 falso con carga asíncrona: `available` decide qué URLs existen. */
function createLoaderStub(available) {
  const requested = [];
  const interpolations = [];
  const p = {
    NEAREST: 'nearest',
    _renderer: {
      getTexture: (image) => ({ setInterpolation: (down, up) => interpolations.push([image.url, down, up]) })
    },
    loadImage(url, onLoad, onError) {
      requested.push(url);
      setTimeout(() => (available.has(url) ? onLoad({ url }) : onError(new Error('404'))), 1);
    }
  };
  return { p, requested, interpolations };
}

function silenceWarnings(t) {
  t.mock.method(console, 'warn', () => {});
}

test('TextureManager resuelve las URLs a través del catálogo, sin prefijo assets/', async () => {
  const { p, requested } = createLoaderStub(new Set(['/textures/blocks/grass.png']));
  const textures = new TextureManager(p, ASSETS);
  await textures.load('grass.png');
  assert.deepEqual(requested, ['/textures/blocks/grass.png']);
});

test('TextureManager carga lo que declara el BlockRegistry', async (t) => {
  silenceWarnings(t);
  const { p, requested } = createLoaderStub(new Set());
  const textures = new TextureManager(p, ASSETS);
  await textures.loadForRegistry(createDefaultBlockRegistry());
  assert.deepEqual(requested.sort(), [
    '/textures/blocks/bedrock.png',
    '/textures/blocks/coal_ore.png',
    '/textures/blocks/cobblestone.png',
    '/textures/blocks/diamond_ore.png',
    '/textures/blocks/dirt.png',
    '/textures/blocks/glass.png',
    '/textures/blocks/gold_ore.png',
    '/textures/blocks/grass_side.png',
    '/textures/blocks/grass_top.png',
    '/textures/blocks/iron_ore.png',
    '/textures/blocks/leaves.png',
    '/textures/blocks/log_side.png',
    '/textures/blocks/log_top.png',
    '/textures/blocks/planks.png',
    '/textures/blocks/sand.png',
    '/textures/blocks/sandstone.png',
    '/textures/blocks/stone.png'
  ]);
});

test('dos pedidos simultáneos de la misma textura disparan una sola carga', async () => {
  const { p, requested } = createLoaderStub(new Set(['/textures/blocks/grass.png']));
  const textures = new TextureManager(p, ASSETS);

  const [first, second] = await Promise.all([textures.load('grass.png'), textures.load('grass.png')]);
  await textures.load('grass.png');

  assert.equal(requested.length, 1);
  assert.equal(first, second);
  assert.equal(textures.get('grass.png'), first);
});

test('una textura faltante resuelve a null, no rechaza y avisa por consola', async (t) => {
  const warn = t.mock.method(console, 'warn', () => {});
  const { p } = createLoaderStub(new Set(['/textures/blocks/grass.png']));
  const textures = new TextureManager(p, ASSETS);

  const result = await textures.loadAll(['grass.png', 'stone.png']);

  assert.deepEqual(result, { loaded: ['grass.png'], missing: ['stone.png'] });
  assert.equal(textures.get('stone.png'), null);
  assert.equal(textures.isLoaded, true);
  assert.equal(warn.mock.callCount(), 1);
  assert.match(warn.mock.calls[0].arguments[0], /stone\.png/);
});

test('si loadImage lanza de forma síncrona, la promesa igual resuelve a null', async () => {
  const p = { loadImage: () => { throw new Error('boom'); } };
  const textures = new TextureManager(p, ASSETS);
  assert.equal(await textures.load('grass.png'), null);
});

test('las texturas cargadas usan filtro NEAREST en ambos sentidos', async () => {
  const { p, interpolations } = createLoaderStub(new Set(['/textures/blocks/dirt.png']));
  const textures = new TextureManager(p, ASSETS);
  await textures.load('dirt.png');
  assert.deepEqual(interpolations, [['/textures/blocks/dirt.png', 'nearest', 'nearest']]);
});

/** Estas pruebas miran la lógica del renderer: alcanza con un mundo de 2 × 2 chunks. */
// Sin tope de tiempo para armar mallas: las pruebas cuentan chunks por frame.
const SMALL = {
  ...GameConfig,
  world: { ...GameConfig.world, WORLD_WIDTH: 32, WORLD_DEPTH: 32 },
  rendering: { ...GameConfig.rendering, MESH_BUILD_BUDGET_MS: Infinity }
};

function buildTerrain() {
  const world = new World(createDefaultBlockRegistry(), SMALL);
  new WorldGenerator(SMALL).generate(world);
  return world;
}

function worldCenter(world) {
  return { x: (world.width / 2) * world.blockSize, y: 200, z: (world.depth / 2) * world.blockSize };
}

function countingStub() {
  const p = createP5Stub();
  p.calls.texture = 0;
  p.texture = () => { p.calls.texture += 1; };
  return p;
}

/** Bloques con al menos una cara visible, contados sin pasar por el renderer. */
function visibleBlocks(world) {
  let count = 0;
  const types = new Set();
  world.forEachSolidBlock((x, y, z, id) => {
    if (world.isBlockHidden(x, y, z)) return;
    count += 1;
    types.add(id);
  });
  return { count, types };
}

test('BlockRenderer dibuja una malla por chunk y tipo, y cambia de material una vez por tipo', () => {
  const world = buildTerrain();
  const p = countingStub();
  const textures = { get: (name) => (name === 'grass_top.png' ? { name } : null) };
  const renderer = new BlockRenderer(p, world.blockRegistry, textures, SMALL);
  // Radio que cubre todo el mundo: así se dibujan todos los chunks.
  renderer.setRenderDistance(world.width + world.depth);

  renderer.render(world, worldCenter(world));

  const { count, types } = visibleBlocks(world);
  assert.equal(renderer.renderedBlocks, count, 'cuenta los mismos bloques visibles que antes');
  assert.equal(renderer.drawnChunks, world.chunkCount);
  assert.equal(p.calls.box, 0, 'ya no hay un box() por bloque');
  assert.ok(p.calls.model >= types.size && p.calls.model <= types.size * world.chunkCount);
  assert.equal(p.calls.texture + p.calls.material, types.size);
  assert.equal(p.calls.texture, 1, 'solo el cesped tiene textura en este doble');
});

test('las mallas se arman una vez y se rehacen solo en el chunk que cambia', () => {
  const world = buildTerrain();
  const p = countingStub();
  const geometries = [];
  p.model = (geometry) => geometries.push(geometry);
  const renderer = new BlockRenderer(p, world.blockRegistry, { get: () => null }, SMALL);
  renderer.setRenderDistance(64);
  const center = worldCenter(world);

  renderer.render(world, center);
  const first = new Set(geometries);
  geometries.length = 0;
  renderer.render(world, center);
  assert.deepEqual(new Set(geometries), first, 'sin cambios se reutilizan las mismas mallas');
  assert.ok([...world.chunks].every((chunk) => !chunk.isDirty));

  // Un bloque en el medio del chunk (0,0): solo ese chunk se rehace.
  const x = 5;
  const z = 5;
  const y = world.getSurfaceHeight(x, z);
  world.setBlockId(x, y, z, BlockIds.STONE);
  geometries.length = 0;
  renderer.render(world, center);
  const changed = geometries.filter((geometry) => !first.has(geometry));
  assert.ok(changed.length > 0);
  assert.ok(changed.every((geometry) => geometry.gid.startsWith('nexo-chunk-0,0-')));
  assert.ok(p.calls.freeGeometry > 0, 'las mallas viejas se liberan');
});

test('un bloque en el borde rehace también la malla del chunk vecino', () => {
  const world = buildTerrain();
  const p = countingStub();
  const geometries = [];
  p.model = (geometry) => geometries.push(geometry);
  const renderer = new BlockRenderer(p, world.blockRegistry, { get: () => null }, SMALL);
  renderer.setRenderDistance(64);
  renderer.render(world, worldCenter(world));
  const first = new Set(geometries);

  const x = GameConfig.chunk.SIZE_X - 1;
  const y = world.getSurfaceHeight(x, 4) - 1;
  world.setBlockId(x, y, 4, BlockIds.AIR);
  geometries.length = 0;
  renderer.render(world, worldCenter(world));
  const rebuilt = new Set(geometries.filter((geometry) => !first.has(geometry)).map((geometry) => geometry.gid.split('-')[2]));
  assert.deepEqual([...rebuilt].sort(), ['0,0', '1,0']);
});

test('sin textura disponible, el bloque se dibuja con el color del BlockType', () => {
  const world = new World(createDefaultBlockRegistry(), GameConfig);
  world.setBlockId(5, 5, 5, BlockIds.STONE);
  const p = countingStub();
  const colors = [];
  p.ambientMaterial = (...rgb) => colors.push(rgb);
  const renderer = new BlockRenderer(p, world.blockRegistry, { get: () => null }, SMALL);

  renderer.render(world, { x: 100, y: 100, z: 100 });

  assert.deepEqual(colors, [[...world.blockRegistry.get(BlockIds.STONE).color]]);
  assert.equal(renderer.renderedBlocks, 1);
});

test('la distancia de render se ajusta en caliente y descarta chunks lejanos', () => {
  const world = buildTerrain();
  const renderer = new BlockRenderer(countingStub(), world.blockRegistry, { get: () => null }, SMALL);
  renderer.setRenderDistance(64);
  const corner = { x: 2 * world.blockSize, y: 200, z: 2 * world.blockSize };

  renderer.render(world, corner);
  const wide = renderer.renderedBlocks;
  assert.equal(renderer.drawnChunks, world.chunkCount);

  assert.equal(renderer.setRenderDistance(4), 4);
  renderer.render(world, corner);
  assert.equal(renderer.drawnChunks, 1, 'desde una esquina solo queda su chunk');
  assert.ok(renderer.renderedBlocks < wide);
});

test('setRenderDistance acota a >= 1 e ignora valores no numéricos', () => {
  const renderer = new BlockRenderer(countingStub(), createDefaultBlockRegistry(), { get: () => null }, SMALL);
  assert.equal(renderer.setRenderDistance(0), 1);
  assert.equal(renderer.setRenderDistance(7.6), 8);
  assert.equal(renderer.setRenderDistance(Number.NaN), 8);
  assert.equal(renderer.renderDistance, 8);
});

test('al cargar otra partida se liberan las mallas de los chunks que ya no existen', () => {
  const world = buildTerrain();
  const p = countingStub();
  const renderer = new BlockRenderer(p, world.blockRegistry, { get: () => null }, SMALL);
  renderer.render(world, worldCenter(world));
  assert.equal(renderer.meshedChunks, world.chunkCount);

  world.clear();
  world.setBlockId(1, 1, 1, BlockIds.STONE);
  renderer.render(world, worldCenter(world));
  assert.equal(renderer.meshedChunks, 1);
  assert.ok(p.calls.freeGeometry > 0);
});

test('el renderer no modifica los bloques del mundo', () => {
  const world = buildTerrain();
  const before = [...world.chunks].map((chunk) => Array.from(chunk.blocks).join());
  new BlockRenderer(countingStub(), world.blockRegistry, { get: () => null }, SMALL).render(world, worldCenter(world));
  assert.deepEqual([...world.chunks].map((chunk) => Array.from(chunk.blocks).join()), before);
});

test('ChunkMeshBuilder genera solo las caras que dan a un bloque no opaco', () => {
  const world = new World(createDefaultBlockRegistry(), GameConfig);
  const builder = new ChunkMeshBuilder(world.blockRegistry, 10);
  world.setBlockId(3, 3, 3, BlockIds.STONE);
  const [chunk] = world.chunks;

  let mesh = builder.build(world, chunk);
  assert.equal(mesh.faceCount, 6, 'un bloque suelto muestra sus seis caras');
  const stone = mesh.groups.get(BlockIds.STONE);
  assert.equal(stone.positions.length, 6 * 4 * 3);
  assert.equal(stone.indices.length, 6 * 6);
  assert.equal(stone.uvs.length, 6 * 4 * 2);
  const xs = stone.positions.filter((_, index) => index % 3 === 0);
  assert.deepEqual([Math.min(...xs), Math.max(...xs)], [30, 40], 'ocupa de x*tamaño a (x+1)*tamaño');

  // Dos bloques pegados: la cara compartida desaparece de los dos lados.
  world.setBlockId(4, 3, 3, BlockIds.STONE);
  mesh = builder.build(world, chunk);
  assert.equal(mesh.faceCount, 10);
  assert.equal(mesh.visibleBlocks, 2);

  // El vidrio no tapa: el bloque de al lado conserva su cara.
  world.setBlockId(4, 3, 3, BlockIds.GLASS);
  mesh = builder.build(world, chunk);
  assert.equal(mesh.groups.get(BlockIds.STONE).faceCount, 6);

  // Las normales apuntan hacia afuera de cada cara.
  const normals = mesh.groups.get(BlockIds.STONE).normals;
  const directions = new Set();
  for (let index = 0; index < normals.length; index += 3) directions.add(normals.slice(index, index + 3).join());
  assert.equal(directions.size, 6);
});

test('ChunkMeshBuilder mira el chunk vecino en los bordes', () => {
  const world = new World(createDefaultBlockRegistry(), GameConfig);
  const builder = new ChunkMeshBuilder(world.blockRegistry, 10);
  const edge = GameConfig.chunk.SIZE_X - 1;
  world.setBlockId(edge, 3, 3, BlockIds.STONE);
  world.setBlockId(edge + 1, 3, 3, BlockIds.STONE);
  const chunk = [...world.chunks].find((candidate) => candidate.chunkX === 0);
  assert.equal(builder.build(world, chunk).faceCount, 5, 'la cara contra el vecino no se genera');
});

test('LightingManager normaliza la dirección una sola vez y la invierte para p5', () => {
  const directional = [];
  const p = { ambientLight: () => {}, directionalLight: (...args) => directional.push(args) };
  const lighting = new LightingManager(p, {
    AMBIENT_LIGHT: [10, 10, 10],
    DIRECTIONAL_LIGHT: [200, 200, 200],
    LIGHT_DIRECTION: { x: 0, y: 3, z: 4 }
  });

  const { x, y, z } = lighting.direction;
  assert.ok(Math.abs(Math.hypot(x, y, z) - 1) < 1e-9);
  assert.ok(Math.abs(y - 0.6) < 1e-9 && Math.abs(z - 0.8) < 1e-9);

  lighting.apply();
  lighting.apply();
  assert.deepEqual(directional[0], [200, 200, 200, -x, -y, -z]);
  assert.deepEqual(directional[1], directional[0]);
});

test('LightingManager tolera un vector de dirección nulo', () => {
  const lighting = new LightingManager({}, {
    AMBIENT_LIGHT: [0, 0, 0],
    DIRECTIONAL_LIGHT: [0, 0, 0],
    LIGHT_DIRECTION: { x: 0, y: 0, z: 0 }
  });
  assert.deepEqual(lighting.direction, { x: 0, y: 1, z: 0 });
});

test('BlockRenderer dibuja el tronco con log_top en las caras horizontales y log_side en las laterales', () => {
  const world = new World(createDefaultBlockRegistry(), GameConfig);
  world.setBlockId(4, 4, 4, BlockIds.LOG);
  const texturesApplied = [];
  const p = createP5Stub();
  p.texture = (tex) => { texturesApplied.push(tex.name); };
  const textures = {
    get: (name) => ({ name })
  };
  const renderer = new BlockRenderer(p, world.blockRegistry, textures, GameConfig);
  renderer.render(world, { x: 4 * world.blockSize, y: 4 * world.blockSize, z: 4 * world.blockSize });
  assert.ok(texturesApplied.includes('log_top.png'), 'aplica log_top a la cara superior/inferior');
  assert.ok(texturesApplied.includes('log_side.png'), 'aplica log_side a las caras laterales');
});
