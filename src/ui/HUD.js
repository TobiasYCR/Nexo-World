import { Crosshair } from './Crosshair.js';
import { DebugOverlay } from './DebugOverlay.js';

/**
 * Capa de interfaz durante la partida. Vive en el DOM, por encima del canvas:
 * así el texto usa el renderizado nativo del navegador y la UI puede migrarse a
 * React más adelante sin tocar el motor.
 *
 * HUD solo muestra datos que le pasan; nunca consulta el mundo por su cuenta.
 */
export class HUD {
  constructor(containerId = 'ui-root') {
    this.container = document.getElementById(containerId);
    if (!this.container) {
      throw new Error(`No existe el contenedor de interfaz "#${containerId}".`);
    }

    this.crosshair = new Crosshair();
    this.debugOverlay = new DebugOverlay();
  }

  mount() {
    this.crosshair.mount(this.container);
    this.debugOverlay.mount(this.container);
  }

  toggleDebug() {
    this.debugOverlay.toggle();
  }

  update(deltaTime, stats) {
    this.debugOverlay.update(deltaTime, stats);
  }
}
