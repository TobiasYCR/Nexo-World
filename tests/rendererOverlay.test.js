import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Renderer } from '../src/rendering/Renderer.js';
import { GameConfig } from '../src/game/GameConfig.js';

test('Renderer dibuja los overlays en orden después del mundo y permite retirarlos', () => {
  const order = [];
  const p = {
    background: () => order.push('background'),
    ambientLight: () => {},
    directionalLight: () => {}
  };
  const camera = {
    position: { x: 0, y: 0, z: 0 },
    applyTo: () => order.push('camera')
  };
  const renderer = new Renderer(p, {
    render: () => order.push('world')
  }, GameConfig.rendering);
  const first = { draw: (_p, receivedCamera) => {
    assert.equal(receivedCamera, camera);
    order.push('first');
  } };
  const second = { draw: () => order.push('second') };
  const removeFirst = renderer.addOverlay(first);
  renderer.addOverlay(second);

  renderer.render({}, camera);
  assert.deepEqual(order, ['background', 'camera', 'world', 'first', 'second']);

  removeFirst();
  order.length = 0;
  renderer.render({}, camera);
  assert.deepEqual(order, ['background', 'camera', 'world', 'second']);
});

test('Renderer rechaza overlays que no implementan draw()', () => {
  const renderer = new Renderer({}, { render() {} });
  assert.throws(() => renderer.addOverlay({}), /draw\(p, camera\)/);
});
