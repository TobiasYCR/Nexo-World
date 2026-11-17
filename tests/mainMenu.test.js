import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { installDomStub, uninstallDomStub } from './support/domStub.js';
import { HowToPlayScreen } from '../src/interface/screens/HowToPlayScreen.js';
import { MenuScenery } from '../src/ui/MenuScenery.js';
import { MenuScreen } from '../src/ui/MenuScreen.js';
import { ScreenManager } from '../src/ui/ScreenManager.js';
import { ScreenType } from '../src/ui/ScreenType.js';
import { IntentBus } from '../src/ui/IntentBus.js';
import { HUD } from '../src/ui/HUD.js';

beforeEach(() => installDomStub());
afterEach(() => uninstallDomStub());

test('"¿Cómo jugar?" pasa las imágenes con flechas, teclado y puntos sin salirse de los bordes', () => {
  const screen = new HowToPlayScreen();
  const count = screen.slideCount;
  assert.ok(count >= 5);
  assert.equal(screen.slideIndex, 0);
  assert.equal(screen.previousBtn.disabled, true, 'en la primera no hay anterior');
  assert.match(screen.imageElement.src, /^\/images\/how-to-play\/.+\.jpg$/);

  screen.nextBtn.dispatch('click');
  assert.equal(screen.slideIndex, 1);
  assert.equal(screen.previousBtn.disabled, false);
  const second = screen.imageElement.src;

  screen.onKeyDown({ key: 'ArrowRight' });
  assert.equal(screen.slideIndex, 2);
  assert.notEqual(screen.imageElement.src, second);
  screen.onKeyDown({ key: 'ArrowLeft' });
  assert.equal(screen.slideIndex, 1);

  screen.dots[count - 1].dispatch('click');
  assert.equal(screen.slideIndex, count - 1);
  assert.equal(screen.nextBtn.disabled, true, 'en la última no hay siguiente');
  screen.next();
  assert.equal(screen.slideIndex, count - 1);
  assert.ok(screen.dots[count - 1].classList.contains('is-active'));

  screen.show();
  assert.equal(screen.slideIndex, 0, 'al abrir empieza desde la primera');
});

test('cada diapositiva tiene su imagen en assets/images/how-to-play', () => {
  for (const slide of HowToPlayScreen.defaultSlides()) {
    assert.ok(existsSync(new URL(`../assets/images/how-to-play/${slide.image}`, import.meta.url)), slide.image);
    assert.ok(slide.title && slide.text.length > 20);
  }
  assert.ok(existsSync(new URL('../assets/images/menu-background.jpg', import.meta.url)));
});

test('el fondo fijo se ve en el menú y se oculta al jugar', () => {
  const container = document.getElementById('ui-root');
  const intentBus = new IntentBus();
  const screens = new ScreenManager(container, intentBus);
  screens.register(ScreenType.MENU, new MenuScreen(screens, intentBus));
  for (const type of [ScreenType.PLAYING, ScreenType.SETTINGS]) {
    screens.register(type, { show() {}, hide() {}, mount() {}, onKeyDown() {} });
  }
  const scenery = new MenuScenery();
  scenery.mount(container);
  scenery.bind(screens);
  const changes = [];
  scenery.onChange((visible) => changes.push(visible));

  assert.equal(scenery.isVisible, true, 'arranca visible');
  assert.match(scenery.element.style.backgroundImage, /menu-background\.jpg/);
  screens.open(ScreenType.SETTINGS);
  assert.equal(scenery.isVisible, true, 'las pantallas que se abren desde el menú lo mantienen');
  screens.open(ScreenType.PLAYING);
  assert.equal(scenery.isVisible, false);
  assert.equal(scenery.element.hidden, true);
  screens.open(ScreenType.SETTINGS);
  assert.equal(scenery.isVisible, false, 'desde la partida se sigue viendo el mundo');
  screens.open(ScreenType.MENU);
  assert.equal(scenery.isVisible, true);
  assert.deepEqual(changes, [true, false, true]);
});

test('el menú principal abre "¿Cómo jugar?"', () => {
  const hud = new HUD('ui-root');
  assert.ok(hud.screenManager.get(ScreenType.HOW_TO_PLAY));
  hud.menuScreen.howToPlayBtn.dispatch('click');
  assert.equal(hud.screenManager.currentScreenType, ScreenType.HOW_TO_PLAY);
  assert.equal(hud.menuScenery.isVisible, true);
});
