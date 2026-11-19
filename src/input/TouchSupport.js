import { GameConfig } from '../game/GameConfig.js';

/**
 * Decide si se usan los controles táctiles.
 *
 * En modo 'auto' se activan cuando el dispositivo tiene pantalla táctil y
 * ningún puntero fino (mouse o trackpad): celulares y tablets sin mouse. Una
 * notebook con pantalla táctil sigue con teclado y mouse.
 */
export class TouchSupport {
  /**
   * @param {Object} [options]
   * @param {'auto'|'on'|'off'} [options.mode]
   * @param {Window} [options.win]
   */
  static shouldUseTouch({ mode = GameConfig.touch.MODE, win = globalThis.window } = {}) {
    const forced = TouchSupport.#urlOverride(win);
    if (forced !== null) return forced;
    if (mode === 'on') return true;
    if (mode === 'off') return false;
    return TouchSupport.isTouchOnlyDevice(win);
  }

  static isTouchOnlyDevice(win = globalThis.window) {
    if (!win) return false;
    const matches = (query) => {
      try {
        return Boolean(win.matchMedia?.(query)?.matches);
      } catch {
        return false;
      }
    };
    const hasTouch = (win.navigator?.maxTouchPoints ?? 0) > 0 || 'ontouchstart' in win;
    return hasTouch && matches('(pointer: coarse)') && !matches('(any-pointer: fine)');
  }

  /** ?touch=1 fuerza los controles táctiles y ?touch=0 los apaga (útil para probar). */
  static #urlOverride(win) {
    try {
      const value = new URLSearchParams(win?.location?.search ?? '').get('touch');
      if (value === '1') return true;
      if (value === '0') return false;
    } catch {
      // Sin location (tests): sin override.
    }
    return null;
  }
}
