import { Screen } from '../../ui/Screen.js';
import { ScreenType } from '../../ui/ScreenType.js';
import { IntentBus } from '../../ui/IntentBus.js';
import { Modal } from '../components/Modal.js';
import { Button } from '../components/Button.js';
import { WorldCreationView } from '../../ui/WorldCreationView.js';

/**
 * Pantalla de Creación de Mundos.
 * Permite configurar un mundo nuevo con validación de nombre, semilla y modo de juego.
 */
export class WorldCreationScreen extends Screen {
  constructor(screenManager = null, intentBus = null) {
    super(ScreenType.WORLD_CREATION, screenManager, intentBus);
    this.#buildDOM();
  }

  #buildDOM() {
    this.element.className = 'screen screen-world-creation nx-modal-backdrop';

    this.modal = new Modal({
      title: 'Crear Nuevo Mundo',
      className: 'nx-world-creation-dialog',
      onClose: () => this.handleCancel()
    });

    this.worldCreationView = new WorldCreationView({
      onSubmit: (data) => this.#handleCreateWorld(data),
      onCancel: () => this.handleCancel()
    });

    this.modal.addBodyItem(this.worldCreationView.element);

    this.createBtn = new Button({
      text: 'CREAR MUNDO Y JUGAR',
      variant: 'primary',
      id: 'world-create-btn-submit',
      onClick: () => this.worldCreationView.submit()
    });

    this.cancelBtn = new Button({
      text: 'CANCELAR',
      variant: 'secondary',
      id: 'world-create-btn-cancel',
      onClick: () => this.handleCancel()
    });

    this.modal.addFooterItem(this.createBtn);
    this.modal.addFooterItem(this.cancelBtn);

    this.element.appendChild(this.modal.element);
  }

  #handleCreateWorld(worldData) {
    if (!worldData) return;

    if (this.intentBus) {
      this.intentBus.emit(IntentBus.Events.CREATE_WORLD, worldData);
      this.intentBus.emit(IntentBus.Events.SAVE_GAME, { slot: worldData.name });
      this.intentBus.emit(IntentBus.Events.SHOW_TOAST, {
        message: `Mundo "${worldData.name}" creado con éxito.`,
        type: 'success'
      });
      this.intentBus.emit(IntentBus.Events.START_GAME);
    }

    if (this.screenManager) {
      this.screenManager.open(ScreenType.PLAYING);
    }
  }

  handleCancel() {
    if (this.screenManager) {
      this.screenManager.back();
    }
  }

  show(params = {}) {
    super.show(params);
    setTimeout(() => {
      this.worldCreationView.focus();
    }, 50);
  }
}
