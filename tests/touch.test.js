import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { installDomStub, uninstallDomStub } from './support/domStub.js';
import { TouchInput, TouchActions } from '../src/input/TouchInput.js';
import { TouchSupport } from '../src/input/TouchSupport.js';
import { InputManager } from '../src/input/InputManager.js';
import { TouchControls } from '../src/ui/TouchControls.js';
import { TutorialPanel } from '../src/ui/TutorialPanel.js';
import { HowToPlayScreen } from '../src/interface/screens/HowToPlayScreen.js';
import { HUD } from '../src/ui/HUD.js';
import { InputActions } from '../src/utils/Constants.js';

beforeEach(() => installDomStub());
afterEach(() => uninstallDomStub());

const CONFIG = { MODE: 'auto', LOOK_SCALE: 2, JOYSTICK_DEAD_ZONE: 0.2, JOYSTICK_RADIUS: 50 };

function controls() {
  const opened = [];
  const view = new TouchControls({
    config: CONFIG,
    onInventory: () => opened.push('inventory'),
    onBlueprints: () => opened.push('blueprints'),
    onChat: () => opened.push('chat')
  });
  const touch = new TouchInput();
  view.connect(touch);
  view.setEnabled(true);
  view.setVisible(true);
  view.stickBase.getBoundingClientRect = () => ({ left: 0, top: 0, width: 100, height: 100 });
  return { view, touch, opened };
}

test('TouchInput: joystick, mirar y botones con borde de subida que dura un frame', () => {
  const touch = new TouchInput();
  touch.setMove(3, 4);
  assert.equal(touch.moveX.toFixed(2), '0.60', 'se normaliza a radio 1');
  assert.equal(touch.moveY.toFixed(2), '0.80');
  assert.equal(touch.isStickSprinting, true);
  assert.equal(touch.axis(InputActions.MOVE_BACKWARD, InputActions.MOVE_FORWARD), touch.moveY);
  assert.equal(touch.axis(InputActions.MOVE_LEFT, InputActions.MOVE_RIGHT), touch.moveX);
  assert.equal(touch.axis(InputActions.SPRINT, InputActions.JUMP), 0);

  touch.addLook(5, -2);
  touch.addLook(1, 1);
  assert.deepEqual([touch.lookDeltaX, touch.lookDeltaY], [6, -1]);

  touch.tap(TouchActions.PLACE);
  assert.equal(touch.wasJustPressed(TouchActions.PLACE), true);
  assert.equal(touch.isDown(TouchActions.PLACE), false);
  touch.endFrame();
  assert.equal(touch.wasJustPressed(TouchActions.PLACE), false);
  assert.deepEqual([touch.lookDeltaX, touch.lookDeltaY], [0, 0]);
  assert.equal(touch.moveY.toFixed(2), '0.80', 'el joystick se mantiene entre frames');

  touch.press(TouchActions.BREAK);
  touch.setActive(false);
  assert.equal(touch.isDown(TouchActions.BREAK), false, 'desactivar suelta todo');
  assert.equal(touch.moveY, 0);
});

test('InputManager suma teclado, mouse y táctil', () => {
  const input = new InputManager(undefined, CONFIG);
  assert.equal(input.hasControl, false);
  input.touch.setActive(true);
  assert.equal(input.hasControl, true, 'con controles táctiles no hace falta capturar el mouse');

  input.touch.setMove(0, 0.5);
  assert.equal(input.axis(InputActions.MOVE_BACKWARD, InputActions.MOVE_FORWARD), 0.5);
  assert.equal(input.isSprintRequested(), false);
  input.touch.setMove(0, 1);
  assert.equal(input.isSprintRequested(), true, 'joystick al borde: correr');
  assert.equal(input.flyVerticalAxis(), 0, 'el joystick al borde no baja volando');

  input.touch.press(InputActions.JUMP);
  assert.equal(input.flyVerticalAxis(), 1);
  input.touch.release(InputActions.JUMP);
  input.touch.press(TouchActions.DESCEND);
  assert.equal(input.flyVerticalAxis(), -1);

  input.touch.addLook(10, 4);
  assert.deepEqual([input.lookDeltaX, input.lookDeltaY], [20, 8], 'escalado por LOOK_SCALE');

  input.touch.press(TouchActions.BREAK);
  assert.equal(input.isBreakDown(), true);
  input.touch.tap(TouchActions.PLACE);
  assert.equal(input.wasPlaceRequested(), true);
  input.touch.tap(InputActions.PAUSE);
  assert.equal(input.wasActionJustPressed(InputActions.PAUSE), true);
  input.endFrame();
  assert.equal(input.wasPlaceRequested(), false);
  assert.deepEqual([input.lookDeltaX, input.lookDeltaY], [0, 0]);
});

test('TouchSupport: auto detecta pantallas solo táctiles; on/off y ?touch= lo fuerzan', () => {
  const win = (coarse, fine, search = '') => ({
    navigator: { maxTouchPoints: coarse ? 5 : 0 },
    location: { search },
    matchMedia: (query) => ({ matches: query === '(pointer: coarse)' ? coarse : query === '(any-pointer: fine)' ? fine : false })
  });
  assert.equal(TouchSupport.shouldUseTouch({ mode: 'auto', win: win(true, false) }), true, 'celular');
  assert.equal(TouchSupport.shouldUseTouch({ mode: 'auto', win: win(true, true) }), false, 'notebook táctil con trackpad');
  assert.equal(TouchSupport.shouldUseTouch({ mode: 'auto', win: win(false, true) }), false, 'PC');
  assert.equal(TouchSupport.shouldUseTouch({ mode: 'on', win: win(false, true) }), true);
  assert.equal(TouchSupport.shouldUseTouch({ mode: 'off', win: win(true, false) }), false);
  assert.equal(TouchSupport.shouldUseTouch({ mode: 'auto', win: win(false, true, '?touch=1') }), true);
  assert.equal(TouchSupport.shouldUseTouch({ mode: 'on', win: win(true, false, '?touch=0') }), false);
  assert.equal(TouchSupport.shouldUseTouch({ win: undefined }), false, 'sin ventana (tests)');
});

test('el joystick mueve con zona muerta, se limita al radio y vuelve al centro al soltar', () => {
  const { view, touch } = controls();
  view.stick.dispatch('pointerdown', { pointerId: 1, clientX: 50, clientY: 50 });
  view.stick.dispatch('pointermove', { pointerId: 1, clientX: 55, clientY: 50 });
  assert.deepEqual([touch.moveX, touch.moveY], [0, 0], 'dentro de la zona muerta no camina');

  view.stick.dispatch('pointermove', { pointerId: 1, clientX: 50, clientY: 25 });
  assert.deepEqual([touch.moveX, touch.moveY], [0, 0.5], 'hacia arriba es adelante');
  view.stick.dispatch('pointermove', { pointerId: 9, clientX: 100, clientY: 50 });
  assert.deepEqual([touch.moveX, touch.moveY], [0, 0.5], 'otro dedo no mueve el joystick');

  view.stick.dispatch('pointermove', { pointerId: 1, clientX: 250, clientY: 50 });
  assert.deepEqual([touch.moveX, touch.moveY], [1, -0], 'más allá del radio queda en 1');
  assert.equal(view.stickKnob.style.transform, 'translate(50px, 0px)');

  view.stick.dispatch('pointerup', { pointerId: 1 });
  assert.deepEqual([touch.moveX, touch.moveY], [0, 0]);
  assert.equal(view.stickKnob.style.transform, 'translate(0px, 0px)');
});

test('arrastrar en la pantalla mira; un segundo dedo no interfiere', () => {
  const { view, touch } = controls();
  view.lookZone.dispatch('pointerdown', { pointerId: 2, clientX: 300, clientY: 100 });
  view.lookZone.dispatch('pointerdown', { pointerId: 3, clientX: 600, clientY: 100 });
  view.lookZone.dispatch('pointermove', { pointerId: 2, clientX: 320, clientY: 90 });
  view.lookZone.dispatch('pointermove', { pointerId: 3, clientX: 700, clientY: 300 });
  assert.deepEqual([touch.lookDeltaX, touch.lookDeltaY], [20, -10]);
  view.lookZone.dispatch('pointerup', { pointerId: 2 });
  view.lookZone.dispatch('pointermove', { pointerId: 2, clientX: 400, clientY: 100 });
  assert.deepEqual([touch.lookDeltaX, touch.lookDeltaY], [20, -10], 'al soltar deja de mirar');
});

test('botones: romper se mantiene, colocar y menús actúan al tocar', () => {
  const { view, touch, opened } = controls();
  view.breakButton.dispatch('pointerdown', { pointerId: 4 });
  assert.equal(touch.isDown(TouchActions.BREAK), true);
  assert.ok(view.breakButton.classList.contains('is-pressed'));
  view.breakButton.dispatch('pointerup', { pointerId: 4 });
  assert.equal(touch.isDown(TouchActions.BREAK), false);

  view.jumpButton.dispatch('pointerdown', { pointerId: 5 });
  assert.equal(touch.isDown(InputActions.JUMP), true);
  view.jumpButton.dispatch('pointercancel', { pointerId: 5 });
  assert.equal(touch.isDown(InputActions.JUMP), false, 'cancelar el toque también suelta');

  // La acción va en el click (al levantar el dedo), no al apoyarlo.
  view.placeButton.dispatch('pointerdown', { pointerId: 6 });
  assert.equal(touch.wasJustPressed(TouchActions.PLACE), false);
  view.placeButton.dispatch('click', {});
  assert.equal(touch.wasJustPressed(TouchActions.PLACE), true);

  view.pauseButton.dispatch('click', {});
  assert.equal(touch.wasJustPressed(InputActions.PAUSE), true);
  view.inventoryButton.dispatch('click', {});
  view.blueprintsButton.dispatch('click', {});
  view.chatButton.dispatch('click', {});
  assert.deepEqual(opened, ['inventory', 'blueprints', 'chat']);

  view.breakButton.dispatch('pointerdown', { pointerId: 7 });
  view.setVisible(false);
  assert.equal(touch.isDown(TouchActions.BREAK), false, 'al salir del juego se suelta todo');
  assert.equal(view.element.hidden, true);
});

test('volar y bajar aparecen solo cuando corresponde', () => {
  const { view, touch } = controls();
  view.sync({ canFly: false, isFlying: false });
  assert.equal(view.flyButton.hidden, true, 'supervivencia: sin volar');
  assert.equal(view.descendButton.hidden, true);
  view.sync({ canFly: true, isFlying: false });
  assert.equal(view.flyButton.hidden, false);
  assert.equal(view.jumpLabel.textContent, 'Saltar');
  view.sync({ canFly: true, isFlying: true });
  assert.equal(view.descendButton.hidden, false);
  assert.equal(view.jumpLabel.textContent, 'Subir');
  view.descendButton.dispatch('pointerdown', { pointerId: 8 });
  view.sync({ canFly: true, isFlying: false });
  assert.equal(touch.isDown(TouchActions.DESCEND), false, 'al aterrizar se suelta bajar');
});

test('sin modo táctil los controles no se ven aunque se esté jugando', () => {
  document.body ??= document.createElement('body');
  const view = new TouchControls({ config: CONFIG });
  view.setVisible(true);
  assert.equal(view.element.hidden, true);
  view.setEnabled(true);
  assert.equal(view.element.hidden, false);
  assert.ok(document.body.classList.contains('nx-touch-mode'));
  view.setEnabled(false);
  assert.ok(!document.body.classList.contains('nx-touch-mode'));
});

test('en modo táctil el tutorial y "¿Cómo jugar?" hablan de botones', () => {
  const keyboard = TutorialPanel.defaultSteps('T');
  const touch = TutorialPanel.defaultSteps('T', { touch: true });
  assert.equal(touch.length, keyboard.length);
  assert.match(keyboard.find((step) => step.id === 'move').text, /W A S D/);
  assert.match(touch.find((step) => step.id === 'move').text, /joystick/);
  assert.match(touch.find((step) => step.id === 'break').text, /Romper/);
  assert.ok(touch.every((step) => !/clic|Esc\b|tecla/i.test(step.text)), 'sin teclas ni clics');

  const slides = HowToPlayScreen.defaultSlides('T', { touch: true });
  assert.ok(slides.every((slide) => !/\bclic|\bEsc\b|W A S D|con [EPT] /i.test(slide.text)), 'sin teclas ni clics');

  const hud = new HUD('ui-root');
  hud.setTouchMode(true);
  assert.equal(hud.isTouchMode, true);
  hud.tutorial.start();
  hud.tutorial.next();
  assert.match(hud.tutorial.textElement.textContent, /joystick/);
  assert.doesNotMatch(hud.tutorial.nextButton.textContent, /Enter/);
  hud.setClickToPlay(true);
  assert.equal(hud.clickToPlayElement.hidden, true, 'en táctil no hay "Hacé clic para jugar"');
  hud.screenManager.open('playing');
  assert.equal(hud.touchControls.element.hidden, false);
  assert.equal(hud.chatHintElement.hidden, true, 'sin "Presiona T"');
  hud.screenManager.open('pause');
  assert.equal(hud.touchControls.element.hidden, true);
});

test('el chat se puede cerrar con un botón (en celular no hay Escape)', async () => {
  const hud = new HUD('ui-root');
  hud.toggleChat();
  assert.equal(hud.chatPanel.isOpen, true);
  hud.chatPanel.closeButton.dispatch('click', {});
  assert.equal(hud.chatPanel.isOpen, false);
  // Abrir el chat enfoca el campo y carga el asistente en segundo plano.
  await new Promise((resolve) => setTimeout(resolve, 300));
});
