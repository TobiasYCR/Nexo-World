import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { installDomStub, uninstallDomStub, createP5Stub } from './support/domStub.js';
import { FirstPersonCamera } from '../src/camera/FirstPersonCamera.js';
import { GameConfig } from '../src/game/GameConfig.js';
import { SETTINGS_SCHEMA } from '../src/interface/models/SettingsModel.js';

let dom;
let Game;
let GameUiBridge;

beforeEach(async () => {
  dom = installDomStub();
  ({ Game } = await import('../src/game/Game.js'));
  ({ GameUiBridge } = await import('../src/ui/GameUiBridge.js'));
});

afterEach(() => uninstallDomStub());

async function startWithBridge() {
  const game = new Game(createP5Stub());
  await game.start(dom.canvas);
  new GameUiBridge(game, game.hud, game.hud.intentBus);
  return game;
}

test('FOV y sensibilidad se cambian sin tocar la configuración congelada', () => {
  const camera = new FirstPersonCamera(GameConfig.camera);
  assert.doesNotThrow(() => camera.setFov(95));
  assert.equal(camera.fov, 95);
  assert.equal(GameConfig.camera.FOV_DEGREES, 70, 'la configuración base queda igual');

  camera.setSensitivity(2);
  camera.rotate(100, 0);
  assert.ok(Math.abs(camera.yaw - 100 * GameConfig.camera.MOUSE_SENSITIVITY * 2) < 1e-9, 'la sensibilidad es un multiplicador');
});

test('ningún ajuste de la pantalla de Configuración queda deshabilitado', () => {
  const disabled = Object.values(SETTINGS_SCHEMA).filter((setting) => setting.disabled).map((setting) => setting.id);
  assert.deepEqual(disabled, []);
});

test('cada ajuste cambia el sistema que corresponde, al instante', async () => {
  const game = await startWithBridge();
  const model = game.hud.settingsModel;

  model.set('fov', 100);
  assert.equal(game.camera.fov, 100);
  model.set('mouseSensitivity', 1.5);
  assert.equal(game.camera.sensitivityMultiplier, 1.5);
  model.set('masterVolume', 30);
  assert.ok(Math.abs(game.audio.masterVolume - 0.3) < 1e-9);
  model.set('renderDistance', 3);
  assert.equal(game.blockRenderer.renderDistance, 3 * game.world.chunkSizeX);
  model.set('frustumCulling', false);
  assert.equal(game.blockRenderer.frustumCulling, false);
  model.set('greedyMeshing', false);
  assert.equal(game.blockRenderer.greedyMeshing, false);
  model.set('cameraEffects', false);
  assert.equal(game.cameraEffects.enabled, false);
  model.set('damageEffects', false);
  game.damageEffect.trigger(10, 20);
  assert.equal(game.damageEffect.isActive, false, 'sin destello rojo');
  model.set('uiScale', 1.25);
  assert.equal(game.hud.container.style.zoom, '1.25');
});

test('lo guardado se aplica al arrancar', async () => {
  const first = await startWithBridge();
  first.hud.settingsModel.set('fov', 90);
  first.hud.settingsModel.set('renderDistance', 1);
  uninstallDomStub();
  dom = installDomStub();
  // El doble de DOM empieza vacío: se copia lo guardado como si fuera otra visita.
  const second = new Game(createP5Stub());
  second.hud.settingsModel.set('fov', 90);
  second.hud.settingsModel.set('renderDistance', 1);
  await second.start(dom.canvas);
  new GameUiBridge(second, second.hud, second.hud.intentBus);
  assert.equal(second.camera.fov, 90);
  assert.equal(second.blockRenderer.renderDistance, second.world.chunkSizeX);
});
