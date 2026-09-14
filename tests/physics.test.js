import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AABB } from '../src/physics/AABB.js';
import { CollisionSystem } from '../src/physics/CollisionSystem.js';
import { World } from '../src/world/World.js';
import { createDefaultBlockRegistry } from '../src/blocks/BlockRegistry.js';
import { Player } from '../src/player/Player.js';
import { PlayerPhysics } from '../src/player/PlayerPhysics.js';
import { GameConfig } from '../src/game/GameConfig.js';
import { BlockIds } from '../src/utils/Constants.js';
import { MathUtils } from '../src/utils/MathUtils.js';
import { Vec3, VectorUtils } from '../src/utils/VectorUtils.js';

function buildWorld(spec) {
  const world = new World(createDefaultBlockRegistry(), GameConfig);
  for (const [x, y, z, id] of spec) world.setBlockId(x, y, z, id);
  return world;
}

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

test('resolveMovement recorta cada eje contra la primera cara sólida', () => {
  const world = buildWorld([[1, 0, 0, BlockIds.STONE]]);
  const collision = new CollisionSystem(world);
  const box = new AABB(0, 0, 5, 12, 34, 17);

  const result = collision.resolveMovement(box, 200, 0, 0, 0.05);

  assert.equal(result.collided.x, true);
  assert.ok(result.moved.x > 0 && result.moved.x < 200);
  assert.equal(collision.isColliding(box), false, 'la caja queda apoyada, no clavada');
});

test('en diagonal contra una pared se desliza en vez de trabarse', () => {
  const world = buildWorld([[1, 0, 0, BlockIds.STONE]]);
  const collision = new CollisionSystem(world);
  const box = new AABB(0, 0, 5, 12, 34, 17);

  const result = collision.resolveMovement(box, 200, 0, 200, 0.05);

  assert.equal(result.collided.x, true, 'el eje perpendicular choca');
  assert.equal(result.collided.z, false, 'el eje paralelo sigue libre');
  assert.equal(result.moved.z, 200, 'el componente paralelo avanza completo');
  assert.ok(result.moved.x < 200, 'el componente contra la pared se recorta');
  assert.equal(collision.isColliding(box), false);
});

test('el jugador cae y frena apoyado en el terreno, sin hundirse ni vibrar', () => {
  const world = buildWorld([[0, 0, 0, BlockIds.STONE]]);
  const collision = new CollisionSystem(world);
  const player = new Player();
  player.position.set(10, 80, 10);

  const physics = new PlayerPhysics(player, collision);
  for (let i = 0; i < 240; i += 1) physics.update(1 / 60);

  assert.equal(player.isOnGround, true);
  const expectedFeet = GameConfig.world.BLOCK_SIZE + GameConfig.player.COLLISION_SKIN;
  assert.ok(Math.abs(player.position.y - expectedFeet) < 0.01, `quedó en y=${player.position.y}`);

  const stableY = player.position.y;
  physics.update(1 / 60);
  assert.ok(Math.abs(player.position.y - stableY) < 0.01, 'no debe vibrar sobre el suelo');
});

test('el jugador sube un desnivel de un bloque sin saltar', () => {
  const world = buildWorld([
    [0, 0, 0, BlockIds.STONE],
    [0, 0, 1, BlockIds.STONE],
    [0, 1, 1, BlockIds.STONE]
  ]);
  const collision = new CollisionSystem(world);
  const player = new Player();
  player.position.set(10, 20.05, 10);
  player.isOnGround = true;
  player.moveIntent.set(0, 0, 1);

  const physics = new PlayerPhysics(player, collision);
  const beforeZ = player.position.z;
  physics.update(0.1);

  const stepTop = 2 * GameConfig.world.BLOCK_SIZE + GameConfig.player.COLLISION_SKIN;
  assert.ok(Math.abs(player.position.y - stepTop) < 0.01, `debería coronar el escalón (${player.position.y})`);
  assert.ok(player.position.z > beforeZ + 10, 'debería haber avanzado hacia el escalón');
  assert.equal(player.isOnGround, true);
});

test('contra un desnivel de dos bloques frena y no trepa el muro', () => {
  const world = buildWorld([
    [0, 0, 0, BlockIds.STONE],
    [0, 0, 1, BlockIds.STONE],
    [0, 1, 1, BlockIds.STONE],
    [0, 2, 1, BlockIds.STONE]
  ]);
  const collision = new CollisionSystem(world);
  const player = new Player();
  player.position.set(10, 20.05, 10);
  player.isOnGround = true;
  player.moveIntent.set(0, 0, 1);

  const physics = new PlayerPhysics(player, collision);
  physics.update(0.1);

  const groundTop = GameConfig.world.BLOCK_SIZE + GameConfig.player.COLLISION_SKIN;
  assert.ok(Math.abs(player.position.y - groundTop) < 0.01, `no debe escalar el muro (y=${player.position.y})`);
});

test('el salto exige suelo y mantener la tecla no vuelve a saltar en el aire', () => {
  const world = buildWorld([[0, 0, 0, BlockIds.STONE]]);
  const collision = new CollisionSystem(world);
  const player = new Player();
  player.position.set(10, 20.05, 10);
  player.isOnGround = true;

  const physics = new PlayerPhysics(player, collision);
  player.wantsToJump = true;
  physics.update(1 / 60);

  assert.ok(player.velocity.y > 0, 'debe despegar');
  assert.equal(player.isOnGround, false, 'en el aire pierde el apoyo');

  const upward = player.velocity.y;
  player.wantsToJump = true; // tecla mantenida
  physics.update(1 / 60);

  assert.ok(player.velocity.y < upward, 'mantener la tecla no debe volver a despegar');
});
