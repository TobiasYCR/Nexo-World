import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { installDomStub, uninstallDomStub } from './support/domStub.js';
import {
  createDefaultBlockRegistry,
  BlockRegistry,
  resolveBlockSyllables,
  resolveBlockSyllableLines,
  splitSpanishWordIntoSyllables
} from '../src/blocks/BlockRegistry.js';
import { BlockIds } from '../src/utils/Constants.js';
import { SpeechService, formatSyllableForSpeech } from '../src/audio/SpeechService.js';
import { InventoryView } from '../src/ui/InventoryView.js';
import { HotbarView } from '../src/ui/HotbarView.js';
import { createDefaultBlueprintRegistry } from '../src/education/BlueprintRegistry.js';
import { BuildChallenge } from '../src/education/BuildChallenge.js';
import { BuildChallengeView } from '../src/ui/BuildChallengeView.js';
import { FirstPersonCamera } from '../src/camera/FirstPersonCamera.js';
import { BuildChallengeHUD } from '../src/ui/BuildChallengeHUD.js';
import { PresetsScreen } from '../src/interface/screens/PresetsScreen.js';
import { World } from '../src/world/World.js';
import { Player } from '../src/player/Player.js';
import { Hotbar } from '../src/inventory/Hotbar.js';
import { GameConfig } from '../src/game/GameConfig.js';
import { GameEvents, GameEventTypes } from '../src/game/GameEvents.js';
import { IntentBus } from '../src/ui/IntentBus.js';
import { ScreenManager } from '../src/ui/ScreenManager.js';
import { ScreenType } from '../src/ui/ScreenType.js';
import { GameUiBridge } from '../src/ui/GameUiBridge.js';
import { EducationKnowledge } from '../src/chatbot/EducationKnowledge.js';

let dom;

beforeEach(() => {
  dom = installDomStub();
  SpeechService.resetInstance();
});

afterEach(() => {
  SpeechService.resetInstance();
  uninstallDomStub();
});

// ============================================================================
// 1. METADATOS SILÁBICOS EN BLOCKREGISTRY Y DICCIONARIO DE RESPALDO
// ============================================================================

test('todos los bloques del BlockRegistry incluyen syllables y syllableText válidos', () => {
  const registry = createDefaultBlockRegistry();
  for (const block of registry.values()) {
    assert.ok(Array.isArray(block.syllables), `${block.name} debe tener arreglo syllables`);
    assert.ok(block.syllables.length > 0, `${block.name} debe tener al menos una sílaba`);
    assert.equal(typeof block.syllableText, 'string');
    assert.equal(block.syllableText, block.syllables.join(' - '));
  }

  const planks = registry.get(BlockIds.PLANKS);
  assert.deepEqual([...planks.syllables], ['TA', 'BLO', 'NES']);
  assert.equal(planks.syllableText, 'TA - BLO - NES');

  const stone = registry.get(BlockIds.STONE);
  assert.deepEqual([...stone.syllables], ['PIE', 'DRA']);
  assert.equal(stone.syllableText, 'PIE - DRA');
});

test('el helper y diccionario de respaldo resuelven bloques sin sílabas manuales', () => {
  const registry = new BlockRegistry();
  const wood = registry.register({ id: 20, name: 'Wood', label: 'Madera' });
  assert.deepEqual([...wood.syllables], ['MA', 'DE', 'RA']);
  assert.equal(wood.syllableText, 'MA - DE - RA');

  const brick = registry.register({ id: 21, name: 'Brick', label: 'Ladrillo' });
  assert.deepEqual([...brick.syllables], ['LA', 'DRI', 'LLO']);
  assert.equal(brick.syllableText, 'LA - DRI - LLO');

  // Separador algorítmico para palabras nuevas fuera del diccionario
  const custom = resolveBlockSyllables({ label: 'Ventana', name: 'Window' });
  assert.deepEqual([...custom.syllables], ['VEN', 'TA', 'NA']);
  assert.equal(custom.syllableText, 'VEN - TA - NA');
  assert.deepEqual(splitSpanishWordIntoSyllables('Madera'), ['MA', 'DE', 'RA']);
});

// ============================================================================
// 2. PRONUNCIACIÓN POR SÍLABAS CON AUDIO (SPEECHSERVICE)
// ============================================================================

function createFakeSpeechEnv() {
  const spoken = [];
  let cancelCount = 0;

  class FakeUtterance {
    constructor(text) {
      this.text = text;
      this.lang = '';
      this.rate = 1;
      this.voice = null;
      this.onend = null;
      this.onerror = null;
    }
  }

  const synth = {
    getVoices: () => [
      { name: 'English Voice', lang: 'en-US' },
      { name: 'Voz Español Argentina', lang: 'es-AR' }
    ],
    cancel: () => {
      cancelCount += 1;
    },
    speak: (utterance) => {
      spoken.push(utterance);
      // Disparar onend de forma inmediata para avanzar por cada sílaba en el test
      if (typeof utterance.onend === 'function') {
        utterance.onend();
      }
    }
  };

  return { synth, FakeUtterance, spoken, getCancelCount: () => cancelCount };
}

test('SpeechService selecciona voz en español con velocidad reducida (rate: 0.75) y pronuncia sílaba por sílaba más la palabra final', async () => {
  const env = createFakeSpeechEnv();
  const service = new SpeechService({
    synth: env.synth,
    UtteranceClass: env.FakeUtterance,
    syllablePauseMs: 5,
    stepFallbackMs: 20
  });

  assert.equal(service.rate, 0.75);
  assert.equal(service.selectSpanishVoice()?.lang, 'es-AR');

  const highlighted = [];
  let completedWord = null;

  await new Promise((resolve) => {
    service.speakSyllables(
      { label: 'Madera', syllables: ['MA', 'DE', 'RA'] },
      {
        onSyllable: (index, syl) => highlighted.push({ index, syl }),
        onCompleteWord: (word) => { completedWord = word; },
        onEnd: () => resolve()
      }
    );
  });

  assert.deepEqual(highlighted, [
    { index: 0, syl: 'MA' },
    { index: 1, syl: 'DE' },
    { index: 2, syl: 'RA' }
  ]);
  assert.equal(completedWord, 'Madera');
  assert.deepEqual(
    env.spoken.map((u) => u.text),
    ['má', 'dé', 'rá', 'madera']
  );
  assert.equal(env.spoken[0].rate, 0.75);
  assert.equal(env.spoken[0].lang, 'es-AR');

  // Verificar que "Arena" pronuncie ['á', 'ré', 'ná', 'arena'] para que el TTS en español no lea "na" como "sodio"
  assert.equal(formatSyllableForSpeech('NA'), 'ná');
  assert.equal(formatSyllableForSpeech('RE'), 'ré');
  assert.equal(formatSyllableForSpeech('A'), 'á');
});

test('SpeechService cancela automáticamente la locución anterior si el usuario hace clic rápido en otro bloque', () => {
  const env = createFakeSpeechEnv();
  // No auto-completamos onend para simular locución en curso
  env.synth.speak = (utterance) => {
    env.spoken.push(utterance);
  };

  const service = new SpeechService({
    synth: env.synth,
    UtteranceClass: env.FakeUtterance,
    syllablePauseMs: 50,
    stepFallbackMs: 100
  });

  service.speakSyllables({ label: 'Madera', syllables: ['MA', 'DE', 'RA'] });
  const cancelsBefore = env.getCancelCount();

  // Clic rápido en otro bloque
  service.speakSyllables({ label: 'Piedra', syllables: ['PIE', 'DRA'] });
  assert.ok(env.getCancelCount() > cancelsBefore, 'Debe invocar speechSynthesis.cancel() al iniciar otra lectura');

  service.cancel();
});

// ============================================================================
// 3. INTERFAZ DEL INVENTARIO Y HOTBAR SILÁBICA
// ============================================================================

test('InventoryView muestra sílabas en cada tarjeta, botón Escuchar con icono y resalta sílabas al pronunciar', () => {
  const registry = createDefaultBlockRegistry();
  const env = createFakeSpeechEnv();
  env.synth.speak = (u) => env.spoken.push(u); // Retener en la primera sílaba

  const speech = new SpeechService({
    synth: env.synth,
    UtteranceClass: env.FakeUtterance,
    syllablePauseMs: 100,
    stepFallbackMs: 200
  });

  const invView = new InventoryView({ blockRegistry: registry, speechService: speech });
  const cards = invView.element.querySelectorAll('.nx-block-card');
  assert.ok(cards.length > 0);

  // Verificar que cada tarjeta tiene contenedor de sílabas y botón de audio
  const firstSyllables = cards[0].querySelector('.nx-block-syllables');
  const firstSpeakBtn = cards[0].querySelector('.nx-btn-speak-block');
  assert.ok(firstSyllables !== null);
  assert.ok(firstSpeakBtn !== null);
  assert.ok(firstSyllables.textContent.includes('CES - PED'));

  // Hacer clic en el botón de escuchar de la primera tarjeta
  firstSpeakBtn.dispatch('click', { stopPropagation: () => {} });

  const firstPart = firstSyllables.querySelector('.nx-syllable-part');
  assert.equal(firstPart.classList.contains('is-speaking'), true, 'La primera sílaba debe resaltarse visualmente');
  assert.equal(env.spoken.length, 1);
  assert.equal(env.spoken[0].text, 'cés');

  // Verificar que bloques compuestos se dividan en 2 líneas enteras (una palabra arriba y otra abajo)
  const cobblestone = registry.get(BlockIds.COBBLESTONE);
  assert.deepEqual(
    resolveBlockSyllableLines(cobblestone).map((line) => [...line]),
    [['PIE', 'DRA'], ['PAR', 'TI', 'DA']]
  );

  speech.cancel();
});

test('HotbarView muestra las sílabas del bloque activo y permite escuchar su pronunciación', () => {
  const registry = createDefaultBlockRegistry();
  const planks = registry.get(BlockIds.PLANKS);
  const env = createFakeSpeechEnv();
  env.synth.speak = (u) => env.spoken.push(u);

  const speech = new SpeechService({
    synth: env.synth,
    UtteranceClass: env.FakeUtterance,
    syllablePauseMs: 100,
    stepFallbackMs: 200
  });

  const hotbarView = new HotbarView(9, { speechService: speech });
  hotbarView.mount(dom.uiRoot);

  hotbarView.update({
    selectedIndex: 0,
    slots: [{ blockType: planks, count: 64 }]
  });

  assert.ok(hotbarView.labelElement.textContent.includes('Tablones'));
  assert.ok(hotbarView.syllablesSpan.textContent.includes('TA - BLO - NES'));

  hotbarView.speakBtn.dispatch('click', { stopPropagation: () => {} });
  const activeParts = hotbarView.syllablesSpan.querySelectorAll('.hud-syllable-part');
  assert.equal(activeParts.length, 3);
  assert.equal(activeParts[0].classList.contains('is-speaking'), true);

  speech.cancel();
});

// ============================================================================
// 4. DESAFÍOS DE CONSTRUCCIÓN CON PRESETS (PLANOS DE CASAS) Y PUENTE UI/MOTOR
// ============================================================================

/** Mundo con piso, jugador en el centro y el desafío real del juego (BuildChallenge). */
function challengeHarness() {
  const registry = createDefaultBlockRegistry();
  const world = new World(registry, GameConfig);
  for (let x = 0; x < world.width; x += 1) {
    for (let z = 0; z < world.depth; z += 1) world.setBlockId(x, 0, z, BlockIds.STONE);
  }
  const size = GameConfig.world.BLOCK_SIZE;
  const center = { x: Math.floor(world.width / 2) * size + size / 2, y: 2 * size, z: Math.floor(world.depth / 2) * size + size / 2 };
  const player = new Player({ ...GameConfig.player, SPAWN: center });
  const camera = new FirstPersonCamera(GameConfig.camera);
  const hotbar = new Hotbar(9);
  const events = new GameEvents();
  const challenge = new BuildChallenge({
    world,
    player,
    camera,
    blueprintRegistry: createDefaultBlueprintRegistry(registry, GameConfig.education),
    blockRegistry: registry,
    events,
    config: GameConfig.education
  });
  return { registry, world, player, hotbar, events, challenge };
}

function placeNext(world, events, registry, snapshot) {
  const { position, blockId } = snapshot.nextBlock;
  world.setBlockId(position.x, position.y, position.z, blockId);
  events.emit(GameEventTypes.BLOCK_PLACED, { position, blockType: registry.get(blockId) });
}

test('BuildChallengeView presenta planos y progreso con sílabas, y el chat lee el mismo desafío', () => {
  const { registry, world, events, challenge } = challengeHarness();
  const view = new BuildChallengeView(registry);

  const presets = view.presets(challenge.blueprints());
  assert.ok(presets.length >= 3);
  const house = presets.find((preset) => preset.name === 'Casa de madera');
  assert.ok(house);
  assert.equal(house.difficulty, 'Fácil');
  assert.equal(house.totalBlocks, house.materials.reduce((total, material) => total + material.count, 0));
  assert.ok(house.materials.every((material) => material.syllableText.includes('-') || material.syllables.length === 1));

  assert.equal(view.challenge(challenge.snapshot()), null);
  const started = challenge.start(house.id);
  assert.equal(started.ok, true, started.message);

  let shown = view.challenge(started.snapshot);
  assert.equal(shown.name, 'Casa de madera');
  assert.equal(shown.placedBlocks, 0);
  assert.ok(Array.isArray(shown.nextBlock.syllables));
  assert.equal(shown.nextBlock.remaining, shown.materials.find((m) => m.blockId === shown.nextBlock.blockId).remaining);

  // El asistente de consultas usa el mismo objeto que la interfaz.
  const eduKnowledge = new EducationKnowledge({ contextProvider: () => ({ buildChallenge: challenge }) });
  assert.ok(eduKnowledge.answer('game.education.blueprints').text.includes('Casa de madera'));
  const status = eduKnowledge.answer('game.status.challenge');
  assert.equal(status.isKnown, true);
  assert.ok(status.text.includes('Casa de madera'));

  placeNext(world, events, registry, challenge.snapshot());
  shown = view.challenge(challenge.snapshot());
  assert.equal(shown.placedBlocks, 1);

  let finished = null;
  events.on(GameEventTypes.BUILD_CHALLENGE_COMPLETED, ({ snapshot }) => { finished = snapshot; });
  while (challenge.snapshot()) placeNext(world, events, registry, challenge.snapshot());
  shown = view.challenge(finished);
  assert.equal(shown.completed, true);
  assert.equal(shown.progress, 1);
  assert.equal(shown.nextBlock, null);
});

test('PresetsScreen, BuildChallengeHUD y GameUiBridge se comunican desacopladamente vía IntentBus', () => {
  const { registry, world, hotbar, events, challenge } = challengeHarness();
  const bus = new IntentBus();
  const screenManager = new ScreenManager(dom.uiRoot, bus);
  const buildChallengeHud = new BuildChallengeHUD({ intentBus: bus });
  buildChallengeHud.mount(dom.uiRoot);
  const presetsScreen = new PresetsScreen(screenManager, bus);
  screenManager.register(ScreenType.PRESETS, presetsScreen);

  const mockGame = {
    buildChallenge: challenge,
    events,
    hotbar,
    blockRegistry: registry,
    progression: { mode: 'creative' },
    pause: () => {},
    resume: () => {}
  };
  const mockHud = { container: dom.uiRoot, screenManager, buildChallengeHud, presetsScreen };
  new GameUiBridge(mockGame, mockHud, bus);

  // El puente carga los planos del juego en la pantalla de selección.
  assert.deepEqual(presetsScreen.presets.map((preset) => preset.id), challenge.blueprints().map((blueprint) => blueprint.id));

  presetsScreen.selectAndStartPreset('river-bridge');
  const active = challenge.snapshot();
  assert.ok(active);
  assert.equal(active.blueprintId, 'river-bridge');
  assert.ok(buildChallengeHud.element.textContent.includes(active.name));
  assert.equal(hotbar.getSlot(0).isEmpty, false, 'en creativo se cargan los materiales');

  // Colocar un bloque actualiza el panel por eventos, sin que la interfaz recalcule nada.
  placeNext(world, events, registry, active);
  assert.ok(buildChallengeHud.element.textContent.includes(`1 / ${active.total}`));

  bus.emit(IntentBus.Events.CANCEL_BUILD_CHALLENGE);
  assert.equal(challenge.snapshot(), null);
  assert.equal(buildChallengeHud.element.textContent.includes(active.name), false);
});

test('en supervivencia el plano no regala materiales', () => {
  const { registry, hotbar, events, challenge } = challengeHarness();
  const bus = new IntentBus();
  const screenManager = new ScreenManager(dom.uiRoot, bus);
  const buildChallengeHud = new BuildChallengeHUD({ intentBus: bus });
  const presetsScreen = new PresetsScreen(screenManager, bus);
  new GameUiBridge(
    { buildChallenge: challenge, events, hotbar, blockRegistry: registry, progression: { mode: 'survival' }, pause() {}, resume() {} },
    { container: dom.uiRoot, screenManager, buildChallengeHud, presetsScreen },
    bus
  );
  presetsScreen.selectAndStartPreset('wood-house');
  assert.ok(challenge.snapshot());
  assert.equal(hotbar.getSlot(0).isEmpty, true);
});
