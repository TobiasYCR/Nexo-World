import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { installDomStub, uninstallDomStub } from './support/domStub.js';

let TutorialPanel;

beforeEach(async () => {
  installDomStub();
  ({ TutorialPanel } = await import('../src/ui/TutorialPanel.js'));
});

afterEach(() => {
  uninstallDomStub();
});

const { Signals } = await import('../src/ui/TutorialPanel.js').then((m) => m.TutorialPanel);

test('el tutorial explica lo básico: moverse, romper, elegir, colocar, menú, planos y ayuda', () => {
  const ids = TutorialPanel.defaultSteps().map((step) => step.id);
  assert.deepEqual(ids, ['welcome', 'move', 'break', 'select', 'place', 'menu', 'blueprint', 'guide', 'help']);
  const text = TutorialPanel.defaultSteps('T').map((step) => step.text).join(' ');
  for (const hint of ['W A S D', 'clic izquierdo', 'clic derecho', 'Esc', 'P', 'Apretá T']) {
    assert.ok(text.includes(hint), `menciona ${hint}`);
  }
});

test('cada paso avanza solo cuando el jugador hace lo que pide', () => {
  const tutorial = new TutorialPanel();
  tutorial.start();
  tutorial.setVisible(true);
  assert.equal(tutorial.element.hidden, false);
  assert.equal(tutorial.currentStep.id, 'welcome');
  tutorial.notify(Signals.BLOCK_BROKEN);
  assert.equal(tutorial.currentStep.id, 'welcome', 'una señal que no corresponde no avanza');
  tutorial.next();

  // Caminar 3 bloques completa el paso de moverse.
  tutorial.update({ position: { x: 0, z: 0 } }, null, 20);
  tutorial.update({ position: { x: 40, z: 0 } }, null, 20);
  assert.equal(tutorial.currentStep.id, 'move');
  tutorial.update({ position: { x: 61, z: 0 } }, null, 20);
  assert.equal(tutorial.currentStep.id, 'break');

  tutorial.notify(Signals.BLOCK_BROKEN);
  assert.equal(tutorial.currentStep.id, 'select');
  tutorial.update(null, { selectedIndex: 0 });
  tutorial.update(null, { selectedIndex: 3 });
  assert.equal(tutorial.currentStep.id, 'place');
  tutorial.notify(Signals.BLOCK_PLACED);
  tutorial.notify(Signals.PAUSE_OPENED);
  tutorial.notify(Signals.CHALLENGE_STARTED);
  tutorial.notify(Signals.CHALLENGE_COMPLETED);
  assert.equal(tutorial.currentStep.id, 'help');
});

test('se puede saltar un paso, volver atrás o saltar todo el tutorial', () => {
  let finished = null;
  const tutorial = new TutorialPanel({ onFinish: (reason) => { finished = reason; } });
  tutorial.start();
  tutorial.setVisible(true);
  tutorial.nextButton.dispatch('click', {});
  tutorial.nextButton.dispatch('click', {});
  assert.equal(tutorial.currentStep.id, 'break', 'saltar paso');
  assert.match(tutorial.nextButton.textContent, /Saltar paso/);
  tutorial.previousButton.dispatch('click', {});
  assert.equal(tutorial.currentStep.id, 'move');

  tutorial.skipAllButton.dispatch('click', {});
  assert.equal(tutorial.isActive, false);
  assert.equal(tutorial.element.hidden, true);
  assert.equal(finished, 'skipped');
});

test('al terminar el último paso avisa que se completó', () => {
  let finished = null;
  const tutorial = new TutorialPanel({ onFinish: (reason) => { finished = reason; } });
  tutorial.start();
  for (let step = 0; step < tutorial.stepCount; step += 1) tutorial.next();
  assert.equal(finished, 'completed');
  assert.equal(tutorial.isActive, false);
});

test('solo se ve mientras se juega', () => {
  const tutorial = new TutorialPanel();
  tutorial.start();
  tutorial.setVisible(false);
  assert.equal(tutorial.element.hidden, true);
  tutorial.setVisible(true);
  assert.equal(tutorial.element.hidden, false);
});
