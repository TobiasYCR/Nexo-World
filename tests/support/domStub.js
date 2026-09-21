/**
 * Dobles mínimos de DOM y de p5 para poder ejercer el ciclo completo de Game en
 * Node, sin navegador. No emulan render real: verifican el cableado entre
 * sistemas y que ningún frame lance excepciones.
 */

class FakeElement {
  constructor(tagName = 'div') {
    this.tagName = tagName;
    this.className = '';
    this.textContent = '';
    this.hidden = false;
    this.children = [];
    this.listeners = new Map();
  }

  appendChild(child) {
    this.children.push(child);
    return child;
  }

  addEventListener(type, handler) {
    if (!this.listeners.has(type)) this.listeners.set(type, []);
    this.listeners.get(type).push(handler);
  }

  removeEventListener(type, handler) {
    const handlers = this.listeners.get(type) ?? [];
    const index = handlers.indexOf(handler);
    if (index >= 0) handlers.splice(index, 1);
  }

  dispatch(type, event = {}) {
    for (const handler of this.listeners.get(type) ?? []) handler(event);
  }

  requestPointerLock() {
    globalThis.document.pointerLockElement = this;
    globalThis.document.dispatch('pointerlockchange');
  }
}

export function installDomStub() {
  const uiRoot = new FakeElement('div');
  const document = new FakeElement('#document');
  document.createElement = (tagName) => new FakeElement(tagName);
  document.getElementById = (id) => (id === 'ui-root' ? uiRoot : null);
  document.pointerLockElement = null;
  document.exitPointerLock = () => {
    document.pointerLockElement = null;
    document.dispatch('pointerlockchange');
  };

  const window = new FakeElement('#window');

  globalThis.document = document;
  globalThis.window = window;

  return { document, window, uiRoot, canvas: new FakeElement('canvas') };
}

export function uninstallDomStub() {
  delete globalThis.document;
  delete globalThis.window;
}

/** Doble de p5 que cuenta las primitivas de dibujo emitidas por frame. */
export function createP5Stub() {
  const calls = { box: 0, camera: 0, background: 0, material: 0 };
  const noop = () => {};

  return {
    calls,
    width: 1280,
    height: 720,
    deltaTime: 16,
    frameRate: () => 60,
    resizeCanvas: noop,
    background: () => { calls.background += 1; },
    perspective: noop,
    frustum: noop,
    camera: () => { calls.camera += 1; },
    ambientLight: noop,
    directionalLight: noop,
    push: noop,
    pop: noop,
    noStroke: noop,
    translate: noop,
    texture: noop,
    fill: noop,
    ambientMaterial: () => { calls.material += 1; },
    box: () => { calls.box += 1; },
    loadImage: (_path, _onLoad, onError) => onError(new Error('sin texturas en el test'))
  };
}
