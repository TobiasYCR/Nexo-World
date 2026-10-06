import { test } from 'node:test';
import assert from 'node:assert/strict';
import { World } from '../src/world/World.js';
import { WorldGenerator } from '../src/world/WorldGenerator.js';
import { NoiseGenerator } from '../src/world/NoiseGenerator.js';
import { createDefaultBlockRegistry } from '../src/blocks/BlockRegistry.js';
import { GameConfig } from '../src/game/GameConfig.js';
import { BlockIds } from '../src/utils/Constants.js';

function buildWorld() {
  return new World(createDefaultBlockRegistry(), GameConfig);
}

test('un mundo vacío devuelve aire en todas partes', () => {
  const world = buildWorld();
  assert.equal(world.getBlockId(0, 0, 0), BlockIds.AIR);
});

test('setBlockId y getBlockId son consistentes entre chunks', () => {
  const world = buildWorld();
  world.setBlockId(2, 3, 4, BlockIds.STONE);
  world.setBlockId(20, 3, 25, BlockIds.DIRT);

  assert.equal(world.getBlockId(2, 3, 4), BlockIds.STONE);
  assert.equal(world.getBlockId(20, 3, 25), BlockIds.DIRT);
  assert.equal(world.chunkCount, 2);
});

test('escribir fuera de los límites no altera el mundo', () => {
  const world = buildWorld();
  assert.equal(world.setBlockId(-1, 0, 0, BlockIds.STONE), false);
  assert.equal(world.chunkCount, 0);
});

test('colocar un id no registrado falla', () => {
  const world = buildWorld();
  assert.throws(() => world.setBlockId(0, 0, 0, 200), RangeError);
});

test('la generación llena el terreno y deja aire arriba', () => {
  const world = new WorldGenerator(GameConfig.world).generate(buildWorld());

  assert.equal(world.isSolid(0, 0, 0), true);
  assert.equal(world.getBlockId(0, world.height - 1, 0), BlockIds.AIR);

  const surface = world.getSurfaceHeight(0, 0);
  assert.ok(surface > 0 && surface < world.height);
  assert.notEqual(world.getBlockId(0, surface - 1, 0), BlockIds.AIR);
});

test('la arena aparece en columnas bajo el nivel configurado', () => {
  const world = new WorldGenerator(GameConfig.world).generate(buildWorld());
  let checkedBeach = false;

  for (let x = 0; x < world.width; x += 1) {
    for (let z = 0; z < world.depth; z += 1) {
      const surfaceBlockY = world.getSurfaceHeight(x, z) - 1;
      if (surfaceBlockY < GameConfig.world.SAND_LEVEL) {
        checkedBeach = true;
        assert.equal(world.getBlockId(x, surfaceBlockY, z), BlockIds.SAND);
      }
    }
  }

  assert.equal(checkedBeach, true);
});

test('los arboles son deterministas y no se cortan en el borde del mundo', () => {
  const first = new WorldGenerator(GameConfig.world).generate(buildWorld());
  const second = new WorldGenerator(GameConfig.world).generate(buildWorld());
  let leaves = 0;
  let logs = 0;

  for (let x = 0; x < first.width; x += 1) {
    for (let y = 0; y < first.height; y += 1) {
      for (let z = 0; z < first.depth; z += 1) {
        const blockId = first.getBlockId(x, y, z);
        assert.equal(blockId, second.getBlockId(x, y, z), `${x},${y},${z}`);
        if (blockId === BlockIds.LOG) {
          logs += 1;
          assert.ok(x > 0 && x < first.width - 1 && z > 0 && z < first.depth - 1);
        }
        if (blockId === BlockIds.LEAVES) {
          leaves += 1;
          assert.ok(x > 0 && x < first.width - 1 && z > 0 && z < first.depth - 1);
        }
      }
    }
  }

  assert.ok(logs > 0, 'deberia generar troncos');
  assert.ok(leaves > 0, 'deberia generar hojas');
});

test('un bloque enterrado se considera oculto y uno de superficie no', () => {
  const world = new WorldGenerator(GameConfig.world).generate(buildWorld());
  const surface = world.getSurfaceHeight(5, 5);

  assert.equal(world.isBlockHidden(5, surface - 1, 5), false);
  assert.equal(world.isBlockHidden(5, 1, 5), true);

  // El borde inferior del mundo se trata como aire, así que y=0 nunca está oculto.
  assert.equal(world.isBlockHidden(5, 0, 5), false);
});

test('la conversión mundo <-> bloque es coherente', () => {
  const world = buildWorld();
  const worldPosition = world.blockToWorld(3, 4, 5);
  assert.deepEqual(world.worldToBlock(worldPosition.x, worldPosition.y, worldPosition.z), { x: 3, y: 4, z: 5 });
});

test('noise2D varía con la semilla por defecto (bug del ruido plano)', () => {
  const noise = new NoiseGenerator(GameConfig.world.SEED);
  const values = new Set([
    noise.noise2D(0, 0),
    noise.noise2D(1, 0),
    noise.noise2D(0, 1),
    noise.noise2D(7, 3),
    noise.noise2D(10, 10)
  ]);
  assert.ok(values.size > 1, 'la semilla por defecto no debe producir ruido constante');
});

test('la generación produce relieve, no una plancha plana', () => {
  const world = new WorldGenerator(GameConfig.world).generate(buildWorld());

  const heights = new Set();
  for (let x = 0; x < world.width; x += 1) {
    for (let z = 0; z < world.depth; z += 1) {
      heights.add(world.getSurfaceHeight(x, z));
    }
  }

  assert.ok(heights.size > 1, `debería haber más de una altura de superficie (solo: ${[...heights].join(', ')})`);
  assert.ok(Math.min(...heights) < GameConfig.world.BASE_TERRAIN_HEIGHT, 'la amplitud también debe hundir el terreno');
});
