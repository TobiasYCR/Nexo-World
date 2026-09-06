import { ScreenId } from './ScreenId.js';

/**
 * Mantiene una única pantalla activa a la vez y recuerda la anterior para
 * poder volver con back(). PLAYING es un caso especial: representa "sin
 * overlay" y no tiene una Screen registrada, por eso goTo(PLAYING) es válido
 * incluso sin registro previo.
 */
export class ScreenManager {
  #screens = new Map();
  #container;
  #activeId = null;
  #previousId = null;

  constructor(container) {
    this.#container = container;
  }

  register(screen) {
    screen.mount(this.#container);
    this.#screens.set(screen.id, screen);
  }

  goTo(id) {
    if (id === this.#activeId) return;

    const next = id === ScreenId.PLAYING ? null : this.#screens.get(id);
    if (id !== ScreenId.PLAYING && !next) {
      throw new Error(`ScreenManager: no hay ninguna pantalla registrada con id "${id}".`);
    }

    this.#screens.get(this.#activeId)?.hide();
    this.#previousId = this.#activeId;
    this.#activeId = id;
    next?.show();
  }

  /** Vuelve a la pantalla anterior. No hace nada si no hay historial. */
  back() {
    if (this.#previousId === null) return;
    this.goTo(this.#previousId);
  }

  get activeId() {
    return this.#activeId;
  }

  get previousId() {
    return this.#previousId;
  }
}
