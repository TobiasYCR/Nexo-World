import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FootstepPlayer } from '../src/audio/FootstepPlayer.js';
import { SoundIds } from '../src/utils/Constants.js';
import { AssetCatalog } from '../src/utils/AssetCatalog.js';
import { GameConfig } from '../src/game/GameConfig.js';
import { existsSync } from 'node:fs';

const CONFIG = { STEP_DISTANCE_BLOCKS: 2, STEP_VOLUME: 0.5 };

function walk(player, seconds, state) {
  const sounds = [];
  for (let t = 0; t < seconds; t += 0.05) {
    const sound = player.update(0.05, state);
    if (sound) sounds.push(sound);
  }
  return sounds;
}

test('suena un paso cada STEP_DISTANCE_BLOCKS recorridos, alternando los dos sonidos', () => {
  const player = new FootstepPlayer(CONFIG, 20);
  // 40 unidades por paso a 40 u/s: un paso por segundo.
  const sounds = walk(player, 4.01, { horizontalSpeed: 40, onGround: true, flying: false });
  assert.equal(sounds.length, 4);
  assert.deepEqual(sounds.slice(0, 2), [SoundIds.STEP_1, SoundIds.STEP_2]);
});

test('corriendo suenan más seguido', () => {
  const walking = walk(new FootstepPlayer(CONFIG, 20), 4, { horizontalSpeed: 40, onGround: true, flying: false });
  const running = walk(new FootstepPlayer(CONFIG, 20), 4, { horizontalSpeed: 80, onGround: true, flying: false });
  assert.ok(running.length > walking.length);
});

test('quieto, en el aire o volando no hay pasos', () => {
  const player = new FootstepPlayer(CONFIG, 20);
  assert.deepEqual(walk(player, 3, { horizontalSpeed: 0, onGround: true, flying: false }), []);
  assert.deepEqual(walk(player, 3, { horizontalSpeed: 80, onGround: false, flying: false }), []);
  assert.deepEqual(walk(player, 3, { horizontalSpeed: 80, onGround: true, flying: true }), []);
});

test('los archivos de los pasos existen y están en el catálogo', () => {
  const catalog = new AssetCatalog(GameConfig.assets);
  for (const id of [SoundIds.STEP_1, SoundIds.STEP_2]) {
    const url = catalog.soundUrl(id);
    assert.ok(url);
    assert.ok(existsSync(`assets/audio/${AssetCatalog.SOUNDS[id].path}`), url);
  }
});
