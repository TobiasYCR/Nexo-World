import { Screen } from '../../ui/Screen.js';
import { ScreenType } from '../../ui/ScreenType.js';
import { IntentBus } from '../../ui/IntentBus.js';
import { Modal } from '../components/Modal.js';
import { Button } from '../components/Button.js';
import { WorldCreationView } from '../../ui/WorldCreationView.js';
import { SaveManager } from '../../persistence/SaveManager.js';

/**
 * Pantalla de Creación de Mundos.
 * Permite configurar un mundo nuevo con validación de nombre, semilla y modo de juego.
 * El nombre no puede repetir el de un mundo guardado.
 *
 * Con show({ mode: 'saveAs' }) solo pide el nombre: sirve para guardar por
 * primera vez un mundo que se empezó sin nombre.
 */
export class WorldCreationScreen extends Screen {
  static Modes = Object.freeze({ CREATE: 'create', SAVE_AS: 'saveAs' });

  #saveManager;
  #mode = WorldCreationScreen.Modes.CREATE;

  constructor(screenManager = null, intentBus = null, saveManager = null) {
    super(ScreenType.WORLD_CREATION, screenManager, intentBus);
    this.#saveManager = saveManager || new SaveManager();
    this.#buildDOM();
  }

  get mode() {
    return this.#mode;
  }

  #buildDOM() {
    this.element.className = 'screen screen-world-creation nx-modal-backdrop';

    this.modal = new Modal({
      title: 'Crear Nuevo Mundo',
      className: 'nx-world-creation-dialog',
      onClose: () => this.handleCancel()
    });

    this.worldCreationView = new WorldCreationView({
      onSubmit: (data) => this.#handleSubmit(data),
      onCancel: () => this.handleCancel(),
      isNameTaken: (name) => this.#saveManager.findSlot(name) !== null
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

  #handleSubmit(data) {
    if (this.#mode === WorldCreationScreen.Modes.SAVE_AS) this.#handleSaveAs(data);
    else this.#handleCreateWorld(data);
  }

  #handleSaveAs(data) {
    if (!data) return;
    this.intentBus?.emit(IntentBus.Events.SAVE_GAME, { slot: data.name });
    this.screenManager?.back();
  }

  #handleCreateWorld(worldData) {
    if (!worldData) return;

    if (this.intentBus) {
      const request = { ...worldData, result: null };
      this.intentBus.emit(IntentBus.Events.CREATE_WORLD, request);
      // GameUiBridge deja el resultado en request.result; si falló, ya mostró el motivo.
      if (request.result && !request.result.ok) return;
      this.intentBus.emit(IntentBus.Events.SAVE_GAME, { slot: worldData.name, silent: true });
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
    const saveAs = params?.mode === WorldCreationScreen.Modes.SAVE_AS;
    this.#mode = saveAs ? WorldCreationScreen.Modes.SAVE_AS : WorldCreationScreen.Modes.CREATE;
    this.modal.setTitle(saveAs ? 'Guardar mundo' : 'Crear Nuevo Mundo');
    this.createBtn.element.textContent = saveAs ? 'GUARDAR MUNDO' : 'CREAR MUNDO Y JUGAR';
    this.worldCreationView.setNameOnly(saveAs);
    // Si el nombre propuesto ya está guardado, el aviso aparece de entrada.
    this.worldCreationView.validate();
    setTimeout(() => {
      this.worldCreationView.focus();
    }, 50);
  }
}
