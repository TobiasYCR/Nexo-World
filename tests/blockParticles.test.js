import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BlockParticles } from '../src/viewmodel/BlockParticles.js';

const POSITION = { x: 10, y: 20, z: 30 };
const COLOR = [106, 170, 80];

test('spawn genera entre 12 y 16 partículas', () => {
  const particles = new BlockParticles({
    MIN_COUNT: 12,
    MAX_COUNT: 16,
    LIFETIME_SECONDS: 0.6,
    GRAVITY: -260,
    SIZE: 2.5,
    INITIAL_SPEED: 55,
    MAX_PARTICLES: 64
  });

  particles.spawn(POSITION, COLOR);
  assert.ok(particles.activeCount >= 12 && particles.activeCount <= 16, `activeCount fue ${particles.activeCount}`);
});

test('el pool nunca supera MAX_PARTICLES aunque se pidan más', () => {
  const particles = new BlockParticles({
    MIN_COUNT: 16,
    MAX_COUNT: 16,
    LIFETIME_SECONDS: 10,
    GRAVITY: -260,
    SIZE: 2.5,
    INITIAL_SPEED: 55,
    MAX_PARTICLES: 20
  });

  for (let i = 0; i < 5; i += 1) particles.spawn(POSITION, COLOR);
  assert.equal(particles.activeCount, 20);
  assert.equal(particles.poolSize, 20);
});

test('con el pool lleno, una nueva tanda recicla las partículas más viejas', () => {
  const particles = new BlockParticles({
    MIN_COUNT: 4,
    MAX_COUNT: 4,
    LIFETIME_SECONDS: 10,
    GRAVITY: 0,
    SIZE: 2.5,
    INITIAL_SPEED: 0,
    MAX_PARTICLES: 4
  });

  particles.spawn({ x: 0, y: 0, z: 0 }, COLOR);
  particles.spawn({ x: 100, y: 100, z: 100 }, COLOR);

  assert.equal(particles.activeCount, 4, 'sigue habiendo como máximo 4 activas');
  assert.ok(
    particles.activeParticles.every(({ x, y, z }) => x === 100 && y === 100 && z === 100),
    'las partículas más antiguas fueron reemplazadas por la última tanda'
  );
});

test('no crea objetos nuevos por frame: update() solo muta el pool existente', () => {
  const particles = new BlockParticles({
    MIN_COUNT: 12,
    MAX_COUNT: 16,
    LIFETIME_SECONDS: 0.6,
    GRAVITY: -260,
    SIZE: 2.5,
    INITIAL_SPEED: 55,
    MAX_PARTICLES: 64
  });
  particles.spawn(POSITION, COLOR);

  const originalRefs = particles.poolSize;
  for (let i = 0; i < 30; i += 1) particles.update(1 / 60);
  assert.equal(particles.poolSize, originalRefs, 'el tamaño del pool no cambia con el tiempo');
});

test('la gravedad tira las partículas hacia abajo con el tiempo', () => {
  const particles = new BlockParticles({
    MIN_COUNT: 1,
    MAX_COUNT: 1,
    LIFETIME_SECONDS: 5,
    GRAVITY: -260,
    SIZE: 2.5,
    INITIAL_SPEED: 0,
    MAX_PARTICLES: 4
  });
  particles.spawn(POSITION, COLOR);

  for (let i = 0; i < 30; i += 1) particles.update(1 / 60);

  const [particle] = particles.activeParticles;
  assert.ok(particle.y < POSITION.y, `debería haber bajado, y=${particle.y}`);
  assert.ok(particle.vy < 0, 'la velocidad vertical debería ser negativa');
});

test('las partículas se desactivan al agotar su vida', () => {
  const particles = new BlockParticles({
    MIN_COUNT: 1,
    MAX_COUNT: 1,
    LIFETIME_SECONDS: 0.1,
    GRAVITY: 0,
    SIZE: 2.5,
    INITIAL_SPEED: 0,
    MAX_PARTICLES: 4
  });
  particles.spawn(POSITION, COLOR);
  assert.equal(particles.activeCount, 1);

  particles.update(0.2);
  assert.equal(particles.activeCount, 0);
});

test('draw no lanza excepciones con partículas activas', () => {
  const particles = new BlockParticles({
    MIN_COUNT: 4,
    MAX_COUNT: 4,
    LIFETIME_SECONDS: 1,
    GRAVITY: -260,
    SIZE: 2.5,
    INITIAL_SPEED: 30,
    MAX_PARTICLES: 8
  });
  particles.spawn(POSITION, COLOR);

  const calls = { box: 0 };
  const noop = () => {};
  const p = { push: noop, pop: noop, noStroke: noop, translate: noop, fill: noop, ambientMaterial: noop, box: () => { calls.box += 1; } };
  particles.draw(p);
  assert.equal(calls.box, 4);
});
