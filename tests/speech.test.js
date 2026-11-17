import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SpeechService } from '../src/audio/SpeechService.js';

/** Voces como las que trae Chrome o Edge en Windows. */
const VOICES = [
  { name: 'Microsoft Sabina Desktop - Spanish (Mexico)', lang: 'es-MX', localService: true },
  { name: 'Microsoft Helena Desktop - Spanish (Spain)', lang: 'es-ES', localService: true },
  { name: 'Google español', lang: 'es-ES', localService: false },
  { name: 'Google español de Estados Unidos', lang: 'es-US', localService: false },
  { name: 'Microsoft Elena Online (Natural) - Spanish (Argentina)', lang: 'es-AR', localService: false },
  { name: 'Google US English', lang: 'en-US', localService: false }
];

function speechWith(voices) {
  const listeners = new Set();
  const synth = {
    voices,
    getVoices() { return this.voices; },
    speak() {},
    cancel() {},
    addEventListener(type, listener) { if (type === 'voiceschanged') listeners.add(listener); },
    fire() { for (const listener of listeners) listener(); }
  };
  return { speech: new SpeechService({ synth, UtteranceClass: class {} }), synth };
}

test('elige la voz más natural antes que la del acento: las "Desktop" de Windows quedan últimas', () => {
  const { speech } = speechWith(VOICES);
  const names = speech.spanishVoices().map((voice) => voice.name);
  assert.equal(names[0], 'Microsoft Elena Online (Natural) - Spanish (Argentina)');
  assert.ok(names.indexOf('Google español de Estados Unidos') < names.indexOf('Microsoft Sabina Desktop - Spanish (Mexico)'));
  assert.ok(!names.includes('Google US English'), 'solo voces en español');
  assert.equal(speech.selectSpanishVoice().name, names[0]);

  // En Chrome (sin voces neuronales) gana una de Google, no la de Windows.
  const chrome = speechWith(VOICES.filter((voice) => !voice.name.includes('Natural'))).speech;
  assert.match(chrome.selectSpanishVoice().name, /^Google español/);
});

test('se puede elegir una voz; si no existe en este navegador se usa la automática', () => {
  const { speech } = speechWith(VOICES);
  speech.setPreferredVoice('Google español');
  assert.equal(speech.selectSpanishVoice().name, 'Google español');
  speech.setPreferredVoice('Voz que no existe');
  assert.match(speech.selectSpanishVoice().name, /Natural/);
  speech.setPreferredVoice('');
  assert.match(speech.selectSpanishVoice().name, /Natural/);
});

test('avisa cuando el navegador termina de cargar las voces', () => {
  const { speech, synth } = speechWith([]);
  let calls = 0;
  speech.onVoicesChanged(() => { calls += 1; });
  assert.equal(speech.selectSpanishVoice(), null);
  synth.voices = VOICES;
  synth.fire();
  assert.equal(calls, 1);
  assert.match(speech.selectSpanishVoice().name, /Natural/);
});
