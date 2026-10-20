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
import { KeyboardInput } from '../src/input/KeyboardInput.js';
import { GameUiBridge } from '../src/ui/GameUiBridge.js';
import { Hotbar } from '../src/inventory/Hotbar.js';
import { InventoryView } from '../src/ui/InventoryView.js';
import { createDefaultBlockRegistry } from '../src/blocks/BlockRegistry.js';

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

test('KeyboardInput ignora teclas cuando el foco está en un input de texto', () => {
  const keyboard = new KeyboardInput();
  keyboard.attach(dom.window);

  const input = document.createElement('input');
  dom.window.dispatch('keydown', { code: 'KeyS', target: input });
  assert.equal(keyboard.isDown('KeyS'), false, 'KeyS no debe registrarse si target es input');

  dom.window.dispatch('keydown', { code: 'KeyS', target: dom.window });
  assert.equal(keyboard.isDown('KeyS'), true, 'KeyS sí debe registrarse en el juego normal');

  keyboard.detach();
});

test('ScreenManager.back() desde INVENTORY regresa a PLAYING', () => {
  const bus = new IntentBus();
  const manager = new ScreenManager(dom.uiRoot, bus);
  const inv = new InventoryScreen(null, manager, bus);
  manager.register(ScreenType.INVENTORY, inv);

  manager.open(ScreenType.PLAYING);
  manager.open(ScreenType.INVENTORY);
  assert.equal(manager.currentScreenType, ScreenType.INVENTORY);

  manager.back();
  assert.equal(manager.currentScreenType, ScreenType.PLAYING);
});

test('InventoryScreen.handleBack() regresa a PLAYING incluso si hubo navegación previa por menús', () => {
  const bus = new IntentBus();
  const manager = new ScreenManager(dom.uiRoot, bus);
  const inv = new InventoryScreen(null, manager, bus);
  manager.register(ScreenType.INVENTORY, inv);

  // Simular flujo completo: Menú -> Selección de Mundo -> Juego -> Inventario
  manager.open(ScreenType.MENU);
  manager.open(ScreenType.WORLD_SELECTION);
  manager.open(ScreenType.PLAYING);
  manager.open(ScreenType.INVENTORY);
  assert.equal(manager.currentScreenType, ScreenType.INVENTORY);

  inv.handleBack();
  assert.equal(manager.currentScreenType, ScreenType.PLAYING, 'Debe volver al juego activo y no a selección de mundos ni al menú');
});

test('GameUiBridge sincroniza pausa al abrir cualquier menú y reanuda en PLAYING', () => {
  const bus = new IntentBus();
  const manager = new ScreenManager(dom.uiRoot, bus);
  let paused = false;
  let resumed = false;

  const mockGame = {
    pause: () => { paused = true; resumed = false; },
    resume: () => { resumed = true; paused = false; }
  };
  const mockHud = {
    container: dom.uiRoot,
    screenManager: manager
  };

  const bridge = new GameUiBridge(mockGame, mockHud, bus);

  manager.open(ScreenType.INVENTORY);
  assert.equal(paused, true);
  assert.equal(resumed, false);

  manager.open(ScreenType.PLAYING);
  assert.equal(resumed, true);
  assert.equal(paused, false);
});

test('Inventory y Hotbar exponen set() para asignar bloques en cualquier ranura', () => {
  const hotbar = new Hotbar(9);
  const fakeBlock = { id: 7, name: 'Glass', label: 'Vidrio' };

  assert.equal(hotbar.getSlot(3).isEmpty, true);
  hotbar.set(3, fakeBlock, 64);

  assert.equal(hotbar.getSlot(3).isEmpty, false);
  assert.equal(hotbar.getSlot(3).blockType.name, 'Glass');
  assert.equal(hotbar.getSlot(3).count, 64);
});

test('SET_HOTBAR_BLOCK carga el bloque seleccionado en la hotbar del juego', () => {
  const bus = new IntentBus();
  const manager = new ScreenManager(dom.uiRoot, bus);
  const hotbar = new Hotbar(9);
  const fakeBlock = { id: 10, name: 'GoldOre', label: 'Mineral de oro' };

  const mockGame = {
    hotbar,
    config: { inventory: { STARTER_BLOCK_COUNT: 64 } },
    blockRegistry: { get: (id) => (id === 10 ? fakeBlock : null) },
    pause: () => {},
    resume: () => {}
  };
  const mockHud = {
    container: dom.uiRoot,
    screenManager: manager
  };

  const bridge = new GameUiBridge(mockGame, mockHud, bus);

  // Equipar en slot 2 directamente
  bus.emit(IntentBus.Events.SET_HOTBAR_BLOCK, {
    blockType: fakeBlock,
    count: 64,
    slotIndex: 2
  });

  assert.equal(hotbar.getSlot(2).blockType.name, 'GoldOre');
  assert.equal(hotbar.getSlot(2).count, 64);
});

test('un bloque roto se apila en la pila existente si tiene espacio (ej. 63 -> 64) en vez de ocupar ranura nueva', () => {
  const hotbar = new Hotbar(9);
  const registryA = createDefaultBlockRegistry();
  const registryB = createDefaultBlockRegistry();

  const sandstoneFromUi = registryA.getByName('Sandstone');
  const sandstoneFromWorld = registryB.getByName('Sandstone');

  // Ranura 0 tiene 63 arenisca (se colocó 1 bloque)
  hotbar.set(0, sandstoneFromUi, 63);
  assert.equal(hotbar.getSlot(0).count, 63);

  // Se rompe el bloque en el mundo y se recoge
  hotbar.add(sandstoneFromWorld, 1);

  // Debe volver a la ranura 0 llegando a 64 y dejar la ranura 1 vacía
  assert.equal(hotbar.getSlot(0).count, 64, 'La pila existente debe completarse a 64');
  assert.equal(hotbar.getSlot(1).isEmpty, true, 'No debe ocupar una ranura nueva habiendo lugar en la pila');
});

test('hacer clic en una tarjeta de bloque solo lo selecciona; se equipa eligiendo la ranura', () => {
  const registry = createDefaultBlockRegistry();
  let selectedBlock = null;
  let equippedPayload = null;

  const invView = new InventoryView({
    blockRegistry: registry,
    onSelect: (block) => { selectedBlock = block; },
    onEquip: (block, slotIndex) => { equippedPayload = { block, slotIndex }; }
  });

  const cards = invView.element.querySelectorAll('.nx-block-card');
  assert.ok(cards.length > 0);

  // 1. Clic en la tarjeta de un bloque
  cards[1].dispatch('click');
  assert.ok(selectedBlock !== null, 'El bloque debe quedar seleccionado');
  assert.equal(equippedPayload, null, 'Hacer clic en la tarjeta NO debe equipar automáticamente en la hotbar');

  // 2. Clic en el botón de ranura 4 (índice 3)
  const slotBtns = invView.element.querySelectorAll('.nx-btn-slot-pick');
  assert.equal(slotBtns.length, 9, 'Debe haber 9 botones de selección de ranura');
  slotBtns[3].dispatch('click');

  assert.ok(equippedPayload !== null, 'Al pulsar la ranura deseada sí debe equiparse');
  assert.equal(equippedPayload.slotIndex, 3, 'Debe equiparse en la ranura seleccionada (slot 4)');
  assert.equal(equippedPayload.block.name, selectedBlock.name);
});



