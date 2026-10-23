import { Screen } from '../../ui/Screen.js';
import { ScreenType } from '../../ui/ScreenType.js';
import { IntentBus } from '../../ui/IntentBus.js';
import { Modal } from '../components/Modal.js';
import { Button } from '../components/Button.js';
import { WorldSelectionView } from '../../ui/WorldSelectionView.js';
import { SaveManager } from '../../persistence/SaveManager.js';

/**
 * Pantalla de Selección de Mundos.
 * Permite listar partidas, cargar un mundo guardado, crear uno nuevo
 * o eliminar partidas existentes previa confirmación.
 */
export class WorldSelectionScreen extends Screen {
  #saveManager;

  /**
   * @param {SaveManager} [saveManager]
   * @param {import('../../ui/ScreenManager.js').ScreenManager} [screenManager]
   * @param {IntentBus} [intentBus]
   */
  constructor(saveManager = null, screenManager = null, intentBus = null) {
    super(ScreenType.WORLD_SELECTION, screenManager, intentBus);
    this.#saveManager = saveManager || new SaveManager();
    this.#buildDOM();
  }

  #buildDOM() {
    this.element.className = 'screen screen-world-selection nx-modal-backdrop';

    this.modal = new Modal({
      title: 'Seleccionar Mundo',
      className: 'nx-world-selection-dialog',
      onClose: () => this.handleBack()
    });

    this.worldSelectionView = new WorldSelectionView({
      onSelectWorld: (world) => this.#onPlayWorld(world),
      onCreateNew: () => this.#onCreateNewWorld(),
      onDeleteWorld: (world) => this.#onConfirmDeleteWorld(world)
    });

    this.modal.addBodyItem(this.worldSelectionView.element);

    // Botones del footer
    this.playBtn = new Button({
      text: 'JUGAR MUNDO SELECCIONADO',
      variant: 'primary',
      id: 'world-btn-play',
      onClick: () => {
        const world = this.worldSelectionView.selectedWorld;
        if (world && world.status === 'available') {
          this.#onPlayWorld(world);
        }
      }
    });

    this.createBtn = new Button({
      text: 'CREAR MUNDO NUEVO',
      variant: 'secondary',
      id: 'world-btn-create',
      onClick: () => this.#onCreateNewWorld()
    });

    this.backBtn = new Button({
      text: 'VOLVER AL MENÚ',
      variant: 'secondary',
      id: 'world-btn-back',
      onClick: () => this.handleBack()
    });

    this.modal.addFooterItem(this.playBtn);
    this.modal.addFooterItem(this.createBtn);
    this.modal.addFooterItem(this.backBtn);

    this.element.appendChild(this.modal.element);
  }

  #onPlayWorld(world) {
    if (!world || world.status !== 'available') return;

    if (this.intentBus) {
      this.intentBus.emit(IntentBus.Events.LOAD_GAME, { slot: world.slotName });
    }
    if (this.screenManager) {
      this.screenManager.open(ScreenType.PLAYING);
    }
  }

  #onCreateNewWorld() {
    if (this.intentBus) {
      this.intentBus.emit(IntentBus.Events.OPEN_SCREEN, { screen: ScreenType.WORLD_CREATION });
    }
    if (this.screenManager) {
      this.screenManager.open(ScreenType.WORLD_CREATION);
    }
  }

  #onConfirmDeleteWorld(world) {
    if (!world) return;

    // Crear diálogo de confirmación accesible
    const confirmModal = new Modal({
      title: '¿Eliminar Mundo?',
      className: 'nx-confirm-dialog',
      onClose: () => {
        confirmModal.element.parentNode?.removeChild(confirmModal.element);
      }
    });

    const msg = document.createElement('p');
    msg.className = 'nx-confirm-message';
    msg.textContent = `¿Estás seguro de que deseas eliminar permanentemente el mundo "${world.slotName}"? Esta acción no se puede deshacer.`;
    confirmModal.addBodyItem(msg);

    const deleteBtn = new Button({
      text: 'ELIMINAR DEFINITIVAMENTE',
      variant: 'danger',
      onClick: () => {
        this.#saveManager.delete(world.slotName);
        confirmModal.element.parentNode?.removeChild(confirmModal.element);
        this.worldSelectionView.refresh();
        if (this.intentBus) {
          this.intentBus.emit(IntentBus.Events.SHOW_TOAST, {
            message: `Mundo "${world.slotName}" eliminado.`,
            type: 'info'
          });
        }
      }
    });

    const cancelBtn = new Button({
      text: 'CANCELAR',
      variant: 'secondary',
      onClick: () => {
        confirmModal.element.parentNode?.removeChild(confirmModal.element);
      }
    });

    confirmModal.addFooterItem(deleteBtn);
    confirmModal.addFooterItem(cancelBtn);

    this.element.appendChild(confirmModal.element);
    setTimeout(() => cancelBtn.focus?.(), 50);
  }

  handleBack() {
    if (this.screenManager) {
      this.screenManager.back();
    }
  }

  show(params = {}) {
    super.show(params);
    this.worldSelectionView.refresh();
    setTimeout(() => {
      this.worldSelectionView.focus();
    }, 50);
  }
}
