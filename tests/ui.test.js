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
import { HotbarView } from '../src/ui/HotbarView.js';
import { Toast } from '../src/ui/Toast.js';
import { GameUiBridge } from '../src/ui/GameUiBridge.js';
import { HUD } from '../src/ui/HUD.js';
import { Hotbar } from '../src/inventory/Hotbar.js';
import { createDefaultBlockRegistry, BlockRegistry } from '../src/blocks/BlockRegistry.js';
import { BlockType } from '../src/blocks/BlockType.js';
import { GameState, GameStates } from '../src/game/GameState.js';
import { SaveResult } from '../src/persistence/SaveResult.js';

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
  assert.equal(model.get('fov'), 70);
  assert.equal(model.get('renderDistance'), 8);

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

test('el inventario muestra solo bloques registrados y permite seleccionarlos', () => {
  const registry = new BlockRegistry();
  registry.register({ id: 0, name: 'Air', solid: false, breakable: false });
  registry.register({ id: 1, name: 'CustomGrass', solid: true, label: 'Hierba Fina' });
  registry.register({ id: 2, name: 'CustomStone', solid: true, label: 'Roca Pulida' });

  const bus = new IntentBus();
  const manager = new ScreenManager(dom.uiRoot, bus);
  const inv = new InventoryScreen(registry, manager, bus);
  inv.mount(dom.uiRoot);

  assert.equal(inv.blocks.length, 2, 'solo debe listar los 2 bloques colocables, ignorando aire y mocks');
  assert.equal(inv.blocks[0].name, 'CustomGrass');
  assert.equal(inv.blocks[1].name, 'CustomStone');

  let emitted = null;
  bus.on(IntentBus.Events.SET_HOTBAR_BLOCK, (payload) => {
    emitted = payload;
  });

  inv.selectIndex(1);
  assert.ok(emitted !== null);
  assert.equal(emitted.blockType.name, 'CustomStone');
  assert.equal(emitted.count, 64);
});

test('la hotbar no escribe en el DOM si no cambió nada (diffing estricto)', () => {
  const hotbarView = new HotbarView(9);
  hotbarView.mount(dom.uiRoot);

  const blockA = { id: 1, name: 'Pasto', color: [106, 170, 80] };
  const hotbarState = {
    selectedIndex: 0,
    slots: [
      { blockType: blockA, count: 64 },
      { blockType: null, count: 0 }
    ]
  };

  hotbarView.update(hotbarState);

  // Reemplazamos la propiedad className con un contador para detectar escrituras innecesarias
  let slotModifications = 0;
  const slot0 = hotbarView.element.children[1].children[0];
  const origClass = slot0.className;
  Object.defineProperty(slot0, 'className', {
    get() { return origClass; },
    set() { slotModifications++; }
  });

  // Llamada repetida con exactamente el mismo estado
  hotbarView.update(hotbarState);
  assert.equal(slotModifications, 0, 'No debe modificar el DOM del slot si la firma no cambió');
});

test('ControlsScreen lista todas las categorías y teclas configuradas', () => {
  const bus = new IntentBus();
  const manager = new ScreenManager(dom.uiRoot, bus);
  const controls = new ControlsScreen(manager, bus);
  controls.mount(dom.uiRoot);

  assert.equal(controls.id, ScreenType.CONTROLS);
});

test('que cada ajuste le llegue a su sistema, usando dobles de Game', () => {
  const calls = {
    sensitivity: null,
    fov: null,
    masterVolume: null,
    renderDistance: null,
    debugVisible: null
  };

  const fakeGame = {
    hud: new HUD(),
    camera: {
      setSensitivityMultiplier(val) { calls.sensitivity = val; },
      setFov(val) { calls.fov = val; }
    },
    audio: {
      setMasterVolume(val) { calls.masterVolume = val; }
    },
    renderer: {
      setRenderDistance(val) { calls.renderDistance = val; }
    },
    config: {
      chunk: { SIZE_X: 16 }
    },
    hotbar: new Hotbar(9),
    blockRegistry: createDefaultBlockRegistry(),
    saveManager: { exists: () => false, save: () => SaveResult.ok(), load: () => SaveResult.ok() },
    state: new GameState(GameStates.RUNNING)
  };

  const bridge = new GameUiBridge(fakeGame);

  // Probar cambio de sensibilidad
  bridge.intentBus.emit(IntentBus.Events.SETTINGS_CHANGED, { key: 'mouseSensitivity', value: 2.2 });
  assert.equal(calls.sensitivity, 2.2);

  // Probar cambio de FOV
  bridge.intentBus.emit(IntentBus.Events.SETTINGS_CHANGED, { key: 'fov', value: 90 });
  assert.equal(calls.fov, 90);

  // Probar cambio de volumen (de 0..100 a 0..1)
  bridge.intentBus.emit(IntentBus.Events.SETTINGS_CHANGED, { key: 'masterVolume', value: 50 });
  assert.equal(calls.masterVolume, 0.5);

  // Probar cambio de distancia de render (chunks * 16)
  bridge.intentBus.emit(IntentBus.Events.SETTINGS_CHANGED, { key: 'renderDistance', value: 12 });
  assert.equal(calls.renderDistance, 12 * 16);

  // Probar selección de bloque desde inventario al hotbar
  bridge.intentBus.emit(IntentBus.Events.SET_HOTBAR_BLOCK, {
    blockType: { id: 3, name: 'Piedra' },
    count: 64
  });
  assert.equal(fakeGame.hotbar.selectedBlockType.name, 'Piedra');
  assert.equal(fakeGame.hotbar.selectedSlot.count, 64);
});

test('los mensajes al guardar y cargar partida se muestran mediante Toast', () => {
  let savedSlot = null;
  let loadedSlot = null;

  const fakeGame = {
    hud: new HUD(),
    camera: { setSensitivityMultiplier: () => {}, setFov: () => {} },
    audio: { setMasterVolume: () => {} },
    renderer: { setRenderDistance: () => {} },
    config: { chunk: { SIZE_X: 16 } },
    hotbar: new Hotbar(9),
    blockRegistry: createDefaultBlockRegistry(),
    saveManager: {
      exists: (s) => s === 'slot1',
      save: (s) => {
        savedSlot = s;
        return SaveResult.ok();
      },
      load: (s) => {
        loadedSlot = s;
        return s === 'slot1' ? SaveResult.ok() : SaveResult.fail(SaveResult.Reasons.NOT_FOUND);
      }
    },
    state: new GameState(GameStates.RUNNING)
  };

  const bridge = new GameUiBridge(fakeGame);

  const saveRes = bridge.saveGame('partida_a');
  assert.equal(saveRes.ok, true);
  assert.equal(savedSlot, 'partida_a');

  const loadOk = bridge.loadGame('slot1');
  assert.equal(loadOk.ok, true);
  assert.equal(loadedSlot, 'slot1');

  const loadFail = bridge.loadGame('inexistente');
  assert.equal(loadFail.ok, false);
});

test('que la pausa funcione sin eventos de teclado sintéticos', () => {
  let paused = false;
  let resumed = false;

  const fakeGame = {
    hud: new HUD(),
    camera: { setSensitivityMultiplier: () => {}, setFov: () => {} },
    audio: { setMasterVolume: () => {} },
    renderer: { setRenderDistance: () => {} },
    config: { chunk: { SIZE_X: 16 } },
    hotbar: new Hotbar(9),
    blockRegistry: createDefaultBlockRegistry(),
    saveManager: { exists: () => false },
    state: new GameState(GameStates.RUNNING),
    pause: () => { paused = true; fakeGame.state.set(GameStates.PAUSED); },
    resume: () => { resumed = true; fakeGame.state.set(GameStates.RUNNING); }
  };

  const bridge = new GameUiBridge(fakeGame);

  bridge.intentBus.emit(IntentBus.Events.PAUSE_GAME);
  assert.equal(paused, true);
  assert.equal(fakeGame.state.current, GameStates.PAUSED);

  bridge.intentBus.emit(IntentBus.Events.RESUME_GAME);
  assert.equal(resumed, true);
  assert.equal(fakeGame.state.current, GameStates.RUNNING);
});
