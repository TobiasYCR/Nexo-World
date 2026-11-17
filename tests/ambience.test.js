import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { AmbientMusic } from '../src/audio/AmbientMusic.js';
import { CloudLayer } from '../src/rendering/CloudLayer.js';
import { GameConfig } from '../src/game/GameConfig.js';
import { generateSkyTextures } from '../scripts/generate-textures.js';

/** Parámetro de audio que registra lo agendado. */
function fakeParam() {
  return {
    value: 0,
    events: [],
    setValueAtTime(value, time) { this.events.push(['set', value, time]); },
    linearRampToValueAtTime(value, time) { this.events.push(['ramp', value, time]); },
    cancelScheduledValues() {}
  };
}

function fakeContext() {
  const context = {
    currentTime: 0,
    oscillators: [],
    createGain: () => ({ gain: fakeParam(), connect() {}, disconnect() { this.disconnected = true; } }),
    createBiquadFilter: () => ({ type: '', frequency: fakeParam(), connect() {} }),
    createOscillator: () => {
      const oscillator = { type: '', frequency: fakeParam(), connect() {}, start(at) { this.startAt = at; }, stop(at) { this.stopAt = at; } };
      context.oscillators.push(oscillator);
      return oscillator;
    }
  };
  return context;
}

function fakeTimers() {
  return {
    intervals: new Set(),
    setInterval(fn) { this.intervals.add(fn); return fn; },
    clearInterval(fn) { this.intervals.delete(fn); },
    setTimeout(fn) { fn(); },
    tick() { for (const fn of this.intervals) fn(); }
  };
}

test('la música no suena hasta que el audio se desbloquea', () => {
  const music = new AmbientMusic({ context: null, output: () => null }, { timers: fakeTimers() });
  assert.equal(music.start(), false);
  assert.equal(music.isPlaying, false);
});

test('la música agenda acordes y notas por adelantado, y sale por la categoría música', () => {
  const context = fakeContext();
  const categories = [];
  const audio = { context, output: (category) => { categories.push(category); return {}; } };
  const timers = fakeTimers();
  const music = new AmbientMusic(audio, { timers, random: () => 0.5 });
  assert.equal(music.start(), true);
  assert.deepEqual(categories, ['music']);
  assert.equal(music.scheduledChords, 1);
  // Un acorde de 4 notas más 3 notas de melodía (con random 0,5).
  assert.equal(context.oscillators.length, 7);

  context.currentTime = 20;
  timers.tick();
  assert.ok(music.scheduledChords >= 3, 'sigue agendando a medida que avanza el tiempo');
  for (const oscillator of context.oscillators) {
    assert.ok(oscillator.frequency.value >= 80 && oscillator.frequency.value <= 1100, 'notas en un rango agradable');
  }
});

test('apagar la música la detiene con un fundido y encenderla la vuelve a arrancar', () => {
  const context = fakeContext();
  const timers = fakeTimers();
  const music = new AmbientMusic({ context, output: () => ({}) }, { timers });
  music.start();
  music.setEnabled(false);
  assert.equal(music.isPlaying, false);
  assert.equal(timers.intervals.size, 0);
  assert.equal(music.start(), false, 'deshabilitada no arranca');
  music.setEnabled(true);
  assert.equal(music.isPlaying, true);
});

test('las nubes quedan fijas en el cielo y solo se mueven con el viento', () => {
  const calls = [];
  const p = {
    NORMAL: 'normal',
    REPEAT: 'repeat',
    push() {}, pop() {}, noLights() {}, noStroke() {},
    textureMode() {}, textureWrap(mode) { calls.push(['wrap', mode]); },
    texture() { calls.push(['texture']); },
    beginShape() { calls.push(['begin']); },
    vertex(...args) { calls.push(['vertex', ...args]); },
    endShape() {}
  };
  const config = GameConfig.rendering.CLOUDS;
  const clouds = new CloudLayer(p, config, { blockSize: 20, worldHeight: 24 });
  assert.equal(clouds.draw({ x: 0, z: 0 }), false, 'sin textura no dibuja');

  clouds.setTexture({});
  assert.equal(clouds.draw({ x: 0, z: 0 }), true);
  const first = calls.filter((call) => call[0] === 'vertex');
  assert.equal(first.length, 4, 'un solo cuadrado');
  assert.ok(first.every((vertex) => vertex[2] === (24 + config.HEIGHT_ABOVE_WORLD) * 20), 'sobre el mundo');
  assert.ok(calls.some((call) => call[0] === 'wrap' && call[1] === 'repeat'), 'la textura se repite');

  // Moverse no cambia qué nube hay en cada punto: u sale de la posición en el mundo.
  calls.length = 0;
  clouds.draw({ x: 400, z: 0 });
  const moved = calls.filter((call) => call[0] === 'vertex');
  const uAt = (vertex) => vertex[4] - vertex[1] / (config.TILE_BLOCKS * 20);
  assert.ok(Math.abs(uAt(moved[0]) - uAt(first[0])) < 1e-9);

  clouds.update(10);
  assert.ok(clouds.windOffset > 0, 'el viento las desplaza');
  clouds.setEnabled(false);
  assert.equal(clouds.draw({ x: 0, z: 0 }), false);
});

test('la textura de las nubes se repite sin cortes, tiene huecos y coincide con el archivo', () => {
  const textures = generateSkyTextures();
  const png = textures.get('clouds.png');
  const onDisk = new URL('../assets/textures/sky/clouds.png', import.meta.url);
  assert.ok(existsSync(onDisk), 'falta clouds.png: correr node scripts/generate-textures.js');
  assert.ok(readFileSync(onDisk).equals(png), 'clouds.png desactualizado');
});
