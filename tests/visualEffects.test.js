import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GameEvents, GameEventTypes } from '../src/game/GameEvents.js';
import { GameConfig } from '../src/game/GameConfig.js';
import { HandAnimator } from '../src/viewmodel/HandAnimator.js';
import { LandingEffect } from '../src/viewmodel/LandingEffect.js';
import { DamageEffect } from '../src/viewmodel/DamageEffect.js';
import { CameraEffects } from '../src/viewmodel/CameraEffects.js';
import { AmbientParticles } from '../src/viewmodel/AmbientParticles.js';
import { BlockParticles } from '../src/viewmodel/BlockParticles.js';
import { VisualEffectsManager } from '../src/viewmodel/VisualEffectsManager.js';

test('HandAnimator mantiene la respiración, el estado de rotura y no acumula offsets', () => {
  const animator = new HandAnimator();
  animator.setSelectedSlot(0);
  animator.update(1 / 60, { isOnGround: true });
  animator.update(1 / 60, { isOnGround: true });
  assert.notEqual(animator.offsetY, 0);

  animator.notifyBlockBroken();
  animator.update(1 / 60, { isBreaking: true, isOnGround: true });
  assert.equal(animator.isBreaking, true);
  assert.ok(animator.offsetZ >= 0);

  animator.update(2, { isBreaking: false, isOnGround: true });
  assert.equal(animator.swingAmount, 0);
  assert.ok(Math.abs(animator.offsetZ) < GameConfig.viewmodel.hand.SWING_DISTANCE);
});

test('LandingEffect ignora impactos insignificantes y termina solo', () => {
  const effect = new LandingEffect();
  assert.equal(effect.trigger(50), false);
  assert.equal(effect.isActive, false);
  assert.equal(effect.trigger(260), true);
  effect.update(0.05);
  assert.ok(effect.handOffset > 0);
  effect.update(1);
  assert.equal(effect.isActive, false);
  assert.equal(effect.handOffset, 0);
});

test('DamageEffect combina golpes sin superar la opacidad y se limpia al reaparecer', () => {
  const effect = new DamageEffect();
  effect.trigger(4, 20);
  const first = effect.opacity;
  effect.trigger(8, 20);
  assert.ok(effect.opacity >= first);
  assert.ok(effect.opacity <= GameConfig.viewmodel.damage.MAX_OPACITY);
  effect.onRespawn();
  assert.equal(effect.opacity, 0);
  assert.equal(effect.isActive, false);
});

test('DamageEffect dibuja el destello como overlay de pantalla', () => {
  const effect = new DamageEffect();
  effect.trigger(4, 20);
  const calls = { ortho: 0, camera: 0, rect: 0 };
  const p = {
    width: 100,
    height: 60,
    push() {},
    clearDepth() {},
    resetMatrix() {},
    ortho() { calls.ortho += 1; },
    camera() { calls.camera += 1; },
    noStroke() {},
    fill() {},
    rectMode() {},
    rect() { calls.rect += 1; },
    pop() {}
  };

  effect.draw(p);

  assert.equal(calls.ortho, 1);
  assert.equal(calls.camera, 1);
  assert.equal(calls.rect, 1);
});

test('CameraEffects expone offsets visuales sin cambiar la cámara lógica', () => {
  const effect = new CameraEffects();
  effect.trigger({ amplitude: 1, duration: 0.2, rotation: 0.01 });
  effect.update(1 / 60);
  assert.notEqual(effect.offsetX + effect.offsetY + effect.offsetZ, 0);
  effect.update(1);
  assert.equal(effect.offsetX, 0);
  assert.equal(effect.yaw, 0);
});

test('AmbientParticles respeta el pool, el bioma y la pausa', () => {
  const ambient = new AmbientParticles({
    ...GameConfig.viewmodel.ambientParticles,
    MAX_PARTICLES: 8,
    SPAWN_RATE: 100,
    DENSITY_FOREST: 1,
    PARTICLE_LIFETIME: 5
  }, { random: () => 0.5 });
  ambient.update(1, { playerPosition: { x: 0, y: 40, z: 0 }, biome: { name: 'Forest' } });
  assert.equal(ambient.activeCount, 8);
  ambient.reset();
  ambient.update(1, { playerPosition: { x: 0, y: 40, z: 0 }, biome: { name: 'Forest' }, paused: true });
  assert.equal(ambient.activeCount, 0);
});

test('BlockParticles reutiliza el pool para colocación y permite reinicio', () => {
  const particles = new BlockParticles({
    ...GameConfig.viewmodel.particles,
    MIN_COUNT: 2,
    MAX_COUNT: 2,
    PLACED_MIN_COUNT: 2,
    PLACED_MAX_COUNT: 2,
    MAX_PARTICLES: 4
  });
  particles.spawnPlacement({ x: 0, y: 0, z: 0 }, [100, 120, 140], { x: 0, y: 1, z: 0 });
  assert.equal(particles.activeCount, 2);
  particles.reset();
  assert.equal(particles.activeCount, 0);
});

test('VisualEffectsManager suscribe una vez y elimina suscripciones', () => {
  const events = new GameEvents();
  let broken = 0;
  const blockParticles = {
    config: GameConfig.viewmodel.particles,
    spawn: () => { broken += 1; },
    spawnPlacement: () => {},
    update: () => {},
    draw: () => {}
  };
  const manager = new VisualEffectsManager({
    events,
    blockParticles,
    handRenderer: { notifyBlockBroken: () => {}, notifyBlockPlaced: () => {}, update: () => {}, draw: () => {} },
    blockHighlight: { update: () => {}, advance: () => {}, draw: () => {} },
    breakOverlay: { update: () => {}, draw: () => {} },
    ambientParticles: { update: () => {}, draw: () => {} },
    damageEffect: { update: () => {}, draw: () => {}, trigger: () => {}, onDeath: () => {}, reset: () => {} },
    landingEffect: { update: () => {}, trigger: () => false, reset: () => {}, handOffset: 0, handCompression: 0 },
    cameraEffects: { update: () => {}, trigger: () => {}, reset: () => {}, config: GameConfig.viewmodel.cameraEffects }
  });
  events.emit(GameEventTypes.BLOCK_BROKEN, { position: { x: 0, y: 0, z: 0 }, blockType: { color: [1, 2, 3] } });
  assert.equal(broken, 1);
  manager.dispose();
  events.emit(GameEventTypes.BLOCK_BROKEN, { position: { x: 0, y: 0, z: 0 }, blockType: { color: [1, 2, 3] } });
  assert.equal(broken, 1);
});
