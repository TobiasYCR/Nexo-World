import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BuildZone } from '../src/world/BuildZone.js';
import { World } from '../src/world/World.js';
import { WorldGenerator } from '../src/world/WorldGenerator.js';
import { SpawnFinder } from '../src/world/SpawnFinder.js';
import { BiomeIds } from '../src/world/BiomeRegistry.js';
import { createDefaultBlockRegistry } from '../src/blocks/BlockRegistry.js';
import { BuildChallenge } from '../src/education/BuildChallenge.js';
import { createDefaultBlueprintRegistry } from '../src/education/BlueprintRegistry.js';
import { Player } from '../src/player/Player.js';
import { FirstPersonCamera } from '../src/camera/FirstPersonCamera.js';
import { BlockIds } from '../src/utils/Constants.js';
import { GameConfig } from '../src/game/GameConfig.js';

const SEEDS = [1, 7, 42, 2024, 20260904];
const ZONE = GameConfig.buildZone;

function generate(seed) {
  const world = new World(createDefaultBlockRegistry(), GameConfig);
  const generator = new WorldGenerator(GameConfig, { seed });
  generator.generate(world);
  return { world, generator };
}

test('BuildZone: llano adentro, transición suave y nada afuera', () => {
  const zone = new BuildZone({ ENABLED: true, RADIUS: 2, BLEND: 4 }, 20, 20, 10);
  assert.equal(zone.weight(10, 10), 1);
  assert.equal(zone.weight(12, 8), 1, 'el borde del cuadrado es llano');
  assert.ok(zone.weight(14, 10) > 0 && zone.weight(14, 10) < 1);
  assert.equal(zone.weight(16, 10), 0);

  const heights = new Int16Array(400).fill(16);
  const biomes = new Uint8Array(400).fill(BiomeIds.MOUNTAINS);
  zone.apply(heights, biomes, 20, 20, BiomeIds.PLAINS);
  assert.equal(heights[10 * 20 + 10], 10);
  assert.equal(biomes[10 * 20 + 10], BiomeIds.PLAINS);
  assert.equal(heights[10 * 20 + 19], 16);
  const row = Array.from(heights.slice(10 * 20 + 12, 10 * 20 + 17));
  assert.deepEqual(row, [...row].sort((a, b) => a - b), 'sube de a poco hacia el terreno natural');

  const off = new BuildZone({ ENABLED: false, RADIUS: 2, BLEND: 4 }, 20, 20, 10);
  assert.equal(off.weight(10, 10), 0);
});

test('el centro del mundo es una llanura totalmente plana, sin árboles ni cuevas', () => {
  for (const seed of SEEDS) {
    const { world, generator } = generate(seed);
    const zone = generator.buildZone;
    const heights = new Set();
    for (let z = zone.centerZ - ZONE.RADIUS; z <= zone.centerZ + ZONE.RADIUS; z += 1) {
      for (let x = zone.centerX - ZONE.RADIUS; x <= zone.centerX + ZONE.RADIUS; x += 1) {
        const surface = world.getSurfaceHeight(x, z);
        heights.add(surface);
        assert.equal(world.getBlockId(x, surface - 1, z), BlockIds.GRASS, `semilla ${seed}: pasto en ${x},${z}`);
        for (let y = 1; y < surface; y += 1) {
          assert.notEqual(world.getBlockId(x, y, z), BlockIds.AIR, `semilla ${seed}: hueco en ${x},${y},${z}`);
        }
      }
    }
    assert.deepEqual([...heights], [zone.level + 1], `semilla ${seed}: el pasto queda en y = nivel`);
    assert.equal(generator.getBiomeAt(zone.centerX, zone.centerZ).id, BiomeIds.PLAINS);
  }
});

test('ningún árbol invade la zona de construcción', () => {
  for (const seed of SEEDS) {
    const { world, generator } = generate(seed);
    const zone = generator.buildZone;
    const reach = ZONE.RADIUS + 1;
    for (let z = zone.centerZ - reach; z <= zone.centerZ + reach; z += 1) {
      for (let x = zone.centerX - reach; x <= zone.centerX + reach; x += 1) {
        for (let y = 0; y < world.height; y += 1) {
          const id = world.getBlockId(x, y, z);
          assert.ok(id !== BlockIds.LOG && id !== BlockIds.LEAVES, `semilla ${seed}: árbol en ${x},${y},${z}`);
        }
      }
    }
  }
});

test('desde la aparición, cualquier plano se arma en llano mirando a cualquier lado', () => {
  for (const seed of SEEDS) {
    const { world } = generate(seed);
    const blockRegistry = world.blockRegistry;
    const size = world.blockSize;
    const spot = new SpawnFinder(2).find(world, Math.floor(world.width / 2), Math.floor(world.depth / 2));
    const player = new Player({ ...GameConfig.player, SPAWN: { x: spot.x * size + size / 2, y: spot.y * size, z: spot.z * size + size / 2 } });
    const camera = new FirstPersonCamera(GameConfig.camera);
    const challenge = new BuildChallenge({
      world,
      player,
      camera,
      blueprintRegistry: createDefaultBlueprintRegistry(blockRegistry, GameConfig.education),
      blockRegistry,
      config: GameConfig.education
    });
    for (const blueprintId of ['wood-house', 'stone-tower', 'river-bridge']) {
      for (let turn = 0; turn < 4; turn += 1) {
        camera.yaw = turn * Math.PI / 2;
        const started = challenge.start(blueprintId);
        assert.equal(started.ok, true, `semilla ${seed}, ${blueprintId}, giro ${turn}: ${started.message}`);
        const { anchor, blocks, wrong } = started.snapshot;
        assert.equal(wrong, 0);
        for (const { x, z } of blocks) assert.equal(world.getSurfaceHeight(x, z), anchor.y, 'apoyado en llano');
      }
    }
  }
});
