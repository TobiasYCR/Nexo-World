import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createP5Stub } from './support/domStub.js';
import { TextureManager } from '../src/rendering/TextureManager.js';
import { BlockRenderer } from '../src/rendering/BlockRenderer.js';
import { LightingManager } from '../src/rendering/LightingManager.js';
import { RenderQueue } from '../src/rendering/RenderQueue.js';
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

test('RenderQueue agrupa por tipo y reutiliza la capacidad entre frames', () => {
  const queue = new RenderQueue();
  queue.push(1, 0, 0, 0);
  queue.push(2, 1, 0, 0);
  queue.push(1, 2, 0, 0);
  assert.equal(queue.size, 3);
  assert.equal(queue.groupCount, 2);

  queue.clear();
  assert.equal(queue.size, 0);
  assert.equal(queue.groupCount, 0);
});

function buildTerrain() {
  const world = new World(createDefaultBlockRegistry(), GameConfig);
  new WorldGenerator(GameConfig.world).generate(world);
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

test('BlockRenderer cambia de material una vez por tipo, no por bloque', () => {
  const world = buildTerrain();
  const p = countingStub();
  const textures = { get: (name) => (name === 'grass_top.png' ? { name } : null) };
  const renderer = new BlockRenderer(p, world.blockRegistry, textures, GameConfig);
  // Radio que cubre todo el mundo: así los tipos dibujados son los de los bloques visibles.
  renderer.setRenderDistance(world.width + world.depth);

  renderer.render(world, worldCenter(world));

  const typesDrawn = new Set();
  world.forEachSolidBlock((x, y, z, id) => {
    if (!world.isBlockHidden(x, y, z)) typesDrawn.add(id);
  });
  assert.ok(renderer.renderedBlocks > typesDrawn.size);
  assert.equal(p.calls.box, renderer.renderedBlocks);
  assert.equal(p.calls.texture + p.calls.material, typesDrawn.size);
  assert.equal(p.calls.texture, 1, 'solo el cesped tiene textura en este doble');
});

test('sin textura disponible, el bloque se dibuja con el color del BlockType', () => {
  const world = new World(createDefaultBlockRegistry(), GameConfig);
  world.setBlockId(5, 5, 5, BlockIds.STONE);
  const p = countingStub();
  const colors = [];
  p.ambientMaterial = (...rgb) => colors.push(rgb);
  const renderer = new BlockRenderer(p, world.blockRegistry, { get: () => null }, GameConfig);

  renderer.render(world, { x: 100, y: 100, z: 100 });

  assert.deepEqual(colors, [[...world.blockRegistry.get(BlockIds.STONE).color]]);
});

test('la distancia de render se ajusta en caliente y recorta bloques', () => {
  const world = buildTerrain();
  const renderer = new BlockRenderer(countingStub(), world.blockRegistry, { get: () => null }, GameConfig);
  const center = worldCenter(world);

  renderer.render(world, center);
  const wide = renderer.renderedBlocks;

  assert.equal(renderer.setRenderDistance(4), 4);
  renderer.render(world, center);
  assert.ok(renderer.renderedBlocks < wide);
});

test('setRenderDistance acota a >= 1 e ignora valores no numéricos', () => {
  const renderer = new BlockRenderer(countingStub(), createDefaultBlockRegistry(), { get: () => null }, GameConfig);
  assert.equal(renderer.setRenderDistance(0), 1);
  assert.equal(renderer.setRenderDistance(7.6), 8);
  assert.equal(renderer.setRenderDistance(Number.NaN), 8);
  assert.equal(renderer.renderDistance, 8);
});

test('el conteo varía de forma gradual al caminar', () => {
  const world = buildTerrain();
  const renderer = new BlockRenderer(countingStub(), world.blockRegistry, { get: () => null }, GameConfig);
  renderer.setRenderDistance(8);

  const counts = [];
  for (let step = 0; step <= 40; step += 1) {
    renderer.render(world, { x: 100 + step * 5, y: 200, z: 320 });
    counts.push(renderer.renderedBlocks);
  }
  const maxJump = Math.max(...counts.slice(1).map((count, index) => Math.abs(count - counts[index])));
  assert.ok(maxJump < counts[0] * 0.2, `salto máximo ${maxJump} sobre ${counts[0]} bloques`);
});

test('el renderer no modifica el mundo', () => {
  const world = buildTerrain();
  const before = [...world.chunks].map((chunk) => Array.from(chunk.blocks).join());
  new BlockRenderer(countingStub(), world.blockRegistry, { get: () => null }, GameConfig).render(world, worldCenter(world));
  assert.deepEqual([...world.chunks].map((chunk) => Array.from(chunk.blocks).join()), before);
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
