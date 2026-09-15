import { Screen } from '../../ui/Screen.js';
import { ScreenType } from '../../ui/ScreenType.js';
import { IntentBus } from '../../ui/IntentBus.js';
import { Modal } from '../components/Modal.js';
import { Slider } from '../components/Slider.js';
import { Toggle } from '../components/Toggle.js';
import { Button } from '../components/Button.js';
import { SettingsModel } from '../models/SettingsModel.js';

/**
 * Pantalla de Configuración.
 * Permite ajustar sensibilidad, distancia de render, volumen, FOV y debug overlay,
 * con persistencia y restauración de valores por defecto.
 */
export class SettingsScreen extends Screen {
  #controls = {};

  /**
   * @param {SettingsModel} [model]
   * @param {import('../../ui/ScreenManager.js').ScreenManager} [screenManager]
   * @param {IntentBus} [intentBus]
   */
  constructor(model = null, screenManager = null, intentBus = null) {
    super(ScreenType.SETTINGS, screenManager, intentBus);
    this.model = model || new SettingsModel();
    this.#buildDOM();
    this.#bindModel();
  }

  #buildDOM() {
    this.element.className = 'screen screen-settings nx-modal-backdrop';

    this.modal = new Modal({
      title: 'Configuración',
      className: 'nx-settings-dialog',
      onClose: () => this.handleBack()
    });

    // Construcción de controles usando el schema del modelo
    const schema = this.model.schema;

    // Sensibilidad del mouse
    this.#controls.mouseSensitivity = new Slider({
      label: schema.mouseSensitivity.label,
      min: schema.mouseSensitivity.min,
      max: schema.mouseSensitivity.max,
      step: schema.mouseSensitivity.step,
      value: this.model.get('mouseSensitivity'),
      formatter: schema.mouseSensitivity.formatter,
      disabled: schema.mouseSensitivity.disabled,
      onChange: (val) => this.#onSettingChange('mouseSensitivity', val)
    });
    this.modal.addBodyItem(this.#controls.mouseSensitivity);

    // Distancia de render
    this.#controls.renderDistance = new Slider({
      label: schema.renderDistance.label,
      min: schema.renderDistance.min,
      max: schema.renderDistance.max,
      step: schema.renderDistance.step,
      value: this.model.get('renderDistance'),
      formatter: schema.renderDistance.formatter,
      disabled: schema.renderDistance.disabled,
      disabledNote: schema.renderDistance.disabledNote,
      onChange: (val) => this.#onSettingChange('renderDistance', val)
    });
    this.modal.addBodyItem(this.#controls.renderDistance);

    // Volumen maestro
    this.#controls.masterVolume = new Slider({
      label: schema.masterVolume.label,
      min: schema.masterVolume.min,
      max: schema.masterVolume.max,
      step: schema.masterVolume.step,
      value: this.model.get('masterVolume'),
      formatter: schema.masterVolume.formatter,
      disabled: schema.masterVolume.disabled,
      onChange: (val) => this.#onSettingChange('masterVolume', val)
    });
    this.modal.addBodyItem(this.#controls.masterVolume);

    // FOV
    this.#controls.fov = new Slider({
      label: schema.fov.label,
      min: schema.fov.min,
      max: schema.fov.max,
      step: schema.fov.step,
      value: this.model.get('fov'),
      formatter: schema.fov.formatter,
      disabled: schema.fov.disabled,
      onChange: (val) => this.#onSettingChange('fov', val)
    });
    this.modal.addBodyItem(this.#controls.fov);

    // Panel de debug
    this.#controls.showDebug = new Toggle({
      label: schema.showDebug.label,
      checked: this.model.get('showDebug'),
      disabled: schema.showDebug.disabled,
      onChange: (checked) => this.#onSettingChange('showDebug', checked)
    });
    this.modal.addBodyItem(this.#controls.showDebug);

    // Botones del pie
    this.resetBtn = new Button({
      text: 'RESTAURAR VALORES POR DEFECTO',
      variant: 'secondary',
      id: 'settings-btn-reset',
      onClick: () => this.handleReset()
    });

    this.backBtn = new Button({
      text: 'VOLVER',
      variant: 'primary',
      id: 'settings-btn-back',
      onClick: () => this.handleBack()
    });

    this.modal.addFooterItem(this.resetBtn);
    this.modal.addFooterItem(this.backBtn);

    this.element.appendChild(this.modal.element);
  }

  #bindModel() {
    this.model.subscribe((key, value) => {
      this.#syncControl(key, value);
    });
  }

  #onSettingChange(key, value) {
    this.model.set(key, value);
    if (this.intentBus) {
      this.intentBus.emit(IntentBus.Events.SETTINGS_CHANGED, { key, value });
    }
  }

  #syncControl(key, value) {
    const control = this.#controls[key];
    if (!control) return;

    if (control instanceof Slider) {
      control.setValue(value);
    } else if (control instanceof Toggle) {
      control.setChecked(value);
    }
  }

  handleReset() {
    this.model.resetToDefaults();
    if (this.intentBus) {
      this.intentBus.emit(IntentBus.Events.RESTORE_DEFAULTS);
    }
  }

  handleBack() {
    if (this.screenManager) {
      this.screenManager.back();
    }
  }

  show(params = {}) {
    super.show(params);
    // Sincronizar todos los valores al mostrar
    for (const [key, val] of Object.entries(this.model.getAll())) {
      this.#syncControl(key, val);
    }
    setTimeout(() => this.backBtn?.focus?.(), 50);
  }
}
