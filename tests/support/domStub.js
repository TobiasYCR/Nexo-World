/**
 * Dobles mínimos de DOM y de p5 para poder ejercer el ciclo completo de Game en
 * Node, sin navegador. No emulan render real: verifican el cableado entre
 * sistemas y que ningún frame lance excepciones.
 */

class FakeClassList {
  constructor(element) {
    this.element = element;
  }

  get #classes() {
    return this.element.className ? this.element.className.split(/\s+/).filter(Boolean) : [];
  }

  set #classes(list) {
    this.element.className = list.join(' ');
  }

  add(...names) {
    const list = this.#classes;
    for (const name of names) {
      if (!list.includes(name)) list.push(name);
    }
    this.#classes = list;
  }

  remove(...names) {
    let list = this.#classes;
    list = list.filter((c) => !names.includes(c));
    this.#classes = list;
  }

  toggle(name, force) {
    const exists = this.contains(name);
    const shouldHave = force !== undefined ? Boolean(force) : !exists;
    if (shouldHave && !exists) {
      this.add(name);
    } else if (!shouldHave && exists) {
      this.remove(name);
    }
    return shouldHave;
  }

  contains(name) {
    return this.#classes.includes(name);
  }
}

class FakeElement {
  #innerHTML = '';
  #textContent = '';

  constructor(tagName = 'div') {
    this.tagName = tagName.toUpperCase();
    this.className = '';
    this.hidden = false;
    this.children = [];
    this.listeners = new Map();
    this.attributes = new Map();
    this.dataset = {};
    this.style = {};
    this.classList = new FakeClassList(this);
    this.parentNode = null;
    this.scrollTop = 0;
  }

  get innerHTML() {
    return this.#innerHTML;
  }

  set innerHTML(val) {
    this.#innerHTML = val;
    if (val === '') {
      this.children = [];
    }
  }

  get textContent() {
    if (this.#textContent) return this.#textContent;
    if (this.children.length > 0) {
      return this.children.map((c) => c.textContent).join(' ');
    }
    return '';
  }

  set textContent(val) {
    this.#textContent = String(val ?? '');
  }

  appendChild(child) {
    if (child) {
      child.parentNode = this;
      this.children.push(child);
    }
    return child;
  }

  removeChild(child) {
    const idx = this.children.indexOf(child);
    if (idx >= 0) {
      this.children.splice(idx, 1);
      child.parentNode = null;
    }
    return child;
  }

  /** Varios hijos de una vez, como el append() del DOM real. */
  append(...nodes) {
    for (const node of nodes) this.appendChild(node);
  }

  /** Se quita a sí mismo de su padre, como el remove() del DOM real. */
  remove() {
    this.parentNode?.removeChild(this);
  }

  get firstChild() {
    return this.children[0] ?? null;
  }

  /** El scroll no se simula: alcanza con que escribirlo no falle. */
  get scrollHeight() {
    return this.children.length;
  }

  setAttribute(name, value) {
    this.attributes.set(name, String(value));
  }

  getAttribute(name) {
    return this.attributes.has(name) ? this.attributes.get(name) : null;
  }

  removeAttribute(name) {
    this.attributes.delete(name);
  }

  focus() {
    if (globalThis.document) {
      globalThis.document.activeElement = this;
    }
  }

  blur() {
    if (globalThis.document && globalThis.document.activeElement === this) {
      globalThis.document.activeElement = null;
    }
  }

  querySelector(selector) {
    return this.querySelectorAll(selector)[0] || null;
  }

  querySelectorAll(selector) {
    const results = [];
    const check = (el) => {
      if (selector.startsWith('.') && el.classList?.contains(selector.slice(1))) {
        results.push(el);
      } else if (selector.startsWith('#') && el.id === selector.slice(1)) {
        results.push(el);
      } else if (selector.toUpperCase() === el.tagName) {
        results.push(el);
      }
      for (const child of el.children) {
        check(child);
      }
    };
    for (const child of this.children) {
      check(child);
    }
    return results;
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
  uiRoot.id = 'ui-root';

  const document = new FakeElement('#document');
  document.createElement = (tagName) => new FakeElement(tagName);
  document.getElementById = (id) => (id === 'ui-root' ? uiRoot : null);
  document.pointerLockElement = null;
  document.activeElement = null;
  document.exitPointerLock = () => {
    document.pointerLockElement = null;
    document.dispatch('pointerlockchange');
  };

  const window = new FakeElement('#window');
  window.localStorage = {
    _data: new Map(),
    get length() { return this._data.size; },
    key(i) { return Array.from(this._data.keys())[i] || null; },
    getItem(k) { return this._data.has(k) ? this._data.get(k) : null; },
    setItem(k, v) { this._data.set(k, String(v)); },
    removeItem(k) { this._data.delete(k); },
    clear() { this._data.clear(); }
  };

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
  const calls = { box: 0, camera: 0, background: 0, material: 0, clearDepth: 0 };
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
    noFill: noop,
    stroke: noop,
    strokeWeight: noop,
    translate: noop,
    clearDepth: () => { calls.clearDepth += 1; },
    texture: noop,
    fill: noop,
    ambientMaterial: () => { calls.material += 1; },
    box: () => { calls.box += 1; },
    loadImage: (_path, _onLoad, onError) => onError(new Error('sin texturas en el test'))
  };
}
