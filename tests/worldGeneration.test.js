import { test } from 'node:test';
import assert from 'node:assert/strict';
import { WorldGenerator } from '../src/world/WorldGenerator.js';
import { GameConfig } from '../src/game/GameConfig.js';
import { BlockIds } from '../src/utils/Constants.js';
import { configWith, generateWorld, snapshot, targetWorld, TARGET_SIZE } from './support/generation.js';

test('misma semilla, configuración y versión producen exactamente el mismo mundo de 128x128x48', () => {
  const { world: first, generator } = targetWorld();
  const { world: second } = generateWorld(configWith(), { seed: GameConfig.world.SEED });
  assert.deepEqual(snapshot(first), snapshot(second));
  assert.deepEqual(generator.signature, { seed: GameConfig.world.SEED, version: WorldGenerator.VERSION });
});

test('una semilla distinta produce un mundo significativamente distinto', () => {
  const first = snapshot(targetWorld().world);
  const second = snapshot(generateWorld(configWith(), { seed: 424242 }).world);
  let different = 0;
  for (let index = 0; index < first.length; index += 1) if (first[index] !== second[index]) different += 1;
  assert.ok(different > first.length * 0.1, `solo ${different} de ${first.length} bloques cambiaron`);
});

test('la generación no usa Math.random', () => {
  const original = Math.random;
  Math.random = () => { throw new Error('Math.random no es determinista'); };
  try {
    generateWorld(configWith({ width: 48, height: 48, depth: 48 }), { seed: 3 });
  } finally {
    Math.random = original;
  }
});

test('el mundo de 128x128x48 respeta los límites y deja cielo sobre el terreno', () => {
  const { world, generator } = targetWorld();
  assert.deepEqual({ width: world.width, height: world.height, depth: world.depth }, TARGET_SIZE);
  assert.equal(world.chunkCount, (128 / 16) * (128 / 16));
  for (let x = 0; x < world.width; x += 1) {
    for (let z = 0; z < world.depth; z += 1) {
      assert.equal(world.getBlockId(x, world.height - 1, z), BlockIds.AIR, `${x},${z}`);
    }
  }
  assert.ok(generator.stats.trees > 0, 'debería haber árboles');
});

test('el generador registra el tiempo total y por fase', () => {
  const { generator } = targetWorld();
  const { stats } = generator;
  assert.ok(stats.totalMs > 0);
  assert.deepEqual(Object.keys(stats.phases), ['biomes', 'orePlanning', 'terrain', 'vegetation']);
  assert.ok(stats.blocksWritten > 0);
});

test('Game usa la semilla recibida por opciones', async () => {
  const { installDomStub, uninstallDomStub, createP5Stub } = await import('./support/domStub.js');
  const dom = installDomStub();
  try {
    const { Game } = await import('../src/game/Game.js');
    const game = new Game(createP5Stub(), GameConfig, { seed: 777 });
    await game.start(dom.canvas);
    assert.equal(game.worldGenerator.seed, 777);
    assert.equal(game.worldGenerator.stats.seed, 777);
  } finally {
    uninstallDomStub();
  }
});
