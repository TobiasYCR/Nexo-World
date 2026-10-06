/** Estados posibles del juego. */
export const GameStates = Object.freeze({
  LOADING: 'loading',
  RUNNING: 'running',
  PAUSED: 'paused'
});

/**
 * Máquina de estados mínima. Existe para que los sistemas consulten el estado
 * en lugar de leer banderas sueltas repartidas por Game.
 */
export class GameState {
  #current;
  #listeners = new Set();

  constructor(initial = GameStates.LOADING) {
    this.#current = initial;
  }

  get current() {
    return this.#current;
  }

  is(state) {
    return this.#current === state;
  }

  get isRunning() {
    return this.#current === GameStates.RUNNING;
  }

  get isPaused() {
    return this.#current === GameStates.PAUSED;
  }

  set(next) {
    if (next === this.#current) return;
    const previous = this.#current;
    this.#current = next;
    for (const listener of this.#listeners) listener(next, previous);
  }

  onChange(listener) {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }
}
