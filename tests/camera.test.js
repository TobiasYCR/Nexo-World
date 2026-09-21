import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FirstPersonCamera } from '../src/camera/FirstPersonCamera.js';
import { GameConfig } from '../src/game/GameConfig.js';

function captureProjection() {
  const calls = {};
  const p = {
    width: 1600,
    height: 900,
    frustum: (...args) => { calls.frustum = args; },
    camera: (...args) => { calls.camera = args; }
  };
  new FirstPersonCamera(GameConfig.camera).applyTo(p);
  return calls;
}

test('la proyección no invierte Y: bottom y top quedan intercambiados respecto de p5', () => {
  const [left, right, bottom, top, near, far] = captureProjection().frustum;
  assert.ok(bottom > 0 && top < 0, 'con bottom < top p5 espeja la escena verticalmente');
  assert.equal(bottom, -top);
  assert.equal(right, -left);
  assert.equal(near, GameConfig.camera.NEAR_PLANE);
  assert.equal(far, GameConfig.camera.FAR_PLANE);
});

test('el frustum respeta FOV vertical y relación de aspecto', () => {
  const [, right, bottom, , near] = captureProjection().frustum;
  const halfFov = (GameConfig.camera.FOV_DEGREES * Math.PI) / 360;
  assert.ok(Math.abs(bottom - near * Math.tan(halfFov)) < 1e-9);
  assert.ok(Math.abs(right / bottom - 1600 / 900) < 1e-9);
});

test('la vista usa Y hacia arriba como vector up', () => {
  const args = captureProjection().camera;
  assert.deepEqual(args.slice(6), [0, 1, 0]);
});
