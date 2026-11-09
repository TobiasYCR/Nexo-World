import { test } from 'node:test';
import assert from 'node:assert/strict';
import { KeyNames } from '../src/chatbot/KeyNames.js';

test('KeyNames traduce los códigos a lo que dice el teclado', () => {
  assert.equal(KeyNames.of('Space'), 'Espacio');
  assert.equal(KeyNames.of('KeyW'), 'W');
  assert.equal(KeyNames.of('Digit3'), '3');
  assert.equal(KeyNames.of('Escape'), 'Esc');
  assert.equal(KeyNames.of('F3'), 'F3');
  assert.deepEqual(KeyNames.list(['ShiftLeft', 'ShiftRight']), ['Shift']);
});
