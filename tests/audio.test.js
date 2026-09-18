import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AudioManager } from '../src/audio/AudioManager.js';
import { SoundIds, AudioCategories } from '../src/utils/Constants.js';

const ASSETS = { TEXTURE_BASE_PATH: '/textures/blocks/', AUDIO_BASE_PATH: '/audio/' };

class FakeNode {
  constructor(label) {
    this.label = label;
    this.outputs = [];
  }

  connect(target) {
    this.outputs.push(target);
    return target;
  }

  disconnect() {
    this.outputs = [];
  }
}

class FakeGain extends FakeNode {
  constructor() {
    super('gain');
    this.gain = { value: 1 };
  }
}

class FakeSource extends FakeNode {
  constructor() {
    super('source');
    this.started = false;
  }

  start() {
    this.started = true;
  }
}

class FakeAudioContext {
  constructor({ failDecode = false } = {}) {
    this.state = 'suspended';
    this.destination = new FakeNode('destination');
    this.failDecode = failDecode;
    this.decoded = [];
  }

  async resume() {
    this.state = 'running';
  }

  createGain() {
    return new FakeGain();
  }

  createBufferSource() {
    return new FakeSource();
  }

  async decodeAudioData(bytes) {
    if (this.failDecode) throw new Error('formato inválido');
    this.decoded.push(bytes.byteLength);
    return { duration: 0.1 };
  }
}

/** fetch falso: `files` lista las URLs que existen. */
function fakeFetch(files) {
  const requested = [];
  const fetch = async (url) => {
    requested.push(url);
    if (!files.has(url)) return { ok: false, status: 404 };
    return { ok: true, arrayBuffer: async () => new ArrayBuffer(8) };
  };
  return { fetch, requested };
}

const ALL_FILES = new Set(['/audio/sfx/block_place.wav', '/audio/sfx/block_break.wav']);

function build({ files = ALL_FILES, context = new FakeAudioContext() } = {}) {
  const { fetch, requested } = fakeFetch(files);
  const contexts = [];
  const audio = new AudioManager(ASSETS, {
    fetch,
    createContext: () => {
      contexts.push(context);
      return context;
    }
  });
  return { audio, requested, contexts, context };
}

/** Recorre la cadena de salidas desde un nodo hasta el destino. */
function routeOf(node) {
  const route = [];
  let current = node;
  while (current) {
    route.push(current.label);
    current = current.outputs[0];
  }
  return route;
}

test('preload descarga los bytes sin crear el AudioContext', async () => {
  const { audio, requested, contexts } = build();
  const result = await audio.preload();

  assert.deepEqual(requested.sort(), ['/audio/sfx/block_break.wav', '/audio/sfx/block_place.wav']);
  assert.equal(contexts.length, 0, 'el contexto necesita un gesto del usuario');
  assert.equal(result.missing.length, 0);
  assert.equal(audio.play(SoundIds.BLOCK_PLACE), null, 'sin unlock no suena');
});

test('unlock decodifica lo precargado sin volver a descargar', async () => {
  const { audio, requested, context } = build();
  await audio.preload();
  assert.equal(await audio.unlock(), true);

  assert.equal(requested.length, 2);
  assert.equal(context.decoded.length, 2);
  assert.equal(audio.isLoaded(SoundIds.BLOCK_BREAK), true);
});

test('unlock sin preload previo descarga el catálogo igual', async () => {
  const { audio, requested } = build();
  await audio.unlock();
  assert.equal(requested.length, 2);
  assert.equal(audio.isLoaded(SoundIds.BLOCK_PLACE), true);
});

test('unlock es idempotente: un solo contexto', async () => {
  const { audio, contexts } = build();
  await Promise.all([audio.unlock(), audio.unlock()]);
  await audio.unlock();
  assert.equal(contexts.length, 1);
});

test('play rutea voz -> categoría -> maestro -> salida', async () => {
  const { audio } = build();
  await audio.unlock();
  const source = audio.play(SoundIds.BLOCK_PLACE, { volume: 0.5 });

  assert.ok(source.started);
  assert.deepEqual(routeOf(source), ['source', 'gain', 'gain', 'gain', 'destination']);
  assert.equal(source.outputs[0].gain.value, 0.5);
});

test('los volúmenes se aplican antes y después del unlock', async () => {
  const { audio } = build();
  audio.setMasterVolume(0.3);
  audio.setCategoryVolume(AudioCategories.SFX, 0.5);
  await audio.unlock();

  const source = audio.play(SoundIds.BLOCK_BREAK);
  const [voice, category, master] = [source.outputs[0], source.outputs[0].outputs[0], source.outputs[0].outputs[0].outputs[0]];
  assert.equal(voice.gain.value, 1);
  assert.equal(category.gain.value, 0.5);
  assert.equal(master.gain.value, 0.3);

  audio.setMasterVolume(0.8);
  assert.equal(master.gain.value, 0.8);
});

test('los volúmenes se acotan a [0, 1] y las categorías desconocidas se rechazan', () => {
  const { audio } = build();
  assert.equal(audio.setMasterVolume(2), 1);
  assert.equal(audio.setMasterVolume(-1), 0);
  assert.equal(audio.setMasterVolume(Number.NaN), 0);
  assert.equal(audio.setCategoryVolume('voces', 0.5), false);
  assert.equal(audio.getCategoryVolume('voces'), null);
});

test('un archivo ausente deja ese sonido mudo sin lanzar', async (t) => {
  t.mock.method(console, 'warn', () => {});
  const { audio } = build({ files: new Set(['/audio/sfx/block_place.wav']) });
  const result = await audio.preload();
  await audio.unlock();

  assert.deepEqual(result.missing, [SoundIds.BLOCK_BREAK]);
  assert.equal(audio.play(SoundIds.BLOCK_BREAK), null);
  assert.ok(audio.play(SoundIds.BLOCK_PLACE));
});

test('un archivo indecodificable también queda mudo', async (t) => {
  t.mock.method(console, 'warn', () => {});
  const { audio } = build({ context: new FakeAudioContext({ failDecode: true }) });
  assert.equal(await audio.unlock(), true);
  assert.equal(audio.play(SoundIds.BLOCK_PLACE), null);
});

test('sin Web Audio ni fetch ningún método lanza', async (t) => {
  t.mock.method(console, 'warn', () => {});
  const audio = new AudioManager(ASSETS, { fetch: null, createContext: () => null });
  const preloaded = await audio.preload();
  assert.equal(preloaded.downloaded.length, 0);
  assert.equal(await audio.unlock(), false);
  assert.equal(audio.play(SoundIds.BLOCK_PLACE), null);
  assert.equal(audio.play('inexistente'), null);
});

test('si crear el contexto lanza, unlock resuelve false', async () => {
  const audio = new AudioManager(ASSETS, {
    fetch: null,
    createContext: () => { throw new Error('no permitido'); }
  });
  assert.equal(await audio.unlock(), false);
});
