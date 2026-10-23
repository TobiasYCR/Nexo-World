import { test } from 'node:test';
import assert from 'node:assert/strict';
import { HandRenderer } from '../src/viewmodel/HandRenderer.js';
import { createDefaultBlockRegistry } from '../src/blocks/BlockRegistry.js';
import { BlockIds } from '../src/utils/Constants.js';

/** Doble mínimo de p5 para ejercer draw() sin depender de domStub (que no tiene noFill/stroke/clearDepth). */
function createHandP5Stub() {
  const calls = { box: 0, texture: 0, fill: 0, translations: [] };
  const noop = () => {};
  return {
    width: 1280,
    height: 720,
    calls,
    push: noop,
    pop: noop,
    clearDepth: noop,
    frustum: noop,
    camera: noop,
    translate: (...coordinates) => { calls.translations.push(coordinates); },
    noStroke: noop,
    rotateZ: noop,
    fill: () => { calls.fill += 1; },
    ambientMaterial: noop,
    texture: () => { calls.texture += 1; },
    box: () => { calls.box += 1; }
  };
}

function fakeTextureManager() {
  return { get: () => null };
}

test('sin swing activo, swingAmount es cero', () => {
  const hand = new HandRenderer(fakeTextureManager());
  hand.update(1 / 60, {});
  assert.equal(hand.swingAmount, 0);
});

test('la curva de swing arranca en cero, tiene un pico y vuelve a cero', () => {
  const hand = new HandRenderer(fakeTextureManager());
  hand.notifyBlockBroken();

  assert.equal(hand.swingAmount, 0, 'arranca en cero');

  const duration = hand.config.SWING_DURATION;
  const step = duration / 20;
  let peak = 0;
  for (let t = 0; t < duration; t += step) {
    hand.update(step, {});
    peak = Math.max(peak, hand.swingAmount);
  }
  assert.ok(peak > 0.9, `debería haber un pico cercano a 1, fue ${peak}`);

  // Un paso más ya con el swing apagado: se mantiene en cero.
  hand.update(step, {});
  assert.equal(hand.swingAmount, 0, 'termina en cero');
});

test('mientras se mantiene apretada la rotura, el swing repite el pico en cada ciclo', () => {
  const hand = new HandRenderer(fakeTextureManager());
  const duration = hand.config.SWING_DURATION;
  const step = duration / 20;

  function peakOverOneCycle() {
    let peak = 0;
    for (let t = 0; t < duration; t += step) {
      hand.update(step, { isBreaking: true });
      peak = Math.max(peak, hand.swingAmount);
    }
    return peak;
  }

  const firstCyclePeak = peakOverOneCycle();
  const secondCyclePeak = peakOverOneCycle();

  assert.ok(firstCyclePeak > 0.9, `primer ciclo: pico esperado cerca de 1, fue ${firstCyclePeak}`);
  assert.ok(secondCyclePeak > 0.9, `segundo ciclo: pico esperado cerca de 1, fue ${secondCyclePeak}`);
});

test('cambiar de slot dispara la animación de bajar/subir', () => {
  const hand = new HandRenderer(fakeTextureManager());
  hand.setSelectedSlot(0, null);
  assert.equal(hand.slotChangeAmount, 0, 'el primer slot no dispara animación');

  hand.setSelectedSlot(1, null);
  assert.ok(hand.slotChangeAmount >= 0, 'arranca la animación');

  const duration = hand.config.SLOT_CHANGE_DURATION;
  hand.update(duration / 2, {});
  assert.ok(hand.slotChangeAmount > 0, 'a mitad de camino ya se movió');

  hand.update(duration, {});
  assert.equal(hand.slotChangeAmount, 0, 'termina en cero');
});

test('dibuja un brazo cuando la ranura está vacía, sin lanzar excepciones', () => {
  const hand = new HandRenderer(fakeTextureManager());
  const p = createHandP5Stub();
  hand.setSelectedSlot(0, null);
  hand.update(1 / 60, {});
  hand.draw(p);
  assert.equal(p.calls.box, 1);
});

test('dibuja el bloque de la ranura activa con su color de respaldo', () => {
  const hand = new HandRenderer(fakeTextureManager());
  const p = createHandP5Stub();
  const stone = createDefaultBlockRegistry().get(BlockIds.STONE);
  hand.setSelectedSlot(0, stone);
  hand.update(1 / 60, {});
  hand.draw(p);
  assert.equal(p.calls.box, 1);
  assert.equal(p.calls.fill, 1, 'sin textura cargada, debe usar el color de respaldo');
});

test('muestra un pico mientras se mina y vuelve al bloque seleccionado al soltar', () => {
  const hand = new HandRenderer(fakeTextureManager());
  const p = createHandP5Stub();
  const stone = createDefaultBlockRegistry().get(BlockIds.STONE);
  hand.setSelectedSlot(0, stone);

  hand.update(1 / 60, { isBreaking: true });
  hand.draw(p);
  assert.equal(p.calls.box, 3, 'dibuja brazo, mango y cabeza del pico');

  p.calls.box = 0;
  hand.update(1 / 60, { isBreaking: false });
  hand.draw(p);
  assert.equal(p.calls.box, 1, 'vuelve a dibujar solo el bloque seleccionado');
});

test('el pico queda visible durante el swing final de rotura', () => {
  const hand = new HandRenderer(fakeTextureManager());
  const p = createHandP5Stub();
  hand.setSelectedSlot(0, createDefaultBlockRegistry().get(BlockIds.STONE));
  hand.notifyBlockBroken();

  hand.update(1 / 60, { isBreaking: false });
  hand.draw(p);
  assert.equal(p.calls.box, 3, 'el swing de rotura conserva el pico visible');
});

test('la cabeza del pico queda ubicada en el extremo del mango', () => {
  const hand = new HandRenderer(fakeTextureManager());
  const p = createHandP5Stub();
  hand.setSelectedSlot(0, createDefaultBlockRegistry().get(BlockIds.STONE));
  hand.update(1 / 60, { isBreaking: true });
  hand.draw(p);

  assert.ok(
    p.calls.translations.some((coordinates) => (
      coordinates[0] === 0 &&
      coordinates[1] === hand.config.PICKAXE.HANDLE_LENGTH / 2 &&
      coordinates[2] === 0
    )),
    'la cabeza se dibuja en la punta del eje longitudinal del mango'
  );
});

test('el primer frame conserva el swing aunque deltaTime exceda su duración', () => {
  const hand = new HandRenderer(fakeTextureManager());
  const p = createHandP5Stub();
  hand.setSelectedSlot(0, createDefaultBlockRegistry().get(BlockIds.STONE));
  hand.notifyBlockBroken();

  hand.update(hand.config.SWING_DURATION * 2, { isBreaking: false });
  hand.draw(p);
  assert.equal(p.calls.box, 3, 'el primer frame debe conservar brazo y pico');
  assert.equal(hand.swingAmount, 0, 'el swing empieza en cero');

  p.calls.box = 0;
  hand.update(1 / 60, { isBreaking: false });
  hand.draw(p);
  assert.equal(p.calls.box, 3, 'el siguiente frame avanza el swing normalmente');

  p.calls.box = 0;
  hand.update(hand.config.SWING_DURATION, { isBreaking: false });
  hand.draw(p);
  assert.equal(p.calls.box, 1, 'el swing finalizado vuelve a mostrar el bloque');
});
