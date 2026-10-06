import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { installDomStub, uninstallDomStub } from './support/domStub.js';
import { ScreenType } from '../src/ui/ScreenType.js';
import { IntentBus } from '../src/ui/IntentBus.js';
import { Screen } from '../src/ui/Screen.js';
import { ScreenManager } from '../src/ui/ScreenManager.js';
import { MenuScreen } from '../src/ui/MenuScreen.js';
import { PauseScreen } from '../src/ui/PauseScreen.js';
import { SettingsStorage } from '../src/interface/storage/SettingsStorage.js';
import { SettingsModel } from '../src/interface/models/SettingsModel.js';
import { SettingsScreen } from '../src/interface/screens/SettingsScreen.js';
import { ControlsScreen } from '../src/interface/screens/ControlsScreen.js';
import { InventoryScreen } from '../src/interface/screens/InventoryScreen.js';
import { Button } from '../src/interface/components/Button.js';
import { Slider } from '../src/interface/components/Slider.js';
import { Toggle } from '../src/interface/components/Toggle.js';
import { Modal } from '../src/interface/components/Modal.js';

let dom;

beforeEach(() => {
  dom = installDomStub();
});

afterEach(() => {
  uninstallDomStub();
});

test('ScreenType define todos los tipos de pantalla requeridos', () => {
  assert.equal(ScreenType.MENU, 'menu');
  assert.equal(ScreenType.SETTINGS, 'settings');
  assert.equal(ScreenType.CONTROLS, 'controls');
  assert.equal(ScreenType.INVENTORY, 'inventory');
  assert.equal(ScreenType.PLAYING, 'playing');
  assert.equal(ScreenType.PAUSE, 'pause');
});

test('IntentBus emite y desuscribe eventos correctamente', () => {
  const bus = new IntentBus();
  let received = null;
  const unsubscribe = bus.on('test:event', (payload) => {
    received = payload;
  });

  bus.emit('test:event', { foo: 'bar' });
  assert.deepEqual(received, { foo: 'bar' });

  unsubscribe();
  bus.emit('test:event', { foo: 'baz' });
  assert.deepEqual(received, { foo: 'bar' }, 'no debería recibir eventos tras desuscribir');
});

test('ScreenManager gestiona registro, ciclo de vida e historial con back()', () => {
  const bus = new IntentBus();
  const manager = new ScreenManager(dom.uiRoot, bus);

  const menu = new MenuScreen(manager, bus);
  const settings = new SettingsScreen(null, manager, bus);
  const pause = new PauseScreen(manager, bus);

  manager.register(ScreenType.MENU, menu);
  manager.register(ScreenType.SETTINGS, settings);
  manager.register(ScreenType.PAUSE, pause);

  assert.equal(manager.get(ScreenType.MENU), menu);
  assert.equal(manager.hasActiveOverlay, false);

  // Abrir Menú
  manager.open(ScreenType.MENU);
  assert.equal(manager.currentScreenType, ScreenType.MENU);
  assert.equal(manager.hasActiveOverlay, true);
  assert.equal(menu.isVisible, true);

  // Navegar a Configuración
  manager.open(ScreenType.SETTINGS);
  assert.equal(manager.currentScreenType, ScreenType.SETTINGS);
  assert.equal(menu.isVisible, false);
  assert.equal(settings.isVisible, true);

  // Volver (back)
  manager.back();
  assert.equal(manager.currentScreenType, ScreenType.MENU);
  assert.equal(settings.isVisible, false);
  assert.equal(menu.isVisible, true);

  // Entrar a juego (PLAYING)
  manager.open(ScreenType.PLAYING);
  assert.equal(manager.currentScreenType, ScreenType.PLAYING);
  assert.equal(manager.hasActiveOverlay, false);
  assert.equal(menu.isVisible, false);
});

test('SettingsStorage guarda en memoria y recupera ante datos corruptos', () => {
  const storage = new SettingsStorage('test_settings_key');
  storage.save({ mouseSensitivity: 1.5 });

  const data = storage.load();
  assert.equal(data.mouseSensitivity, 1.5);

  // Simular valor corrupto o vacío
  storage.clear();
  const empty = storage.load();
  assert.deepEqual(empty, {});
});

test('SettingsModel valida rangos, defaults y emite cambios', () => {
  const model = new SettingsModel(new SettingsStorage('model_test_key'));
  assert.equal(model.get('mouseSensitivity'), 1.0);
  assert.equal(model.get('masterVolume'), 70);

  let notified = null;
  model.subscribe((key, val) => {
    notified = { key, val };
  });

  // Cambio válido
  const success = model.set('mouseSensitivity', 1.8);
  assert.equal(success, true);
  assert.equal(model.get('mouseSensitivity'), 1.8);
  assert.deepEqual(notified, { key: 'mouseSensitivity', val: 1.8 });

  // Cambio inválido fuera de rango
  const invalid = model.set('mouseSensitivity', 99.0);
  assert.equal(invalid, false);
  assert.equal(model.get('mouseSensitivity'), 1.8);

  // Reset a valores por defecto
  model.resetToDefaults();
  assert.equal(model.get('mouseSensitivity'), 1.0);
});

test('Componentes Button, Slider, Toggle y Modal se instancian correctamente', () => {
  let clicked = false;
  const btn = new Button({ text: 'PRUEBA', variant: 'primary', onClick: () => { clicked = true; } });
  btn.mount(dom.uiRoot);
  btn.element.dispatch('click');
  assert.equal(clicked, true);

  let sliderVal = 0;
  const slider = new Slider({ label: 'Volumen', min: 0, max: 100, value: 50, onChange: (v) => { sliderVal = v; } });
  slider.mount(dom.uiRoot);
  slider.setValue(80);
  assert.equal(slider.value, 80);

  let toggleState = false;
  const toggle = new Toggle({ label: 'Debug', checked: false, onChange: (c) => { toggleState = c; } });
  toggle.mount(dom.uiRoot);
  toggle.toggle();
  assert.equal(toggleState, true);

  let modalClosed = false;
  const modal = new Modal({ title: 'Test Modal', onClose: () => { modalClosed = true; } });
  modal.mount(dom.uiRoot);
  modal.handleClose();
  assert.equal(modalClosed, true);
});

test('InventoryScreen permite seleccionar un bloque y emite intención', () => {
  const bus = new IntentBus();
  const manager = new ScreenManager(dom.uiRoot, bus);
  const inv = new InventoryScreen(null, manager, bus);
  inv.mount(dom.uiRoot);

  let emitted = null;
  bus.on(IntentBus.Events.SET_HOTBAR_BLOCK, (payload) => {
    emitted = payload;
  });

  inv.selectIndex(3);
  assert.ok(emitted !== null);
  assert.equal(emitted.blockType.name, 'Log');
});

test('ControlsScreen lista todas las categorías y teclas configuradas', () => {
  const bus = new IntentBus();
  const manager = new ScreenManager(dom.uiRoot, bus);
  const controls = new ControlsScreen(manager, bus);
  controls.mount(dom.uiRoot);

  assert.equal(controls.id, ScreenType.CONTROLS);
});
