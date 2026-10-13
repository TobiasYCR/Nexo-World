/**
 * Tiempo de generación del mundo de 128x128x48 (el tamaño objetivo de la etapa).
 * Uso: node scripts/benchmark-worldgen.js [semilla] [corridas]
 *
 * Mide solo CPU de la generación (WorldGenerator.generate); no incluye render.
 */
import { World } from '../src/world/World.js';
import { WorldGenerator } from '../src/world/WorldGenerator.js';
import { createDefaultBlockRegistry } from '../src/blocks/BlockRegistry.js';
import { GameConfig } from '../src/game/GameConfig.js';

const SIZE = Object.freeze({ WORLD_WIDTH: 128, WORLD_HEIGHT: 48, WORLD_DEPTH: 128 });
const WARMUP_RUNS = 2;

const seed = Number(process.argv[2] ?? GameConfig.world.SEED);
const runs = Number(process.argv[3] ?? 9);
const config = { ...GameConfig, world: { ...GameConfig.world, ...SIZE } };

const median = (values) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];

const samples = [];
let stats = null;
for (let run = 0; run < WARMUP_RUNS + runs; run += 1) {
  const world = new World(createDefaultBlockRegistry(), config);
  const generator = new WorldGenerator(config, { seed });
  generator.generate(world);
  if (run >= WARMUP_RUNS) samples.push(generator.stats);
  stats = generator.stats;
}

const phases = Object.keys(stats.phases)
  .map((phase) => `${phase} ${median(samples.map((sample) => sample.phases[phase])).toFixed(1)} ms`)
  .join(', ');

console.log(`Mundo ${SIZE.WORLD_WIDTH}x${SIZE.WORLD_DEPTH}x${SIZE.WORLD_HEIGHT}, semilla ${seed}, generador v${stats.version}, ${runs} corridas`);
console.log(`Total (mediana): ${median(samples.map((sample) => sample.totalMs)).toFixed(1)} ms`);
console.log(`Fases (mediana): ${phases}`);
console.log(`Bloques escritos: ${stats.blocksWritten}, excavados por cuevas: ${stats.cavesCarved}, árboles: ${stats.trees}`);
console.log(`Columnas por bioma: ${JSON.stringify(stats.biomeColumns)}`);
console.log(`Vetas (vetas/celdas): ${Object.entries(stats.ores).map(([name, ore]) => `${name} ${ore.veins}/${ore.cells}`).join(', ')}`);
