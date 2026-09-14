import { test } from 'node:test';
import assert from 'node:assert/strict';
import { World } from '../src/world/World.js';
import { Raycast } from '../src/physics/Raycast.js';
import { Player } from '../src/player/Player.js';
import { BlockInteraction } from '../src/player/BlockInteraction.js';
import { Hotbar } from '../src/inventory/Hotbar.js';
import { createDefaultBlockRegistry } from '../src/blocks/BlockRegistry.js';
import { GameConfig } from '../src/game/GameConfig.js';
import { BlockIds } from '../src/utils/Constants.js';

function buildScene({ registry = createDefaultBlockRegistry(), playerY = 60, hotbarSize = 9 } = {}) {
  const world = new World(registry, GameConfig);
  const player = new Player();
  player.teleportTo(10, playerY, 10);
  const hotbar = new Hotbar(hotbarSize);
  const raycast = new Raycast(world);
  const interaction = new BlockInteraction(world, player, hotbar, raycast);
  const stone = registry.get(BlockIds.STONE);
  return { world, player, hotbar, interaction, stone };
}

test('romper un bloque rompible lo convierte en aire y entra al hotbar', () => {
  const { world, hotbar, interaction, stone } = buildScene();
  world.setBlockId(2, 0, 2, BlockIds.STONE);

  interaction.update({ x: 10, y: 10, z: 45 }, { x: 1, y: 0, z: 0 });
  assert.equal(interaction.tryBreak(), true);
  assert.equal(world.getBlockId(2, 0, 2), BlockIds.AIR);
  assert.equal(hotbar.countOf(stone), 1);
});

test('romper consulta la propiedad breakable del registro', () => {
  const registry = createDefaultBlockRegistry();
  registry.register({ id: 50, name: 'Bedrock', solid: true, breakable: false });
  const { world, interaction } = buildScene({ registry });
  world.setBlockId(2, 0, 2, 50);

  interaction.update({ x: 10, y: 10, z: 45 }, { x: 1, y: 0, z: 0 });
  assert.equal(interaction.tryBreak(), false);
  assert.equal(world.getBlockId(2, 0, 2), 50);
});

test('colocar un bloque en la celda libre adyacente a la cara apuntada', () => {
  const { world, hotbar, interaction, stone } = buildScene();
  world.setBlockId(0, 0, 0, BlockIds.STONE);
  hotbar.add(stone, 5);
  hotbar.select(0);

  interaction.update({ x: 10, y: 25, z: 10 }, { x: 0, y: -1, z: 0 });
  assert.equal(interaction.tryPlace(), true);
  assert.equal(world.getBlockId(0, 1, 0), BlockIds.STONE);
  assert.equal(hotbar.countOf(stone), 4, 'consumió un bloque del hotbar');
});

test('colocar en la celda que ocupa la caja del jugador se rechaza', () => {
  const { world, hotbar, interaction, stone } = buildScene({ playerY: 25 });
  world.setBlockId(0, 0, 0, BlockIds.STONE); // piso cuyo vecino superior es la celda del jugador
  hotbar.add(stone, 5);
  hotbar.select(0);

  interaction.update({ x: 10, y: 25, z: 10 }, { x: 0, y: -1, z: 0 });
  assert.equal(interaction.tryPlace(), false);
  assert.equal(world.getBlockId(0, 1, 0), BlockIds.AIR);
  assert.equal(hotbar.countOf(stone), 5, 'no debe consumir bloques');
});

test('colocar en una celda ocupada se rechaza', () => {
  const { world, hotbar, interaction, stone } = buildScene();
  world.setBlockId(0, 0, 0, BlockIds.STONE);
  world.setBlockId(0, 1, 0, BlockIds.DIRT); // destino ya ocupado
  hotbar.add(stone, 5);
  hotbar.select(0);

  interaction.update({ x: 10, y: 25, z: 10 }, { x: 0, y: -1, z: 0 });
  assert.equal(interaction.tryPlace(), false);
  assert.equal(hotbar.countOf(stone), 5);
});

test('colocar fuera de los límites del mundo se rechaza', () => {
  const { world, hotbar, interaction, stone } = buildScene();
  world.setBlockId(0, 0, 0, BlockIds.STONE);
  hotbar.add(stone, 5);
  hotbar.select(0);

  // Rayo desde fuera del mundo contra la cara oeste: la adyacente cae en x = -1.
  interaction.update({ x: -10, y: 10, z: 10 }, { x: 1, y: 0, z: 0 });
  assert.equal(interaction.tryPlace(), false);
  assert.equal(hotbar.countOf(stone), 5);
});

test('colocar sin bloque seleccionado se rechaza', () => {
  const { world, interaction } = buildScene();
  world.setBlockId(0, 0, 0, BlockIds.STONE);

  interaction.update({ x: 10, y: 25, z: 10 }, { x: 0, y: -1, z: 0 });
  assert.equal(interaction.tryPlace(), false);
  assert.equal(world.getBlockId(0, 1, 0), BlockIds.AIR);
});

test('sin nada entre la mira y el cielo, romper no hace nada', () => {
  const { world, interaction } = buildScene();
  interaction.update({ x: 10, y: 200, z: 10 }, { x: 0, y: 1, z: 0 });
  assert.equal(interaction.tryBreak(), false);
  assert.equal(interaction.targetedBlock, null);
});