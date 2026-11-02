import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LevelRules } from '../src/progression/LevelRules.js';
import { LevelProgress } from '../src/progression/LevelProgress.js';
import { LevelUpEffect } from '../src/viewmodel/LevelUpEffect.js';
import { PlayerProgression } from '../src/progression/PlayerProgression.js';
import { ProgressionApiClient } from '../src/progression/ProgressionApiClient.js';
import { ProgressionLocalStore } from '../src/progression/ProgressionLocalStore.js';
import { GameEvents, GameEventTypes } from '../src/game/GameEvents.js';
import { GameConfig } from '../src/game/GameConfig.js';
import { BlockIds } from '../src/utils/Constants.js';
import { createDefaultBlockRegistry } from '../src/blocks/BlockRegistry.js';
import { createP5Stub } from './support/domStub.js';
import { defaultWorld } from './support/progression.js';

const LEVEL_CONFIG = Object.freeze({
  ...GameConfig.levels,
  XP_EXPLORATION_CELL: 2,
  XP_BIOME: 3,
  XP_ORES: 4,
  XP_BLOCK_BUILT: 1,
  BASE_XP: 10,
  GROWTH: 2,
  MAX_LEVEL: 3
});

class MemoryStorage {
  #items = new Map();
  getItem(key) { return this.#items.get(key) ?? null; }
  setItem(key, value) { this.#items.set(key, String(value)); }
  removeItem(key) { this.#items.delete(key); }
}

test('la experiencia usa estadísticas configurables y no la puntuación', () => {
  const rules = new LevelRules(LEVEL_CONFIG);
  const experience = rules.experienceFromStats({
    exploredCells: 2,
    biomesDiscovered: 1,
    oresMined: { [BlockIds.COAL_ORE]: 2 },
    blocksBuilt: 3
  });

  assert.equal(experience, 18);
  assert.equal(rules.levelForExperience(experience), 2);
  assert.equal(rules.experienceForNextLevel(experience), 30);
});

test('el progreso cruza varios niveles, conserva el máximo y acota la barra', () => {
  const progress = new LevelProgress(new LevelRules(LEVEL_CONFIG));
  assert.equal(progress.experience, 0);
  assert.equal(progress.level, 1);
  assert.equal(progress.levelProgress, 0);

  const levelUps = progress.update({ blocksBuilt: 30 });
  assert.deepEqual(levelUps, [
    { level: 2, previousLevel: 1 },
    { level: 3, previousLevel: 2 }
  ]);
  assert.equal(progress.isMaxLevel, true);
  assert.equal(progress.levelProgress, 1);

  assert.deepEqual(progress.update({ blocksBuilt: 0 }), []);
  assert.equal(progress.experience, 30);
  assert.equal(progress.level, 3);
});

test('la recuperación calcula el nivel guardado sin emitir levelUp', async () => {
  const storage = new MemoryStorage();
  const { terrain, worldKey } = defaultWorld();
  const registry = createDefaultBlockRegistry();
  const events = new GameEvents();
  const levelUps = [];
  events.on(GameEventTypes.LEVEL_UP, (payload) => levelUps.push(payload));

  const first = new PlayerProgression({
    config: GameConfig.progression,
    levelConfig: LEVEL_CONFIG,
    apiClient: new ProgressionApiClient(GameConfig.progression, null),
    store: new ProgressionLocalStore(storage),
    events
  });
  await first.start(terrain, worldKey);
  for (let index = 0; index < 30; index += 1) {
    events.emit(GameEventTypes.BLOCK_PLACED, {
      position: { x: 1 + index, y: 22, z: 1 },
      blockType: registry.get(BlockIds.PLANKS)
    });
  }
  assert.equal(first.level, 3);
  assert.deepEqual(levelUps, [
    { level: 2, previousLevel: 1 },
    { level: 3, previousLevel: 2 }
  ]);

  const recoveredEvents = new GameEvents();
  const recoveredLevelUps = [];
  recoveredEvents.on(GameEventTypes.LEVEL_UP, (payload) => recoveredLevelUps.push(payload));
  const recovered = new PlayerProgression({
    config: GameConfig.progression,
    levelConfig: LEVEL_CONFIG,
    apiClient: new ProgressionApiClient(GameConfig.progression, null),
    store: new ProgressionLocalStore(storage),
    events: recoveredEvents
  });
  await recovered.start(terrain, worldKey);
  assert.equal(recovered.level, 3);
  assert.equal(recovered.experience, 30);
  assert.deepEqual(recoveredLevelUps, []);
});

test('el efecto de subida se puede apagar desde la configuración', () => {
  const p = createP5Stub();
  const enabled = new LevelUpEffect({ ...LEVEL_CONFIG, SHOW_LEVEL_UP_EFFECT: true });
  enabled.trigger();
  assert.equal(enabled.isActive, true);
  enabled.draw(p, null);
  assert.ok(p.calls.box > 0);
  enabled.update(LEVEL_CONFIG.EFFECT_DURATION);
  assert.equal(enabled.isActive, false);

  const disabled = new LevelUpEffect({ ...LEVEL_CONFIG, SHOW_LEVEL_UP_EFFECT: false });
  disabled.trigger();
  assert.equal(disabled.isActive, false);
});
