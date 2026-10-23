import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ScoreRules } from '../src/progression/ScoreRules.js';
import { ProgressState } from '../src/progression/ProgressState.js';
import { Leaderboard } from '../src/progression/Leaderboard.js';
import { WorldKey } from '../src/progression/WorldKey.js';
import { ProgressValidator } from '../src/progression/ProgressValidator.js';
import { GameConfig } from '../src/game/GameConfig.js';
import { BlockIds } from '../src/utils/Constants.js';
import { defaultWorld, findNatural } from './support/progression.js';

const POINTS = GameConfig.progression.POINTS;

test('los puntos salen solo de la configuración y se desglosan por categoría', () => {
  const rules = new ScoreRules();
  const stats = {
    exploredCells: 3,
    biomesDiscovered: 2,
    oresMined: { [BlockIds.COAL_ORE]: 4, [BlockIds.DIAMOND_ORE]: 1 },
    blocksBuilt: 7
  };
  const breakdown = rules.breakdown(stats);
  assert.deepEqual(breakdown, {
    exploration: 3 * POINTS.EXPLORATION_CELL,
    biomes: 2 * POINTS.BIOME_DISCOVERED,
    mining: 4 * POINTS.ORES[BlockIds.COAL_ORE] + POINTS.ORES[BlockIds.DIAMOND_ORE],
    building: 7 * POINTS.BLOCK_BUILT,
    total: breakdown.exploration + breakdown.biomes + breakdown.mining + breakdown.building
  });
  assert.equal(rules.scoreOf(stats), breakdown.total);
});

test('una configuración distinta cambia los puntos sin tocar código', () => {
  const config = { ...GameConfig.progression, POINTS: { ...GameConfig.progression.POINTS, EXPLORATION_CELL: 100 } };
  assert.equal(new ScoreRules(config).scoreOf({ exploredCells: 2, biomesDiscovered: 0, oresMined: {}, blocksBuilt: 0 }), 200);
});

test('solo los minerales configurados puntúan y la construcción tiene tope', () => {
  const rules = new ScoreRules();
  assert.equal(rules.isScoringOre(BlockIds.STONE), false);
  assert.equal(rules.isScoringOre(BlockIds.DIRT), false);
  assert.equal(rules.isScoringOre(BlockIds.GOLD_ORE), true);
  const cap = GameConfig.progression.MAX_BLOCKS_BUILT_COUNTED;
  assert.equal(rules.breakdown({ exploredCells: 0, biomesDiscovered: 0, oresMined: {}, blocksBuilt: cap + 500 }).building, cap * POINTS.BLOCK_BUILT);
});

test('las celdas de exploración cubren el mundo sin solaparse', () => {
  const rules = new ScoreRules();
  const size = GameConfig.progression.EXPLORATION_CELL_SIZE;
  assert.equal(rules.explorationCellCount(32, 32), (32 / size) ** 2);
  assert.equal(rules.explorationCellOf(0, 0, 32), 0);
  assert.equal(rules.explorationCellOf(size - 1, size - 1, 32), 0);
  assert.equal(rules.explorationCellOf(size, 0, 32), 1);
  assert.equal(rules.explorationCellOf(0, size, 32), 32 / size);
  assert.equal(rules.explorationCellCount(33, 32), 5 * 4, 'un borde parcial cuenta como celda');
});

test('ProgressState no duplica hechos y se serializa de ida y vuelta', () => {
  const state = new ProgressState();
  assert.equal(state.markExplored(3), true);
  assert.equal(state.markExplored(3), false);
  assert.equal(state.markBiome(1), true);
  assert.equal(state.markBiome(1), false);
  assert.equal(state.markMined(BlockIds.IRON_ORE, 900), true);
  assert.equal(state.markMined(BlockIds.GOLD_ORE, 900), false, 'una posición recompensa una sola vez, sea cual sea el mineral');
  assert.equal(state.addBuilt(-5), 0, 'las construcciones no bajan de cero');
  state.addBuilt(2);

  const copy = ProgressState.parse(JSON.parse(JSON.stringify(state.toJSON())));
  assert.deepEqual(copy.toJSON(), state.toJSON());
  assert.deepEqual(copy.stats(), { exploredCells: 1, biomesDiscovered: 1, oresMined: { [BlockIds.IRON_ORE]: 1 }, blocksBuilt: 2 });
});

test('ProgressState.parse rechaza estructuras inválidas o manipuladas', () => {
  const valid = { version: 1, explored: [], biomes: [], mined: {}, blocksBuilt: 0 };
  assert.ok(ProgressState.parse(valid));
  for (const invalid of [
    null,
    [],
    { ...valid, version: 99 },
    { ...valid, explored: [-1] },
    { ...valid, explored: [1.5] },
    { ...valid, biomes: 'todos' },
    { ...valid, mined: { abc: [1] } },
    { ...valid, mined: { 12: [5], 13: [5] } },
    { ...valid, blocksBuilt: -3 },
    { ...valid, blocksBuilt: 1e20 }
  ]) {
    assert.equal(ProgressState.parse(invalid), null, JSON.stringify(invalid));
  }
});

test('merge une progresos sin perder ni duplicar y includes detecta datos viejos', () => {
  const first = new ProgressState({ explored: [1, 2], biomes: [0], mined: { 12: [10] }, blocksBuilt: 4 });
  const second = new ProgressState({ explored: [2, 3], biomes: [2], mined: { 13: [20] }, blocksBuilt: 1 });
  const merged = ProgressState.merge(first, second);
  assert.deepEqual(merged.exploredCells(), [1, 2, 3]);
  assert.deepEqual(merged.biomes(), [0, 2]);
  assert.equal(merged.stats().oresMined[12] + merged.stats().oresMined[13], 2);
  assert.equal(merged.blocksBuilt, 4);
  assert.equal(merged.includes(first), true);
  assert.equal(first.includes(merged), false);
});

test('Leaderboard: orden descendente, desempate por fecha y luego por id', () => {
  const entries = [
    { playerId: 'c', score: 10, achievedAt: 5 },
    { playerId: 'b', score: 30, achievedAt: 9 },
    { playerId: 'a', score: 10, achievedAt: 5 },
    { playerId: 'd', score: 10, achievedAt: 2 }
  ];
  assert.deepEqual(Leaderboard.top(entries, 10).map(({ playerId, position }) => `${position}${playerId}`), ['1b', '2d', '3a', '4c']);
  assert.deepEqual(Leaderboard.top(entries, 2).map(({ playerId }) => playerId), ['b', 'd']);
  assert.equal(Leaderboard.positionOf(entries, 'c'), 4);
  assert.equal(Leaderboard.positionOf(entries, 'zzz'), null);
  assert.deepEqual(Leaderboard.top([], 10), []);
  assert.equal(Leaderboard.improves(null, 0), true);
  assert.equal(Leaderboard.improves({ score: 10 }, 10), false);
});

test('WorldKey identifica el mundo generado y rechaza claves mal formadas', () => {
  const { generator, world, worldKey } = defaultWorld();
  assert.equal(worldKey, `s${GameConfig.world.SEED}-v2-32x24x32`);
  assert.deepEqual(WorldKey.parse(worldKey), { seed: GameConfig.world.SEED, version: 2, width: 32, height: 24, depth: 32 });
  assert.equal(WorldKey.fromGenerator(generator, world), worldKey);
  for (const invalid of ['', 'otro', 's1-v2-32x24', 's99999999999-v2-1x1x1', `${'s1'.repeat(40)}-v2-1x1x1`, null]) {
    assert.equal(WorldKey.parse(invalid), null, String(invalid));
  }
});

test('el validador rechaza lo que no pudo pasar en el mundo', () => {
  const { terrain } = defaultWorld();
  const validator = new ProgressValidator();
  const [coal] = findNatural(terrain, BlockIds.COAL_ORE);
  const [stone] = findNatural(terrain, BlockIds.STONE);
  const coalIndex = terrain.indexOf(coal.x, coal.y, coal.z);
  const worldBiome = [...terrain.biomeIds()][0];

  assert.equal(validator.validate(new ProgressState({ explored: [0], biomes: [worldBiome], mined: { [BlockIds.COAL_ORE]: [coalIndex] } }), terrain).ok, true);
  assert.equal(validator.validate(new ProgressState({ explored: [999] }), terrain).ok, false, 'celda inexistente');
  assert.equal(validator.validate(new ProgressState({ biomes: [77] }), terrain).ok, false, 'bioma inexistente');
  assert.equal(validator.validate(new ProgressState({ mined: { [BlockIds.DIAMOND_ORE]: [coalIndex] } }), terrain).ok, false, 'otro mineral en esa posición');
  assert.equal(validator.validate(new ProgressState({ mined: { [BlockIds.STONE]: [terrain.indexOf(stone.x, stone.y, stone.z)] } }), terrain).ok, false, 'la piedra no puntúa');
  assert.equal(validator.validate(new ProgressState({ mined: { [BlockIds.COAL_ORE]: [terrain.cellCount + 5] } }), terrain).ok, false, 'fuera del mundo');
});
