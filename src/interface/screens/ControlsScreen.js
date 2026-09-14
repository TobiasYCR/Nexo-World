import { Screen } from '../../ui/Screen.js';
import { ScreenType } from '../../ui/ScreenType.js';
import { Modal } from '../components/Modal.js';
import { Button } from '../components/Button.js';
import { GameConfig } from '../../game/GameConfig.js';
import { InputActions } from '../../utils/Constants.js';

/**
 * Pantalla de Controles / Ayuda.
 * Muestra el listado categorizado de acciones y teclas mapeadas en el juego,
 * derivándolas dinámicamente de GameConfig.
 */
export class ControlsScreen extends Screen {
  constructor(screenManager = null, intentBus = null) {
    super(ScreenType.CONTROLS, screenManager, intentBus);
    this.#buildDOM();
  }

  #buildDOM() {
    this.element.className = 'screen screen-controls nx-modal-backdrop';

    this.modal = new Modal({
      title: 'Controles',
      className: 'nx-controls-dialog',
      onClose: () => this.handleBack()
    });

    const groups = this.#buildControlGroups();

    for (const group of groups) {
      const groupElem = document.createElement('div');
      groupElem.className = 'nx-controls-group';

      const titleElem = document.createElement('h3');
      titleElem.className = 'nx-controls-group-title';
      titleElem.textContent = group.category.toUpperCase();
      groupElem.appendChild(titleElem);

      const listElem = document.createElement('div');
      listElem.className = 'nx-controls-list';

      for (const item of group.items) {
        const row = document.createElement('div');
        row.className = 'nx-control-row';

        const label = document.createElement('span');
        label.className = 'nx-control-name';
        label.textContent = item.label;

        const badge = document.createElement('kbd');
        badge.className = 'nx-key-badge';
        badge.textContent = item.key;

        row.appendChild(label);
        row.appendChild(badge);
        listElem.appendChild(row);
      }

      groupElem.appendChild(listElem);
      this.modal.addBodyItem(groupElem);
    }

    this.backBtn = new Button({
      text: 'VOLVER',
      variant: 'primary',
      id: 'controls-btn-back',
      onClick: () => this.handleBack()
    });

    this.modal.addFooterItem(this.backBtn);
    this.element.appendChild(this.modal.element);
  }

  #buildControlGroups() {
    // Derivación dinámica de teclas desde GameConfig
    const bindings = GameConfig?.input?.KEY_BINDINGS ?? {};
    const keyFor = (action, fallback) => {
      for (const [code, act] of Object.entries(bindings)) {
        if (act === action) {
          return this.#humanizeKey(code);
        }
      }
      return fallback;
    };

    return [
      {
        category: 'Movimiento',
        items: [
          { label: 'Adelante', key: keyFor(InputActions.MOVE_FORWARD, 'W') },
          { label: 'Atrás', key: keyFor(InputActions.MOVE_BACKWARD, 'S') },
          { label: 'Izquierda', key: keyFor(InputActions.MOVE_LEFT, 'A') },
          { label: 'Derecha', key: keyFor(InputActions.MOVE_RIGHT, 'D') },
          { label: 'Saltar', key: keyFor(InputActions.JUMP, 'Espacio') },
          { label: 'Correr', key: keyFor(InputActions.SPRINT, 'Shift') }
        ]
      },
      {
        category: 'Interacción',
        items: [
          { label: 'Romper bloque', key: 'Click izq.' },
          { label: 'Colocar bloque', key: 'Click der.' },
          { label: 'Seleccionar hotbar', key: '1 .. 9' }
        ]
      },
      {
        category: 'Interfaz',
        items: [
          { label: 'Inventario', key: 'E' },
          { label: 'Configuración', key: 'O' },
          { label: 'Controles / ayuda', key: 'F1' },
          { label: 'Panel de debug', key: keyFor(InputActions.TOGGLE_DEBUG, 'F3') },
          { label: 'Cerrar pantalla', key: keyFor(InputActions.PAUSE, 'Esc') }
        ]
      }
    ];
  }

  #humanizeKey(code) {
    if (code.startsWith('Key')) return code.slice(3);
    if (code.startsWith('Digit')) return code.slice(5);
    if (code === 'Space') return 'Espacio';
    if (code === 'ShiftLeft' || code === 'ShiftRight') return 'Shift';
    if (code === 'Escape') return 'Esc';
    return code;
  }

  handleBack() {
    if (this.screenManager) {
      this.screenManager.back();
    }
  }

  show(params = {}) {
    super.show(params);
    setTimeout(() => this.backBtn?.focus?.(), 50);
  }
}
