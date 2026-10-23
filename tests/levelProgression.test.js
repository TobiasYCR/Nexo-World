import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GameConfig } from '../src/game/GameConfig.js';
import { LevelRules } from '../src/progression/LevelRules.js';
import { LevelProgress } from '../src/progression/LevelProgress.js';
import { PlayerProgression } from '../src/progression/PlayerProgression.js';
import { ProgressState } from '../src/progression/ProgressState.js';
import { ProgressionResult } from '../src/progression/ProgressionResult.js';
import { GameEvents, GameEventTypes } from '../src/game/GameEvents.js';
import { LevelUpEffect } from '../src/viewmodel/LevelUpEffect.js';
import { createP5Stub } from './support/domStub.js';
import { defaultWorld } from './support/progression.js';

const LEVELS = {
  ...GameConfig.levels,
  XP_EXPLORATION_CELL: 5,
  XP_BIOME: 20,
  XP_ORES: 10,
  XP_BLOCK_BUILT: 1,
  BASE_XP: 100,
  GROWTH: 2,
  MAX_LEVEL: 4
};

test('la experiencia usa pesos configurables y no es la puntuación', () => {
  const rules = new LevelRules(LEVELS);
  const experience = rules.experienceFromStats({
    exploredCells: 2,
    biomesDiscovered: 1,
    oresMined: { 10: 3, 11: 2 },
    blocksBuilt: 4
  });

  assert.equal(experience, 2 * 5 + 20 + 5 * 10 + 4);
  assert.equal(new LevelRules({ ...LEVELS, XP_ORES: 3 }).experienceFromStats({ oresMined: { 10: 2 } }), 6);
});

test('la curva progresiva calcula umbrales acumulados y respeta el máximo', () => {
  const rules = new LevelRules(LEVELS);

  assert.equal(rules.experienceForLevel(1), 0);
  assert.equal(rules.experienceForLevel(2), 100);
  assert.equal(rules.experienceForLevel(3), 300);
  assert.equal(rules.experienceForLevel(4), 700);
  assert.equal(rules.levelForExperience(0), 1);
  assert.equal(rules.levelForExperience(699), 3);
  assert.equal(rules.levelForExperience(700), 4);
  assert.equal(rules.levelForExperience(99999), 4);
});

test('LevelProgress informa cero, límites y varias subidas sin retroceder', () => {
  const progress = new LevelProgress(new LevelRules(LEVELS));
  progress.load({});
  assert.deepEqual(progress.snapshot(), {
    level: 1,
    experience: 0,
    experienceForNextLevel: 100,
    levelProgress: 0,
    isMaxLevel: false
  });

  assert.deepEqual(progress.update({ blocksBuilt: 350 }), [
    { level: 2, previousLevel: 1 },
    { level: 3, previousLevel: 2 }
  ]);
  assert.equal(progress.level, 3);
  assert.equal(progress.levelProgress, 0.125);

  assert.deepEqual(progress.update({ blocksBuilt: 700 }), [{ level: 4, previousLevel: 3 }]);
  assert.equal(progress.level, 4);
  assert.equal(progress.levelProgress, 1);
  assert.equal(progress.isMaxLevel, true);
  assert.deepEqual(progress.update({ blocksBuilt: 0 }), []);
  assert.equal(progress.level, 4);
});

test('el efecto se dispara solo cuando está habilitado y se apaga al terminar', () => {
  const p = createP5Stub();
  const effect = new LevelUpEffect({ ...LEVELS, SHOW_LEVEL_UP_EFFECT: true }, GameConfig.camera);
  assert.equal(effect.trigger(3), true);
  assert.equal(effect.active, true);
  assert.equal(effect.level, 3);
  effect.draw(p, null);
  assert.ok(p.calls.box > 0, 'el efecto dibuja destellos en primera persona');
  effect.update(LEVELS.EFFECT_DURATION);
  assert.equal(effect.active, false);

  const disabled = new LevelUpEffect({ ...LEVELS, SHOW_LEVEL_UP_EFFECT: false }, GameConfig.camera);
  assert.equal(disabled.trigger(2), false);
  assert.equal(disabled.active, false);
});

test('PlayerProgression recupera el nivel sin emitir y emite una vez por nivel nuevo', async () => {
  const config = {
    ...GameConfig.progression,
    GAME_MODE: 'survival'
  };
  const levelConfig = {
    ...LEVELS,
    XP_EXPLORATION_CELL: 1,
    XP_BIOME: 0,
    XP_ORES: 0,
    XP_BLOCK_BUILT: 1,
    BASE_XP: 1,
    GROWTH: 1,
    MAX_LEVEL: 5
  };
  const initialState = new ProgressState({ explored: [0, 1] }).toJSON();
  const store = {
    record: { revision: 2, state: initialState },
    loadProgress() { return this.record; },
    saveProgress(_mode, _worldKey, revision, state) { this.record = { revision, state }; },
    loadIdentity() { return null; },
    saveIdentity() {},
    clearIdentity() {}
  };
  const offlineApi = {
    registerPlayer: async () => ProgressionResult.fail(ProgressionResult.Reasons.OFFLINE),
    getProgress: async () => ProgressionResult.fail(ProgressionResult.Reasons.OFFLINE)
  };
  const events = new GameEvents();
  const levelUps = [];
  events.on(GameEventTypes.LEVEL_UP, (payload) => levelUps.push(payload));
  const progression = new PlayerProgression({
    config,
    levelConfig,
    store,
    apiClient: offlineApi,
    events
  });

  await progression.start(defaultWorld().terrain, defaultWorld().worldKey);
  assert.equal(progression.level, 3);
  assert.equal(levelUps.length, 0, 'recuperar un guardado no debe emitir levelUp');

  events.emit(GameEventTypes.BLOCK_PLACED, { position: { x: -1, y: -1, z: -1 }, blockType: { id: 99 } });
  events.emit(GameEventTypes.BLOCK_PLACED, { position: { x: -1, y: -1, z: -1 }, blockType: { id: 99 } });
  assert.deepEqual(levelUps, [
    { level: 4, previousLevel: 3 },
    { level: 5, previousLevel: 4 }
  ]);
  assert.equal(progression.isMaxLevel, true);

  const recovered = new PlayerProgression({ config, levelConfig, store, apiClient: offlineApi });
  await recovered.start(defaultWorld().terrain, defaultWorld().worldKey);
  assert.equal(recovered.level, 5);
  assert.equal(recovered.experience, 4);
});
