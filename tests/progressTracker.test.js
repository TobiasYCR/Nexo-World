import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ProgressTracker, ScoreReasons } from '../src/progression/ProgressTracker.js';
import { ScoreRules } from '../src/progression/ScoreRules.js';
import { GameEvents, GameEventTypes } from '../src/game/GameEvents.js';
import { GameConfig } from '../src/game/GameConfig.js';
import { BlockIds } from '../src/utils/Constants.js';
import { createDefaultBlockRegistry } from '../src/blocks/BlockRegistry.js';
import { defaultWorld, findNatural } from './support/progression.js';

const POINTS = GameConfig.progression.POINTS;
const registry = createDefaultBlockRegistry();
const type = (id) => registry.get(id);

function tracker() {
  const changes = [];
  const instance = new ProgressTracker(defaultWorld().terrain, new ScoreRules(), (change) => changes.push(change));
  return { tracker: instance, changes };
}

test('explorar suma una sola vez por celda, aunque se vuelva a pasar', () => {
  const { tracker: progress, changes } = tracker();
  const size = GameConfig.progression.EXPLORATION_CELL_SIZE;
  progress.observePosition(1, 1);
  progress.observePosition(2, 3);
  progress.observePosition(size + 1, 1);
  progress.observePosition(1, 1);
  assert.equal(progress.state.stats().exploredCells, 2);
  assert.equal(changes.filter(({ reason }) => reason === ScoreReasons.EXPLORATION).length, 2);
});

test('descubrir un bioma suma una vez por bioma', () => {
  const { tracker: progress, changes } = tracker();
  const { terrain } = defaultWorld();
  const visited = new Set();
  for (let x = 0; x < terrain.width; x += 1) {
    for (let z = 0; z < terrain.depth; z += 1) {
      progress.observePosition(x, z);
      visited.add(terrain.biomeIdAt(x, z));
    }
  }
  assert.equal(progress.state.stats().biomesDiscovered, visited.size);
  assert.equal(changes.filter(({ reason }) => reason === ScoreReasons.BIOME).length, visited.size);
  assert.equal(progress.state.stats().exploredCells, new ScoreRules().explorationCellCount(terrain.width, terrain.depth));
});

test('posiciones fuera del mundo no cuentan', () => {
  const { tracker: progress, changes } = tracker();
  progress.observePosition(-1, 4);
  progress.observePosition(4, 999);
  assert.deepEqual(changes, []);
});

test('un mineral natural puntúa una sola vez por posición', () => {
  const { tracker: progress, changes } = tracker();
  const { terrain } = defaultWorld();
  const [iron] = findNatural(terrain, BlockIds.IRON_ORE);

  progress.onBlockBroken({ position: iron, blockType: type(BlockIds.IRON_ORE) });
  assert.equal(progress.score, POINTS.ORES[BlockIds.IRON_ORE]);
  // El evento repetido (o volver a romper un mineral reinstalado en la misma celda) no suma.
  progress.onBlockBroken({ position: iron, blockType: type(BlockIds.IRON_ORE) });
  assert.equal(progress.score, POINTS.ORES[BlockIds.IRON_ORE]);
  assert.deepEqual(changes, [{ delta: POINTS.ORES[BlockIds.IRON_ORE], reason: ScoreReasons.ORE }]);
});

test('romper bloques comunes del terreno no da puntos', () => {
  const { tracker: progress, changes } = tracker();
  const { terrain } = defaultWorld();
  for (const blockId of [BlockIds.STONE, BlockIds.DIRT, BlockIds.GRASS]) {
    const [position] = findNatural(terrain, blockId);
    progress.onBlockBroken({ position, blockType: type(blockId) });
  }
  assert.equal(progress.score, 0);
  assert.deepEqual(changes, []);
});

test('colocar y romper el mismo bloque repetidamente tiene saldo cero', () => {
  const { tracker: progress } = tracker();
  const position = { x: 5, y: defaultWorld().terrain.height - 2, z: 5 };
  for (let round = 0; round < 50; round += 1) {
    progress.onBlockPlaced({ position, blockType: type(BlockIds.PLANKS) });
    progress.onBlockBroken({ position, blockType: type(BlockIds.PLANKS) });
  }
  assert.equal(progress.score, 0);
  assert.equal(progress.state.blocksBuilt, 0);
});

test('colocar un mineral obtenido y volver a romperlo no da puntos de minería', () => {
  const { tracker: progress } = tracker();
  const { terrain } = defaultWorld();
  const air = { x: 3, y: terrain.height - 2, z: 3 };
  const [gold] = findNatural(terrain, BlockIds.GOLD_ORE);

  progress.onBlockBroken({ position: gold, blockType: type(BlockIds.GOLD_ORE) });
  const afterMining = progress.score;
  for (let round = 0; round < 20; round += 1) {
    progress.onBlockPlaced({ position: air, blockType: type(BlockIds.GOLD_ORE) });
    progress.onBlockBroken({ position: air, blockType: type(BlockIds.GOLD_ORE) });
    // Reinstalarlo en su celda natural tampoco vuelve a pagar.
    progress.onBlockPlaced({ position: gold, blockType: type(BlockIds.GOLD_ORE) });
    progress.onBlockBroken({ position: gold, blockType: type(BlockIds.GOLD_ORE) });
  }
  assert.equal(progress.score, afterMining);
});

test('construir suma por bloque en pie y no penaliza restaurar el terreno', () => {
  const { tracker: progress } = tracker();
  const { terrain } = defaultWorld();
  for (let x = 0; x < 10; x += 1) progress.onBlockPlaced({ position: { x, y: terrain.height - 2, z: 10 }, blockType: type(BlockIds.COBBLESTONE) });
  assert.equal(progress.score, 10 * POINTS.BLOCK_BUILT);

  // Volver a poner tierra donde había tierra no es construir, y quitarla no descuenta.
  const [dirt] = findNatural(terrain, BlockIds.DIRT);
  progress.onBlockPlaced({ position: dirt, blockType: type(BlockIds.DIRT) });
  progress.onBlockBroken({ position: dirt, blockType: type(BlockIds.DIRT) });
  assert.equal(progress.score, 10 * POINTS.BLOCK_BUILT);
});

test('attach se suscribe una sola vez a los eventos del juego', () => {
  const events = new GameEvents();
  const { tracker: progress } = tracker();
  progress.attach(events);
  progress.attach(events);
  const [coal] = findNatural(defaultWorld().terrain, BlockIds.COAL_ORE, 1);
  events.emit(GameEventTypes.BLOCK_BROKEN, { position: coal, blockType: type(BlockIds.COAL_ORE) });
  events.emit(GameEventTypes.BLOCK_PLACED, { position: { x: 1, y: 22, z: 1 }, blockType: type(BlockIds.PLANKS) });
  assert.equal(progress.score, POINTS.ORES[BlockIds.COAL_ORE] + POINTS.BLOCK_BUILT);

  progress.detach();
  events.emit(GameEventTypes.BLOCK_PLACED, { position: { x: 2, y: 22, z: 1 }, blockType: type(BlockIds.PLANKS) });
  assert.equal(progress.score, POINTS.ORES[BlockIds.COAL_ORE] + POINTS.BLOCK_BUILT);
});
