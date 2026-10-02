import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ViewBob } from '../src/viewmodel/ViewBob.js';

test('el balanceo es cero cuando el jugador está quieto', () => {
  const bob = new ViewBob();
  bob.update(1 / 60, 0, true);
  assert.equal(bob.offsetX, 0);
  assert.equal(bob.offsetY, 0);
});

test('el balanceo es cero en el aire aunque haya velocidad horizontal', () => {
  const bob = new ViewBob();
  bob.update(1 / 60, 120, false);
  assert.equal(bob.offsetX, 0);
  assert.equal(bob.offsetY, 0);
});

test('caminando en el suelo el balanceo deja de ser cero', () => {
  const bob = new ViewBob();
  for (let i = 0; i < 10; i += 1) bob.update(1 / 60, 120, true);
  assert.notEqual(bob.offsetY, 0);
});

test('el balanceo vuelve a cero apenas se despega del suelo', () => {
  const bob = new ViewBob();
  for (let i = 0; i < 10; i += 1) bob.update(1 / 60, 120, true);
  assert.notEqual(bob.offsetY, 0, 'precondición: venía balanceándose');

  bob.update(1 / 60, 120, false);
  assert.equal(bob.offsetX, 0);
  assert.equal(bob.offsetY, 0);
});
