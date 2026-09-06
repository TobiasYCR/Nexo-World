import { Screen } from '../navigation/Screen.js';
import { ScreenId } from '../navigation/ScreenId.js';
import { UIIntent } from '../navigation/UIIntent.js';
import { ScreenUI } from './ScreenUI.js';

/** Overlay de pausa: reanudar la partida o volver al menú sin cerrarla. */
export class PauseScreen extends Screen {
  constructor(intentBus) {
    super(ScreenId.PAUSE);
    this.intentBus = intentBus;
  }

  build() {
    const panel = ScreenUI.createPanel();
    panel.appendChild(ScreenUI.createTitle('Pausa'));
    panel.appendChild(ScreenUI.createButton('Reanudar', () => this.intentBus.emit(UIIntent.RESUME)));
    panel.appendChild(
      ScreenUI.createButton(
        'Volver al menú',
        () => this.intentBus.emit(UIIntent.RETURN_TO_MENU),
        'menu-button--secondary'
      )
    );
    this.element.appendChild(panel);
  }
}
