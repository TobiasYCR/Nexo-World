import { performance } from 'node:perf_hooks';
import { BlockParticles } from '../src/viewmodel/BlockParticles.js';
import { BlockHighlight } from '../src/viewmodel/BlockHighlight.js';
import { BreakOverlay } from '../src/viewmodel/BreakOverlay.js';
import { HandRenderer } from '../src/viewmodel/HandRenderer.js';
import { AmbientParticles } from '../src/viewmodel/AmbientParticles.js';
import { DamageEffect } from '../src/viewmodel/DamageEffect.js';
import { CameraEffects } from '../src/viewmodel/CameraEffects.js';
import { GameConfig } from '../src/game/GameConfig.js';
import { createDefaultBlockRegistry } from '../src/blocks/BlockRegistry.js';

const PARTICLE_COUNT = 64;
const WARMUP_FRAMES = 2000;
const FRAMES_PER_BATCH = 5000;
const BATCH_COUNT = 10;

const particles = new BlockParticles({
  ...GameConfig.viewmodel.particles,
  MIN_COUNT: PARTICLE_COUNT / 4,
  MAX_COUNT: PARTICLE_COUNT / 4,
  MAX_PARTICLES: PARTICLE_COUNT,
  LIFETIME_SECONDS: (WARMUP_FRAMES + BATCH_COUNT * FRAMES_PER_BATCH) / 60 + 1,
  GRAVITY: 0
});
for (let spawn = 0; spawn < PARTICLE_COUNT / 16; spawn += 1) {
  particles.spawn({ x: 0, y: 0, z: 0 }, [120, 140, 160]);
}
if (particles.activeCount !== PARTICLE_COUNT) {
  throw new Error(`El benchmark requiere ${PARTICLE_COUNT} partículas activas; hay ${particles.activeCount}.`);
}

const calls = { push: 0, pop: 0, drawCalls: 0, vertices: 0 };
const p = {
  width: 1280,
  height: 720,
  push: () => { calls.push += 1; },
  pop: () => { calls.pop += 1; },
  noStroke: () => { calls.drawCalls += 1; },
  noFill: () => { calls.drawCalls += 1; },
  stroke: () => { calls.drawCalls += 1; },
  strokeWeight: () => { calls.drawCalls += 1; },
  translate: (x, y, z) => { calls.vertices += x + y + z; },
  rotateZ: () => { calls.drawCalls += 1; },
  fill: () => { calls.drawCalls += 1; },
  ambientMaterial: () => { calls.drawCalls += 1; },
  box: (size) => { calls.vertices += size; },
  texture: () => { calls.drawCalls += 1; },
  clearDepth: () => { calls.drawCalls += 1; },
  frustum: () => { calls.drawCalls += 1; },
  camera: () => { calls.drawCalls += 1; }
  ,resetMatrix: () => { calls.drawCalls += 1; }
  ,rectMode: () => { calls.drawCalls += 1; }
  ,rect: () => { calls.drawCalls += 1; }
};

const highlight = new BlockHighlight(GameConfig.viewmodel.highlight, GameConfig.world.BLOCK_SIZE);
const targetBlock = { x: 1, y: 2, z: 3 };
highlight.update(targetBlock);
const breakOverlay = new BreakOverlay(p, GameConfig.viewmodel.breakOverlay, GameConfig.world.BLOCK_SIZE);
breakOverlay.update(targetBlock, 0.5);
const hand = new HandRenderer(
  { get: () => null },
  null,
  GameConfig.viewmodel.hand,
  GameConfig.camera,
  GameConfig.viewmodel.viewBob
);
const heldBlock = createDefaultBlockRegistry().placeableTypes()[0];
const handState = { isBreaking: true, horizontalSpeed: 80, isOnGround: true };
hand.setSelectedSlot(0, heldBlock);
const ambient = new AmbientParticles({
  ...GameConfig.viewmodel.ambientParticles,
  MAX_PARTICLES: 64,
  SPAWN_RATE: 128,
  DENSITY_FOREST: 1,
  PARTICLE_LIFETIME: 120
}, { random: () => 0.5 });
const damage = new DamageEffect(GameConfig.viewmodel.damage);
const cameraEffects = new CameraEffects(GameConfig.viewmodel.cameraEffects);
damage.trigger(8, 20);
cameraEffects.trigger({ amplitude: 1, duration: 10, rotation: 0.01 });

function frame() {
  particles.update(1 / 60);
  ambient.update(1 / 60, { playerPosition: { x: 0, y: 40, z: 0 }, biome: { name: 'Forest' } });
  damage.update(1 / 60);
  cameraEffects.update(1 / 60);
  highlight.update(targetBlock);
  breakOverlay.update(targetBlock, 0.5);
  hand.setSelectedSlot(0, heldBlock);
  hand.update(1 / 60, handState);
  highlight.draw(p);
  breakOverlay.draw(p);
  particles.draw(p);
  ambient.draw(p);
  damage.draw(p);
  hand.draw(p);
}

for (let index = 0; index < WARMUP_FRAMES; index += 1) frame();

let elapsedTotal = 0;
let slowestBatchFrameMs = 0;
for (let batch = 0; batch < BATCH_COUNT; batch += 1) {
  const start = performance.now();
  for (let index = 0; index < FRAMES_PER_BATCH; index += 1) frame();
  const elapsed = performance.now() - start;
  elapsedTotal += elapsed;
  slowestBatchFrameMs = Math.max(slowestBatchFrameMs, elapsed / FRAMES_PER_BATCH);
}

const averageFrameMs = elapsedTotal / (BATCH_COUNT * FRAMES_PER_BATCH);
console.log(`64 partículas de bloques + 64 ambientales y efectos de pantalla; update + draw() (p5 instrumentado, sin GPU)`);
console.log(`Promedio: ${averageFrameMs.toFixed(5)} ms/frame`);
console.log(`Peor promedio por lote: ${slowestBatchFrameMs.toFixed(5)} ms/frame`);
console.log(`Umbral < 2 ms: ${averageFrameMs < 2 ? 'CUMPLE' : 'NO CUMPLE'}`);
console.log(`Llamadas instrumentadas: ${calls.drawCalls}; acumulador: ${calls.vertices.toFixed(0)}`);
if (averageFrameMs >= 2) process.exitCode = 1;
