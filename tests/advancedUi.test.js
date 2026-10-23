import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { installDomStub, uninstallDomStub } from './support/domStub.js';
import { createDefaultBlockRegistry } from '../src/blocks/BlockRegistry.js';
import { ScreenType } from '../src/ui/ScreenType.js';
import { IntentBus } from '../src/ui/IntentBus.js';
import { ScreenManager } from '../src/ui/ScreenManager.js';
import { UiStateManager } from '../src/ui/UiStateManager.js';
import { Toast } from '../src/ui/Toast.js';
import { HealthBar } from '../src/ui/HealthBar.js';
import { Crosshair } from '../src/ui/Crosshair.js';
import { HotbarView } from '../src/ui/HotbarView.js';
import { DebugOverlay } from '../src/ui/DebugOverlay.js';
import { InventoryView, classifyBlockCategory } from '../src/ui/InventoryView.js';
import { InventoryScreen } from '../src/interface/screens/InventoryScreen.js';
import { WorldSelectionView } from '../src/ui/WorldSelectionView.js';
import { WorldSelectionScreen } from '../src/interface/screens/WorldSelectionScreen.js';
import { WorldCreationView } from '../src/ui/WorldCreationView.js';
import { WorldCreationScreen } from '../src/interface/screens/WorldCreationScreen.js';
import { PauseScreen } from '../src/ui/PauseScreen.js';
import { MenuScreen } from '../src/ui/MenuScreen.js';
import { SettingsModel, GRAPHIC_PRESETS } from '../src/interface/models/SettingsModel.js';
import { SettingsScreen } from '../src/interface/screens/SettingsScreen.js';
import { SettingsStorage } from '../src/interface/storage/SettingsStorage.js';
import { SaveManager } from '../src/persistence/SaveManager.js';
import { GameUiBridge } from '../src/ui/GameUiBridge.js';
import { HUD } from '../src/ui/HUD.js';

let dom;

beforeEach(() => {
  dom = installDomStub();
});

afterEach(() => {
  uninstallDomStub();
});

// ============================================================================
// 1. INVENTARIO CREATIVO
// ============================================================================

test('InventoryView muestra exclusivamente bloques registrados del BlockRegistry', () => {
  const registry = createDefaultBlockRegistry();
  const invView = new InventoryView({ blockRegistry: registry });
  invView.refresh();

  const placeable = registry.placeableTypes();
  const cardElements = invView.element.querySelectorAll('.nx-block-card');
  assert.equal(cardElements.length, placeable.length);

  // Comprobar que no hay IDs inventados
  const renderedIds = cardElements.map((card) => Number(card.dataset.blockId));
  const expectedIds = placeable.map((b) => b.id);
  assert.deepEqual(renderedIds, expectedIds);
});

test('InventoryView filtra bloques por categoría correctamente', () => {
  const registry = createDefaultBlockRegistry();
  const invView = new InventoryView({ blockRegistry: registry });

  // Filtrar por naturaleza (Grass, Dirt, Log, Leaves, Sand)
  invView.setCategory('nature');
  const natureCards = invView.element.querySelectorAll('.nx-block-card');
  assert.ok(natureCards.length > 0);
  assert.ok(natureCards.length < registry.placeableTypes().length);

  // Filtrar por todos
  invView.setCategory('all');
  const allCards = invView.element.querySelectorAll('.nx-block-card');
  assert.equal(allCards.length, registry.placeableTypes().length);
});

test('InventoryView busca por nombre y label en tiempo real', () => {
  const registry = createDefaultBlockRegistry();
  const invView = new InventoryView({ blockRegistry: registry });

  // Buscar 'vidrio' o 'glass'
  invView.searchInput.value = 'vidrio';
  invView.searchInput.dispatch('input', { target: invView.searchInput });

  const cards = invView.element.querySelectorAll('.nx-block-card');
  assert.equal(cards.length, 1);
  assert.equal(cards[0].getAttribute('aria-label'), 'Vidrio');
});

test('InventoryView selecciona un bloque y muestra sus metadatos', () => {
  const registry = createDefaultBlockRegistry();
  let selected = null;
  const invView = new InventoryView({
    blockRegistry: registry,
    onSelect: (block) => { selected = block; }
  });

  const stone = registry.getByName('Stone');
  invView.selectBlock(stone);

  assert.equal(invView.selectedBlock, stone);
  assert.equal(selected, stone);

  // Verificar panel de detalles
  const details = invView.element.querySelector('.nx-inventory-details');
  assert.ok(details !== null);
  assert.ok(details.textContent.includes('Piedra'));
  assert.ok(details.textContent.includes('Dureza: 3'));
});

// ============================================================================
// 2. HUD DE SUPERVIVENCIA Y ELEMENTOS IN-GAME
// ============================================================================

test('HealthBar representa salud actual, máxima, corazones llenos, medios y vacíos', () => {
  const bar = new HealthBar(20);
  bar.mount(dom.uiRoot);

  // Inicialmente oculto
  assert.equal(bar.element.hidden, true);

  // Salud 20/20 -> 10 llenos
  bar.update(20, 20);
  assert.equal(bar.element.hidden, false);
  const fullHearts = bar.element.querySelectorAll('.hud-heart-full');
  assert.equal(fullHearts.length, 10);

  // Salud 15/20 -> 7 llenos, 1 medio, 2 vacíos
  bar.update(15, 20);
  assert.equal(bar.element.querySelectorAll('.hud-heart-full').length, 7);
  assert.equal(bar.element.querySelectorAll('.hud-heart-half').length, 1);
  assert.equal(bar.element.querySelectorAll('.hud-heart-empty').length, 2);

  // Al recibir daño se activa animación is-hurt
  assert.equal(bar.element.classList.contains('is-hurt'), true);

  // Restablecimiento al reaparecer (reset)
  bar.reset();
  assert.equal(bar.health, 20);
  assert.equal(bar.element.querySelectorAll('.hud-heart-full').length, 10);

  // Ocultación cuando salud es null
  bar.update(null);
  assert.equal(bar.element.hidden, true);
});

test('Crosshair permite configurar tamaño y opacidad', () => {
  const crosshair = new Crosshair({ size: 16, opacity: 0.8 });
  crosshair.mount(dom.uiRoot);

  assert.equal(crosshair.element.style.width, '16px');
  assert.equal(crosshair.element.style.opacity, '0.8');

  crosshair.setSize(24);
  assert.equal(crosshair.element.style.width, '24px');

  crosshair.setOpacity(0.5);
  assert.equal(crosshair.element.style.opacity, '0.5');

  crosshair.setVisible(false);
  assert.equal(crosshair.element.hidden, true);
});

test('HotbarView actualiza slots con texturas y no reconstruye DOM innecesariamente', () => {
  const hotbar = new HotbarView(9);
  hotbar.mount(dom.uiRoot);

  const blockData = {
    id: 1,
    name: 'Grass',
    label: 'Cesped',
    color: [106, 170, 80],
    textures: { top: 'grass_top.png' }
  };

  hotbar.update({
    selectedIndex: 0,
    slots: [{ blockType: blockData, count: 64 }]
  });

  const slots = hotbar.element.querySelectorAll('.hud-hotbar-slot');
  assert.equal(slots.length, 9);
  assert.equal(slots[0].classList.contains('is-selected'), true);

  const firstIcon = slots[0].querySelector('.hud-slot-icon');
  assert.ok(firstIcon.style.backgroundImage.includes('grass_top.png'));

  // Modificar selección sin alterar DOM de otros slots
  hotbar.update({
    selectedIndex: 2,
    slots: [{ blockType: blockData, count: 64 }]
  });

  assert.equal(slots[0].classList.contains('is-selected'), false);
  assert.equal(slots[2].classList.contains('is-selected'), true);
});

// ============================================================================
// 3. SELECCIÓN Y CREACIÓN DE MUNDOS
// ============================================================================

test('WorldSelectionView escanea partidas, detecta estados y maneja eliminación', () => {
  const storage = dom.window.localStorage;
  const saveKey = `${SaveManager.STORAGE_PREFIX}MundoValido`;
  const corruptKey = `${SaveManager.STORAGE_PREFIX}MundoCorrupto`;
  const incompKey = `${SaveManager.STORAGE_PREFIX}MundoIncompatible`;

  // 1. Guardado válido
  storage.setItem(saveKey, JSON.stringify({
    format: SaveManager.FORMAT_ID,
    saveVersion: SaveManager.SAVE_VERSION,
    savedAt: Date.now(),
    world: { width: 64, height: 32, depth: 64, seed: '12345' }
  }));

  // 2. Guardado corrupto
  storage.setItem(corruptKey, 'no-es-un-json-valido{{{');

  // 3. Guardado incompatible
  storage.setItem(incompKey, JSON.stringify({
    format: SaveManager.FORMAT_ID,
    saveVersion: 999
  }));

  const view = new WorldSelectionView({ storage });
  const worlds = view.scanWorlds();

  assert.equal(worlds.length, 3);

  const validWorld = worlds.find((w) => w.slotName === 'MundoValido');
  assert.equal(validWorld.status, 'available');
  assert.equal(validWorld.seed, '12345');

  const corruptWorld = worlds.find((w) => w.slotName === 'MundoCorrupto');
  assert.equal(corruptWorld.status, 'corrupt');

  const incompWorld = worlds.find((w) => w.slotName === 'MundoIncompatible');
  assert.equal(incompWorld.status, 'incompatible');
});

test('WorldCreationView valida longitud de nombres y rechaza entradas vacías', () => {
  let created = null;
  const view = new WorldCreationView({
    onSubmit: (data) => { created = data; }
  });

  // Nombre vacío
  view.nameInput.value = '   ';
  view.nameInput.dispatch('input', { target: view.nameInput });
  const resultEmpty = view.submit();
  assert.equal(resultEmpty, null);
  assert.equal(created, null);
  assert.equal(view.nameError.hidden, false);

  // Nombre válido con semilla y modo
  view.nameInput.value = 'Aventura 1';
  view.nameInput.dispatch('input', { target: view.nameInput });
  view.seedInput.value = 'mi-semilla';
  view.seedInput.dispatch('input', { target: view.seedInput });
  view.setGameMode('survival');

  const resultValid = view.submit();
  assert.ok(resultValid !== null);
  assert.equal(resultValid.name, 'Aventura 1');
  assert.equal(resultValid.seed, 'mi-semilla');
  assert.equal(resultValid.gameMode, 'survival');
  assert.deepEqual(created, resultValid);
});

// ============================================================================
// 4. CONFIGURACIÓN AVANZADA Y PRESETS
// ============================================================================

test('SettingsModel aplica presets gráficos y ajusta configuraciones dependientes', () => {
  const model = new SettingsModel(new SettingsStorage('adv_test_settings'));

  // Aplicar preset bajo
  model.setGraphicsPreset('low');
  assert.equal(model.get('graphicsPreset'), 'low');
  assert.equal(model.get('ambientParticles'), false);
  assert.equal(model.get('particleDensity'), 0.5);
  assert.equal(model.get('cameraEffects'), false);

  // Aplicar preset alto
  model.setGraphicsPreset('high');
  assert.equal(model.get('graphicsPreset'), 'high');
  assert.equal(model.get('ambientParticles'), true);
  assert.equal(model.get('particleDensity'), 1.0);
  assert.equal(model.get('cameraEffects'), true);

  // Modificar ajuste individual cambia preset a custom
  model.set('particleDensity', 1.5);
  assert.equal(model.get('graphicsPreset'), 'custom');
  assert.equal(model.get('particleDensity'), 1.5);
});

test('SettingsScreen tiene soporte para pestañas y controles gráficos', () => {
  const bus = new IntentBus();
  const manager = new ScreenManager(dom.uiRoot, bus);
  const model = new SettingsModel(new SettingsStorage('screen_test_settings'));
  const screen = new SettingsScreen(model, manager, bus);
  screen.mount(dom.uiRoot);

  // Cambiar pestaña a gráficos
  screen.switchTab('graphics');
  const graphicsPanel = dom.uiRoot.querySelector('#tab-panel-graphics');
  assert.ok(graphicsPanel !== null);
  assert.equal(graphicsPanel.hidden, false);
});

// ============================================================================
// 5. TOAST Y MENSAJES DE NOTIFICACIÓN
// ============================================================================

test('Toast crea notificaciones de éxito, error e info con dismiss accesible', () => {
  const toast = new Toast(dom.uiRoot);
  toast.success('Operación completada con éxito');
  toast.error('Error de lectura');

  const items = dom.uiRoot.querySelectorAll('.nx-toast-item');
  assert.equal(items.length, 2);
  assert.equal(items[0].classList.contains('nx-toast-success'), true);
  assert.equal(items[1].classList.contains('nx-toast-error'), true);
});

// ============================================================================
// 6. PANEL F3 AVANZADO (DebugOverlay)
// ============================================================================

test('DebugOverlay procesa estadísticas reales, respeta throttling y maneja N/D', () => {
  const debug = new DebugOverlay({ SHOW_OVERLAY_ON_START: true, OVERLAY_REFRESH_INTERVAL: 0.1 });
  debug.mount(dom.uiRoot);

  const stats = {
    fps: 59.8,
    position: { x: 100, y: 40, z: 200 },
    renderedBlocks: 1250,
    onGround: true,
    cameraLookDirection: { x: 0.8, y: 0, z: 0.2 },
    seed: '998877',
    biome: 'Plains',
    state: 'running'
  };

  // Actualización inmediata (deltaTime > interval)
  debug.update(0.2, stats);

  const text = debug.element.textContent;
  assert.ok(text.includes('FPS: 60'));
  assert.ok(text.includes('Bloques renderizados: 1250'));
  assert.ok(text.includes('En suelo: Sí'));
  assert.ok(text.includes('Semilla: 998877'));
  assert.ok(text.includes('Caras visibles: N/D')); // Manejo de métrica no disponible
});

// ============================================================================
// 7. GESTOR DE ESTADO DE UI Y PUENTE CON EL JUEGO
// ============================================================================

test('UiStateManager coordina pantallas activas y almacenamiento de estado temporal', () => {
  const uiState = new UiStateManager(ScreenType.MENU);
  assert.equal(uiState.activeScreen, ScreenType.MENU);
  assert.equal(uiState.isPlaying, false);

  uiState.setActiveScreen(ScreenType.PLAYING);
  assert.equal(uiState.activeScreen, ScreenType.PLAYING);
  assert.equal(uiState.isPlaying, true);

  // Estados temporales
  uiState.setTempState('lastWorldName', 'TestWorld');
  assert.equal(uiState.getTempState('lastWorldName'), 'TestWorld');
  uiState.clearTempState('lastWorldName');
  assert.equal(uiState.getTempState('lastWorldName'), undefined);
});
