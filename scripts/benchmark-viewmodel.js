import { performance } from 'node:perf_hooks';
import { BlockParticles } from '../src/viewmodel/BlockParticles.js';
import { BlockHighlight } from '../src/viewmodel/BlockHighlight.js';
import { BreakOverlay } from '../src/viewmodel/BreakOverlay.js';
import { HandRenderer } from '../src/viewmodel/HandRenderer.js';
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
  LIFETIME_SECONDS: 600,
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
  fill: () => { calls.drawCalls += 1; },
  ambientMaterial: () => { calls.drawCalls += 1; },
  box: (size) => { calls.vertices += size; },
  texture: () => { calls.drawCalls += 1; },
  clearDepth: () => { calls.drawCalls += 1; },
  frustum: () => { calls.drawCalls += 1; },
  camera: () => { calls.drawCalls += 1; }
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

function frame() {
  particles.update(1 / 60);
  highlight.update(targetBlock);
  breakOverlay.update(targetBlock, 0.5);
  hand.setSelectedSlot(0, heldBlock);
  hand.update(1 / 60, handState);
  highlight.draw(p);
  breakOverlay.draw(p);
  particles.draw(p);
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
console.log(`64 partículas y cuatro overlays activos; update + draw() (p5 instrumentado, sin GPU)`);
console.log(`Promedio: ${averageFrameMs.toFixed(5)} ms/frame`);
console.log(`Peor promedio por lote: ${slowestBatchFrameMs.toFixed(5)} ms/frame`);
console.log(`Umbral < 1 ms: ${averageFrameMs < 1 ? 'CUMPLE' : 'NO CUMPLE'}`);
console.log(`Llamadas instrumentadas: ${calls.drawCalls}; acumulador: ${calls.vertices.toFixed(0)}`);
if (averageFrameMs >= 1) process.exitCode = 1;
