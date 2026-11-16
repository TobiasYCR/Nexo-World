import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ViewFrustum } from '../src/rendering/ViewFrustum.js';
import { ChunkMeshBuilder } from '../src/rendering/ChunkMeshBuilder.js';
import { BlockRenderer } from '../src/rendering/BlockRenderer.js';
import { FirstPersonCamera } from '../src/camera/FirstPersonCamera.js';
import { World } from '../src/world/World.js';
import { WorldGenerator } from '../src/world/WorldGenerator.js';
import { createDefaultBlockRegistry } from '../src/blocks/BlockRegistry.js';
import { BlockIds } from '../src/utils/Constants.js';
import { GameConfig } from '../src/game/GameConfig.js';
import { createP5Stub } from './support/domStub.js';

const SIZE = GameConfig.world.BLOCK_SIZE;

function generatedWorld(config = GameConfig, seed = 20260904) {
  const world = new World(createDefaultBlockRegistry(), config);
  new WorldGenerator(config, { seed }).generate(world);
  return world;
}

/** Superficie cubierta por cada tipo y dirección: suma de ancho × alto de los rectángulos. */
function coverage(mesh) {
  const totals = new Map();
  for (const [blockId, group] of mesh.groups) {
    for (let quad = 0; quad < group.faceCount; quad += 1) {
      const normal = group.normals.slice(quad * 12, quad * 12 + 3).join();
      const uvs = group.uvs.slice(quad * 8, quad * 8 + 8);
      const width = Math.max(uvs[0], uvs[2], uvs[4], uvs[6]);
      const height = Math.max(uvs[1], uvs[3], uvs[5], uvs[7]);
      const key = `${blockId}|${normal}`;
      totals.set(key, (totals.get(key) ?? 0) + width * height);
    }
  }
  return totals;
}

test('ViewFrustum: lo de adelante entra, lo de atrás y los costados no', () => {
  const camera = new FirstPersonCamera(GameConfig.camera);
  camera.setPosition(0, 0, 0); // yaw 0 mira hacia -Z
  const frustum = new ViewFrustum().update(camera.position, camera.lookDirection, camera.right, 70, 16 / 9, 1, 4000);
  const box = (x, z) => frustum.intersectsBox(x - 10, -10, z - 10, x + 10, 10, z + 10);
  assert.equal(box(0, -200), true, 'adelante');
  assert.equal(box(0, 200), false, 'atrás');
  assert.equal(box(800, -100), false, 'muy a la derecha');
  assert.equal(box(0, -5000), false, 'más lejos que el plano lejano');
  assert.equal(frustum.intersectsBox(-10, -10, 5, 10, 10, 25, 30), true, 'la holgura evita cortar lo que está justo al borde');
});

test('greedy meshing cubre exactamente las mismas caras con muchos menos rectángulos', () => {
  const world = generatedWorld();
  const builder = new ChunkMeshBuilder(world.blockRegistry, SIZE);
  for (const chunk of world.chunks) {
    const simple = builder.build(world, chunk);
    const greedy = builder.build(world, chunk, { greedy: true });
    assert.deepEqual(coverage(greedy), coverage(simple), `chunk ${chunk.key}`);
    assert.equal(greedy.visibleBlocks, simple.visibleBlocks);
    assert.ok(greedy.faceCount < simple.faceCount / 2, `${greedy.faceCount} vs ${simple.faceCount}`);
  }
});

test('greedy meshing: un piso de 3×3 es un solo rectángulo arriba, con la textura repetida', () => {
  const world = new World(createDefaultBlockRegistry(), GameConfig);
  for (let x = 2; x < 5; x += 1) for (let z = 2; z < 5; z += 1) world.setBlockId(x, 1, z, BlockIds.PLANKS);
  const [chunk] = world.chunks;
  const mesh = new ChunkMeshBuilder(world.blockRegistry, SIZE).build(world, chunk, { greedy: true });
  const planks = mesh.groups.get(BlockIds.PLANKS);
  assert.equal(mesh.faceCount, 6, 'una cara por lado');
  assert.equal(mesh.visibleBlocks, 9);
  const top = [...Array(planks.faceCount).keys()].find((quad) => planks.normals[quad * 12 + 1] === 1);
  assert.deepEqual(planks.uvs.slice(top * 8, top * 8 + 8), [0, 0, 0, 3, 3, 0, 3, 3]);
  const ys = planks.positions.slice(top * 12, top * 12 + 12).filter((_, index) => index % 3 === 1);
  assert.deepEqual(new Set(ys), new Set([2 * SIZE]));
});

test('el frustum culling descarta los chunks que quedan detrás de la cámara', () => {
  const world = generatedWorld();
  const p = createP5Stub();
  const config = { ...GameConfig, rendering: { ...GameConfig.rendering, MESH_BUILD_BUDGET_MS: Infinity } };
  const renderer = new BlockRenderer(p, world.blockRegistry, { get: () => null }, config);
  renderer.setRenderDistance((world.width + world.depth) * SIZE);
  const camera = new FirstPersonCamera(GameConfig.camera);
  // En el borde +Z del mundo, mirando hacia afuera (+Z): todo el mundo queda atrás.
  camera.yaw = Math.PI;
  camera.rotate(0, 0);
  camera.setPosition((world.width / 2) * SIZE, 15 * SIZE, (world.depth + 2) * SIZE);

  renderer.render(world, camera.position, camera);
  assert.equal(renderer.drawnChunks, 0);
  assert.equal(renderer.culledChunks, world.chunkCount);

  renderer.setFrustumCulling(false);
  // Las mallas se arman de a MESH_BUILDS_PER_FRAME por frame.
  for (let frame = 0; frame * GameConfig.rendering.MESH_BUILDS_PER_FRAME <= world.chunkCount; frame += 1) {
    renderer.render(world, camera.position, camera);
  }
  assert.equal(renderer.drawnChunks, world.chunkCount);
});

test('las mallas se arman de a pocas, las cercanas primero, y se liberan al alejarse', () => {
  const config = {
    ...GameConfig,
    world: { ...GameConfig.world, WORLD_WIDTH: 96, WORLD_DEPTH: 96 },
    rendering: { ...GameConfig.rendering, MESH_BUILDS_PER_FRAME: 2, MESH_BUILD_BUDGET_MS: Infinity, MESH_RELEASE_MARGIN: 0 }
  };
  const world = generatedWorld(config);
  const p = createP5Stub();
  const renderer = new BlockRenderer(p, world.blockRegistry, { get: () => null }, config);
  renderer.setRenderDistance(20);
  const corner = { x: 4 * SIZE, y: 200, z: 4 * SIZE };

  renderer.render(world, corner);
  assert.equal(renderer.meshedChunks, 2, 'como mucho dos por frame');
  for (let frame = 0; frame < 10; frame += 1) renderer.render(world, corner);
  const nearCount = renderer.meshedChunks;
  assert.ok(nearCount < world.chunkCount, 'solo los chunks dentro de la distancia');

  const farCorner = { x: (world.width - 4) * SIZE, y: 200, z: (world.depth - 4) * SIZE };
  for (let frame = 0; frame < 10; frame += 1) renderer.render(world, farCorner);
  assert.ok(p.calls.freeGeometry > 0, 'las mallas de la esquina vieja se liberaron');
  assert.equal(renderer.meshedChunks, nearCount, 'mismo radio, misma cantidad de chunks');
});

test('en las cuatro paredes la textura queda derecha: u horizontal y v hacia abajo', () => {
  const world = new World(createDefaultBlockRegistry(), GameConfig);
  world.setBlockId(4, 4, 4, BlockIds.LOG);
  const [chunk] = world.chunks;
  for (const greedy of [false, true]) {
    const mesh = new ChunkMeshBuilder(world.blockRegistry, SIZE).build(world, chunk, { greedy });
    const log = mesh.groups.get(BlockIds.LOG);
    for (let quad = 0; quad < log.faceCount; quad += 1) {
      if (log.normals[quad * 12 + 1] !== 0) continue;
      for (let vertex = 0; vertex < 4; vertex += 1) {
        const y = log.positions[quad * 12 + vertex * 3 + 1];
        const v = log.uvs[quad * 8 + vertex * 2 + 1];
        assert.equal(v, y === 5 * SIZE ? 0 : 1, `cara ${quad}: el borde de arriba de la imagen va arriba`);
      }
      const us = new Set([0, 1, 2, 3].map((vertex) => log.uvs[quad * 8 + vertex * 2]));
      const sameColumn = [0, 1, 2, 3].filter((vertex) => log.uvs[quad * 8 + vertex * 2] === 0)
        .map((vertex) => log.positions[quad * 12 + vertex * 3 + 1]);
      assert.deepEqual(us, new Set([0, 1]));
      assert.equal(new Set(sameColumn).size, 2, 'u no cambia al subir: la imagen no está girada');
    }
  }
});

test('entre dos hojas o dos vidrios no se dibuja la cara que comparten', () => {
  const world = new World(createDefaultBlockRegistry(), GameConfig);
  world.setBlockId(4, 4, 4, BlockIds.LEAVES);
  world.setBlockId(5, 4, 4, BlockIds.LEAVES);
  world.setBlockId(8, 4, 4, BlockIds.GLASS);
  world.setBlockId(8, 5, 4, BlockIds.GLASS);
  world.setBlockId(10, 4, 4, BlockIds.GLASS);
  world.setBlockId(11, 4, 4, BlockIds.LEAVES);
  const [chunk] = world.chunks;
  for (const greedy of [false, true]) {
    const mesh = new ChunkMeshBuilder(world.blockRegistry, SIZE).build(world, chunk, { greedy });
    const area = coverage(mesh);
    const total = (blockId) => [...area].filter(([key]) => key.startsWith(`${blockId}|`)).reduce((sum, [, value]) => sum + value, 0);
    // Dos hojas juntas: 12 caras menos las 2 que se tocan. Una hoja suelta al lado del vidrio: 6.
    assert.equal(total(BlockIds.LEAVES), 10 + 6, `greedy ${greedy}`);
    // Dos vidrios apilados: 10. Un vidrio al lado de una hoja sí muestra esa cara: 6.
    assert.equal(total(BlockIds.GLASS), 10 + 6, `greedy ${greedy}`);
  }
});

test('con un tope de tiempo se arma al menos una malla por frame', () => {
  const config = { ...GameConfig, rendering: { ...GameConfig.rendering, MESH_BUILD_BUDGET_MS: 0 } };
  const world = generatedWorld(config);
  const renderer = new BlockRenderer(createP5Stub(), world.blockRegistry, { get: () => null }, config);
  renderer.setRenderDistance(world.width);
  const center = { x: (world.width / 2) * SIZE, y: 200, z: (world.depth / 2) * SIZE };
  renderer.render(world, center);
  assert.equal(renderer.meshedChunks, 1);
  renderer.render(world, center);
  assert.equal(renderer.meshedChunks, 2);
});
