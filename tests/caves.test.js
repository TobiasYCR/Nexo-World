import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CaveGenerator } from '../src/world/CaveGenerator.js';
import { World } from '../src/world/World.js';
import { WorldGenerator } from '../src/world/WorldGenerator.js';
import { createDefaultBlockRegistry } from '../src/blocks/BlockRegistry.js';
import { GameConfig } from '../src/game/GameConfig.js';
import { BlockIds } from '../src/utils/Constants.js';
import { configWith, generateWorld, snapshot, targetWorld } from './support/generation.js';

const CARVABLE = createDefaultBlockRegistry().propertyTable('carvable');

/** Alturas de superficie del terreno base (antes de cuevas) del mundo objetivo. */
function surfaceHeights(world, generator) {
  return generator.planSurface(world).heights;
}

/** Tamaños de las cavidades subterráneas (componentes conexas de aire bajo la superficie). */
function cavitySizes(world, heights) {
  const { width, height, depth } = world;
  const blocks = snapshot(world);
  const seen = new Uint8Array(blocks.length);
  const isUnderground = (x, y, z) => y >= 1 && y < heights[z * width + x];
  const sizes = [];
  const stack = [];

  for (let start = 0; start < blocks.length; start += 1) {
    if (seen[start] || blocks[start] !== BlockIds.AIR) continue;
    const sx = start % width;
    const sz = Math.floor(start / width) % depth;
    const sy = Math.floor(start / (width * depth));
    if (!isUnderground(sx, sy, sz)) continue;

    let size = 0;
    seen[start] = 1;
    stack.push(start);
    while (stack.length) {
      const index = stack.pop();
      size += 1;
      const x = index % width;
      const z = Math.floor(index / width) % depth;
      const y = Math.floor(index / (width * depth));
      for (const [dx, dy, dz] of [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]]) {
        const nx = x + dx;
        const ny = y + dy;
        const nz = z + dz;
        if (nx < 0 || nz < 0 || ny < 0 || nx >= width || nz >= depth || ny >= height || !isUnderground(nx, ny, nz)) continue;
        const next = (ny * depth + nz) * width + nx;
        if (seen[next] || blocks[next] !== BlockIds.AIR) continue;
        seen[next] = 1;
        stack.push(next);
      }
    }
    sizes.push(size);
  }
  return sizes.sort((a, b) => b - a);
}

test('las cuevas son deterministas para la misma semilla y cambian con otra', () => {
  const first = new CaveGenerator(GameConfig.caves, 77, 1);
  const second = new CaveGenerator(GameConfig.caves, 77, 1);
  const other = new CaveGenerator(GameConfig.caves, 78, 1);
  let caves = 0;
  let differences = 0;
  for (let x = 0; x < 64; x += 1) {
    for (let z = 0; z < 64; z += 1) {
      for (let y = 4; y < 30; y += 3) {
        const value = first.isCave(x, y, z);
        assert.equal(value, second.isCave(x, y, z));
        if (value) caves += 1;
        if (value !== other.isCave(x, y, z)) differences += 1;
      }
    }
  }
  assert.ok(caves > 0, 'debería haber celdas de cueva');
  assert.ok(differences > caves * 0.5, 'otra semilla debería producir otras cuevas');
});

test('carveColumn coincide con isCave celda por celda', () => {
  const caves = new CaveGenerator(GameConfig.caves, 5, 1);
  for (let x = 0; x < 40; x += 1) {
    for (let z = 0; z < 40; z += 1) {
      const column = new Uint8Array(48).fill(BlockIds.STONE);
      caves.carveColumn(column, x, z, 40, CARVABLE);
      const top = caves.ceilingFor(x, z, 40);
      for (let y = 0; y < column.length; y += 1) {
        const expected = y >= caves.minY && y <= top && caves.isCave(x, y, z);
        assert.equal(column[y] === BlockIds.AIR, expected, `${x},${y},${z}`);
      }
    }
  }
});

test('las cuevas solo excavan terreno natural, nunca estructuras ni roca madre', () => {
  const caves = new CaveGenerator(GameConfig.caves, 5, 1);
  for (const blockId of [BlockIds.PLANKS, BlockIds.LOG, BlockIds.COBBLESTONE, BlockIds.BEDROCK]) {
    for (let x = 0; x < 30; x += 1) {
      const column = new Uint8Array(48).fill(blockId);
      assert.equal(caves.carveColumn(column, x, 3, 40, CARVABLE), 0);
      assert.ok(column.every((id) => id === blockId));
    }
  }
});

test('el mundo tiene cavidades de distintos tamaños bajo la superficie, algunas conectadas en sistemas grandes', () => {
  const { world, generator } = targetWorld();
  const sizes = cavitySizes(world, surfaceHeights(world, generator));
  const total = sizes.reduce((sum, size) => sum + size, 0);

  assert.ok(generator.stats.cavesCarved > 0);
  assert.ok(sizes.length > 10, `solo ${sizes.length} cavidades`);
  assert.ok(sizes[0] > 1000, `la mayor cavidad tiene ${sizes[0]} bloques: los túneles deberían conectar salas`);
  assert.ok(sizes.some((size) => size >= 20 && size < 500), 'deberían existir cuevas medianas');
  assert.ok(total < world.width * world.depth * world.height * 0.2, 'las cuevas no deberían vaciar el subsuelo');
});

test('las cuevas no perforan en exceso la superficie', () => {
  const { world, generator } = targetWorld();
  const heights = surfaceHeights(world, generator);
  let opened = 0;
  for (let z = 0; z < world.depth; z += 1) {
    for (let x = 0; x < world.width; x += 1) {
      if (world.getBlockId(x, heights[z * world.width + x], z) === BlockIds.AIR) opened += 1;
    }
  }
  assert.ok(opened > 0, 'debería haber alguna entrada');
  assert.ok(opened < world.width * world.depth * 0.05, `${opened} columnas con la superficie perforada`);
});

test('la capa inferior queda protegida: roca madre en y=0 y sin cuevas debajo de MIN_DEPTH', () => {
  const { world } = targetWorld();
  const minY = Math.round(GameConfig.caves.MIN_DEPTH * world.height / GameConfig.worldGeneration.REFERENCE_HEIGHT);
  for (let x = 0; x < world.width; x += 1) {
    for (let z = 0; z < world.depth; z += 1) {
      assert.equal(world.getBlockId(x, 0, z), BlockIds.BEDROCK, `${x},0,${z}`);
      for (let y = 1; y < minY; y += 1) assert.notEqual(world.getBlockId(x, y, z), BlockIds.AIR, `${x},${y},${z}`);
    }
  }
});

test('la generación nunca escribe fuera de los límites del mundo', () => {
  const config = configWith();
  const world = new World(createDefaultBlockRegistry(), config);
  const outside = [];
  const original = world.setBlockId.bind(world);
  world.setBlockId = (x, y, z, blockId) => {
    if (!world.isInsideBounds(x, y, z)) outside.push([x, y, z]);
    return original(x, y, z, blockId);
  };
  new WorldGenerator(config, { seed: 31337 }).generate(world);
  assert.deepEqual(outside, []);
});

test('con las cuevas desactivadas el subsuelo queda macizo', () => {
  const { world, generator } = generateWorld(configWith({ width: 48, height: 48, depth: 48 }, { caves: { ENABLED: false } }));
  const heights = surfaceHeights(world, generator);
  assert.equal(generator.stats.cavesCarved, 0);
  for (let z = 0; z < world.depth; z += 1) {
    for (let x = 0; x < world.width; x += 1) {
      for (let y = 0; y <= heights[z * world.width + x]; y += 1) assert.notEqual(world.getBlockId(x, y, z), BlockIds.AIR);
    }
  }
});
