import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AABB } from '../src/physics/AABB.js';
import { MathUtils } from '../src/utils/MathUtils.js';
import { Vec3, VectorUtils } from '../src/utils/VectorUtils.js';

test('dos cajas separadas no se intersecan y dos superpuestas sí', () => {
  const a = new AABB(0, 0, 0, 10, 10, 10);
  assert.equal(a.intersects(new AABB(20, 0, 0, 30, 10, 10)), false);
  assert.equal(a.intersects(new AABB(5, 5, 5, 15, 15, 15)), true);
});

test('cajas que solo se tocan por una cara no cuentan como colisión', () => {
  const a = new AABB(0, 0, 0, 10, 10, 10);
  assert.equal(a.intersects(new AABB(10, 0, 0, 20, 10, 10)), false);
});

test('fromCenterBase centra en horizontal y apoya en la base', () => {
  const box = AABB.fromCenterBase(100, 50, 100, 12, 34);
  assert.equal(box.minY, 50);
  assert.equal(box.maxY, 84);
  assert.equal(box.width, 12);
  assert.equal(box.depth, 12);
});

test('expandedBy cubre el recorrido completo del movimiento', () => {
  const swept = new AABB(0, 0, 0, 10, 10, 10).expandedBy(-5, 3, 0);
  assert.equal(swept.minX, -5);
  assert.equal(swept.maxY, 13);
});

test('mod es siempre positivo, a diferencia del operador %', () => {
  assert.equal(MathUtils.mod(-1, 16), 15);
  assert.equal(MathUtils.floorDiv(-1, 16), -1);
});

test('el vector de avance es unitario y mira a -Z con yaw 0', () => {
  const forward = VectorUtils.forwardFromYaw(0, new Vec3());
  assert.equal(MathUtils.roundTo(forward.length(), 5), 1);
  assert.equal(MathUtils.roundTo(forward.z, 5), -1);
});
