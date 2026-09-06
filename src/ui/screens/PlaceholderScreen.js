import { Screen } from '../navigation/Screen.js';
import { UIIntent } from '../navigation/UIIntent.js';
import { ScreenUI } from './ScreenUI.js';

/**
 * Pantalla temporal para Configuración y Controles, solo para poder probar
 * el flujo de navegación completo. Frontend 2 la reemplaza por su propio
 * contenido; el contrato que usa (id ya registrado en ScreenId + intención
 * BACK) no cambia cuando eso pase.
 */
export class PlaceholderScreen extends Screen {
  constructor(id, title, intentBus) {
    super(id);
    this.title = title;
    this.intentBus = intentBus;
  }

  build() {
    const panel = ScreenUI.createPanel();
    panel.appendChild(ScreenUI.createTitle(this.title));
    panel.appendChild(ScreenUI.createNote('Pantalla pendiente de contenido (Frontend 2).'));
    panel.appendChild(
      ScreenUI.createButton('Volver', () => this.intentBus.emit(UIIntent.BACK), 'menu-button--secondary')
    );
    this.element.appendChild(panel);
  }
}
