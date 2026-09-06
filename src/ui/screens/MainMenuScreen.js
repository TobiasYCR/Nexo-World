import { Screen } from '../navigation/Screen.js';
import { ScreenId } from '../navigation/ScreenId.js';
import { UIIntent } from '../navigation/UIIntent.js';
import { ScreenUI } from './ScreenUI.js';

/**
 * Pantalla inicial. El mundo sigue generándose y renderizando detrás (Game no
 * se detiene); esta pantalla solo cubre el canvas con un panel en DOM hasta
 * que el usuario elige "Jugar".
 */
export class MainMenuScreen extends Screen {
  constructor(intentBus) {
    super(ScreenId.MENU);
    this.intentBus = intentBus;
  }

  build() {
    const panel = ScreenUI.createPanel();
    panel.appendChild(ScreenUI.createTitle('Nexo World'));
    panel.appendChild(ScreenUI.createButton('Jugar', () => this.intentBus.emit(UIIntent.PLAY)));
    panel.appendChild(
      ScreenUI.createButton('Configuración', () => this.intentBus.emit(UIIntent.OPEN_SETTINGS))
    );
    panel.appendChild(
      ScreenUI.createButton('Controles', () => this.intentBus.emit(UIIntent.OPEN_CONTROLS))
    );
    this.element.appendChild(panel);
  }
}
