import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BreakOverlay } from '../src/viewmodel/BreakOverlay.js';

function fakeP5() {
  const calls = { box: 0, fill: 0, texture: 0 };
  const noop = () => {};
  return {
    calls,
    push: noop,
    pop: noop,
    noStroke: noop,
    translate: noop,
    fill: () => { calls.fill += 1; },
    texture: () => { calls.texture += 1; },
    box: () => { calls.box += 1; },
    // Sin loadImage: BreakOverlay debe seguir funcionando con el respaldo oscurecido.
    loadImage: undefined
  };
}

test('sin bloque en rotura, no dibuja nada', () => {
  const overlay = new BreakOverlay(fakeP5());
  overlay.update(null, 0);
  const p = fakeP5();
  overlay.draw(p);
  assert.equal(p.calls.box, 0);
});

test('la etapa de grieta avanza con el progreso, de 0 a 9', () => {
  const overlay = new BreakOverlay(fakeP5());
  const block = { x: 1, y: 2, z: 3 };

  overlay.update(block, 0);
  assert.equal(overlay.stage, 0);

  overlay.update(block, 0.35);
  assert.equal(overlay.stage, 3);

  overlay.update(block, 0.95);
  assert.equal(overlay.stage, 9);

  // Progreso >= 1 no debe salirse del rango de etapas válidas.
  overlay.update(block, 1);
  assert.equal(overlay.stage, 9);
});

test('sin textura cargada, dibuja el respaldo oscurecido sin lanzar excepciones', () => {
  const overlay = new BreakOverlay(fakeP5());
  const p = fakeP5();
  overlay.update({ x: 0, y: 0, z: 0 }, 0.5);
  overlay.draw(p);
  assert.equal(p.calls.box, 1);
  assert.equal(p.calls.fill, 1);
});
