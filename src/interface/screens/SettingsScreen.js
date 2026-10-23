import { Screen } from '../../ui/Screen.js';
import { ScreenType } from '../../ui/ScreenType.js';
import { IntentBus } from '../../ui/IntentBus.js';
import { Modal } from '../components/Modal.js';
import { Slider } from '../components/Slider.js';
import { Toggle } from '../components/Toggle.js';
import { Button } from '../components/Button.js';
import { SettingsModel } from '../models/SettingsModel.js';

/**
 * Pantalla de Configuración Avanzada.
 * Organiza los ajustes del juego en secciones (General, Gráficos e Interfaz),
 * soporta presets gráficos, persistencia automática y restauración de defaults.
 */
export class SettingsScreen extends Screen {
  #controls = {};
  #activeTab = 'general';
  #tabButtons = {};
  #tabPanels = {};

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

    const schema = this.model.schema;

    // Barra de pestañas (Tabs)
    const tabNav = document.createElement('div');
    tabNav.className = 'nx-settings-tabs';
    tabNav.setAttribute('role', 'tablist');
    tabNav.setAttribute('aria-label', 'Categorías de configuración');

    const tabs = [
      { id: 'general', label: 'General' },
      { id: 'graphics', label: 'Gráficos' },
      { id: 'ui', label: 'Interfaz' }
    ];

    tabs.forEach((tab) => {
      const tabBtn = document.createElement('button');
      tabBtn.type = 'button';
      tabBtn.className = `nx-settings-tab-btn ${tab.id === this.#activeTab ? 'is-active' : ''}`;
      tabBtn.setAttribute('role', 'tab');
      tabBtn.setAttribute('aria-selected', String(tab.id === this.#activeTab));
      tabBtn.setAttribute('aria-controls', `tab-panel-${tab.id}`);
      tabBtn.textContent = tab.label;
      tabBtn.addEventListener('click', () => this.switchTab(tab.id));

      tabNav.appendChild(tabBtn);
      this.#tabButtons[tab.id] = tabBtn;
    });

    this.modal.addBodyItem(tabNav);

    // Contenedores de pestañas
    tabs.forEach((tab) => {
      const panel = document.createElement('div');
      panel.className = `nx-settings-panel ${tab.id === this.#activeTab ? 'is-active' : ''}`;
      panel.id = `tab-panel-${tab.id}`;
      panel.setAttribute('role', 'tabpanel');
      panel.hidden = tab.id !== this.#activeTab;
      this.#tabPanels[tab.id] = panel;
      this.modal.addBodyItem(panel);
    });

    // ==========================================
    // TAB: GENERAL
    // ==========================================
    const generalPanel = this.#tabPanels.general;

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
    generalPanel.appendChild(this.#controls.mouseSensitivity.element);

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
    generalPanel.appendChild(this.#controls.fov.element);

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
    generalPanel.appendChild(this.#controls.masterVolume.element);

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
    generalPanel.appendChild(this.#controls.renderDistance.element);

    // ==========================================
    // TAB: GRÁFICOS
    // ==========================================
    const graphicsPanel = this.#tabPanels.graphics;

    // Selector de Preset Gráfico
    const presetRow = document.createElement('div');
    presetRow.className = 'nx-preset-row';
    const presetLabel = document.createElement('label');
    presetLabel.className = 'nx-slider-label';
    presetLabel.textContent = 'Calidad Visual Predeterminada';

    const presetBtnGroup = document.createElement('div');
    presetBtnGroup.className = 'nx-preset-group';
    presetBtnGroup.setAttribute('role', 'group');
    presetBtnGroup.setAttribute('aria-label', 'Calidad visual');

    this.#controls.presetButtons = {};
    ['low', 'medium', 'high'].forEach((presetKey) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `nx-btn nx-btn-secondary nx-btn-small ${this.model.get('graphicsPreset') === presetKey ? 'is-active' : ''}`;
      btn.textContent = schema.graphicsPreset.labels[presetKey];
      btn.addEventListener('click', () => {
        this.model.setGraphicsPreset(presetKey);
        this.#updatePresetButtons();
      });
      presetBtnGroup.appendChild(btn);
      this.#controls.presetButtons[presetKey] = btn;
    });

    presetRow.appendChild(presetLabel);
    presetRow.appendChild(presetBtnGroup);
    graphicsPanel.appendChild(presetRow);

    // Partículas ambientales
    this.#controls.ambientParticles = new Toggle({
      label: schema.ambientParticles.label,
      checked: this.model.get('ambientParticles'),
      disabled: schema.ambientParticles.disabled,
      onChange: (checked) => this.#onSettingChange('ambientParticles', checked)
    });
    graphicsPanel.appendChild(this.#controls.ambientParticles.element);

    // Densidad de partículas
    this.#controls.particleDensity = new Slider({
      label: schema.particleDensity.label,
      min: schema.particleDensity.min,
      max: schema.particleDensity.max,
      step: schema.particleDensity.step,
      value: this.model.get('particleDensity'),
      formatter: schema.particleDensity.formatter,
      disabled: schema.particleDensity.disabled,
      onChange: (val) => this.#onSettingChange('particleDensity', val)
    });
    graphicsPanel.appendChild(this.#controls.particleDensity.element);

    // Efectos de cámara
    this.#controls.cameraEffects = new Toggle({
      label: schema.cameraEffects.label,
      checked: this.model.get('cameraEffects'),
      disabled: schema.cameraEffects.disabled,
      onChange: (checked) => this.#onSettingChange('cameraEffects', checked)
    });
    graphicsPanel.appendChild(this.#controls.cameraEffects.element);

    // Efectos de daño
    this.#controls.damageEffects = new Toggle({
      label: schema.damageEffects.label,
      checked: this.model.get('damageEffects'),
      disabled: schema.damageEffects.disabled,
      onChange: (checked) => this.#onSettingChange('damageEffects', checked)
    });
    graphicsPanel.appendChild(this.#controls.damageEffects.element);

    // Frustum Culling (Disabled)
    this.#controls.frustumCulling = new Toggle({
      label: schema.frustumCulling.label,
      checked: this.model.get('frustumCulling'),
      disabled: schema.frustumCulling.disabled,
      disabledNote: schema.frustumCulling.disabledNote,
      onChange: (checked) => this.#onSettingChange('frustumCulling', checked)
    });
    graphicsPanel.appendChild(this.#controls.frustumCulling.element);

    // Greedy Meshing (Disabled)
    this.#controls.greedyMeshing = new Toggle({
      label: schema.greedyMeshing.label,
      checked: this.model.get('greedyMeshing'),
      disabled: schema.greedyMeshing.disabled,
      disabledNote: schema.greedyMeshing.disabledNote,
      onChange: (checked) => this.#onSettingChange('greedyMeshing', checked)
    });
    graphicsPanel.appendChild(this.#controls.greedyMeshing.element);

    // ==========================================
    // TAB: INTERFAZ
    // ==========================================
    const uiPanel = this.#tabPanels.ui;

    // Escala de UI
    this.#controls.uiScale = new Slider({
      label: schema.uiScale.label,
      min: schema.uiScale.min,
      max: schema.uiScale.max,
      step: schema.uiScale.step,
      value: this.model.get('uiScale'),
      formatter: schema.uiScale.formatter,
      disabled: schema.uiScale.disabled,
      onChange: (val) => this.#onSettingChange('uiScale', val)
    });
    uiPanel.appendChild(this.#controls.uiScale.element);

    // Tamaño de mira
    this.#controls.crosshairSize = new Slider({
      label: schema.crosshairSize.label,
      min: schema.crosshairSize.min,
      max: schema.crosshairSize.max,
      step: schema.crosshairSize.step,
      value: this.model.get('crosshairSize'),
      formatter: schema.crosshairSize.formatter,
      disabled: schema.crosshairSize.disabled,
      onChange: (val) => this.#onSettingChange('crosshairSize', val)
    });
    uiPanel.appendChild(this.#controls.crosshairSize.element);

    // Opacidad de mira
    this.#controls.crosshairOpacity = new Slider({
      label: schema.crosshairOpacity.label,
      min: schema.crosshairOpacity.min,
      max: schema.crosshairOpacity.max,
      step: schema.crosshairOpacity.step,
      value: this.model.get('crosshairOpacity'),
      formatter: schema.crosshairOpacity.formatter,
      disabled: schema.crosshairOpacity.disabled,
      onChange: (val) => this.#onSettingChange('crosshairOpacity', val)
    });
    uiPanel.appendChild(this.#controls.crosshairOpacity.element);

    // Mostrar barra de vida
    this.#controls.showHealthBar = new Toggle({
      label: schema.showHealthBar.label,
      checked: this.model.get('showHealthBar'),
      disabled: schema.showHealthBar.disabled,
      onChange: (checked) => this.#onSettingChange('showHealthBar', checked)
    });
    uiPanel.appendChild(this.#controls.showHealthBar.element);

    // Mostrar nombre de bloque en hotbar
    this.#controls.showBlockName = new Toggle({
      label: schema.showBlockName.label,
      checked: this.model.get('showBlockName'),
      disabled: schema.showBlockName.disabled,
      onChange: (checked) => this.#onSettingChange('showBlockName', checked)
    });
    uiPanel.appendChild(this.#controls.showBlockName.element);

    // Panel de debug (F3)
    this.#controls.showDebug = new Toggle({
      label: schema.showDebug.label,
      checked: this.model.get('showDebug'),
      disabled: schema.showDebug.disabled,
      onChange: (checked) => this.#onSettingChange('showDebug', checked)
    });
    uiPanel.appendChild(this.#controls.showDebug.element);

    // Intervalo de actualización F3
    this.#controls.debugUpdateInterval = new Slider({
      label: schema.debugUpdateInterval.label,
      min: schema.debugUpdateInterval.min,
      max: schema.debugUpdateInterval.max,
      step: schema.debugUpdateInterval.step,
      value: this.model.get('debugUpdateInterval'),
      formatter: schema.debugUpdateInterval.formatter,
      disabled: schema.debugUpdateInterval.disabled,
      onChange: (val) => this.#onSettingChange('debugUpdateInterval', val)
    });
    uiPanel.appendChild(this.#controls.debugUpdateInterval.element);

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

  switchTab(tabId) {
    if (!this.#tabPanels[tabId]) return;
    this.#activeTab = tabId;

    Object.entries(this.#tabButtons).forEach(([id, btn]) => {
      const isCur = id === tabId;
      btn.classList.toggle('is-active', isCur);
      btn.setAttribute('aria-selected', String(isCur));
    });

    Object.entries(this.#tabPanels).forEach(([id, panel]) => {
      const isCur = id === tabId;
      panel.classList.toggle('is-active', isCur);
      panel.hidden = !isCur;
    });
  }

  #bindModel() {
    this.model.subscribe((key, value) => {
      this.#syncControl(key, value);
      this.#updatePresetButtons();
    });
  }

  #onSettingChange(key, value) {
    this.model.set(key, value);
    this.#updatePresetButtons();
    if (this.intentBus) {
      this.intentBus.emit(IntentBus.Events.SETTINGS_CHANGED, { key, value });
    }
  }

  #updatePresetButtons() {
    if (!this.#controls.presetButtons) return;
    const currentPreset = this.model.get('graphicsPreset');
    Object.entries(this.#controls.presetButtons).forEach(([key, btn]) => {
      btn.classList.toggle('is-active', key === currentPreset);
    });
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
    this.#updatePresetButtons();
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
    for (const [key, val] of Object.entries(this.model.getAll())) {
      this.#syncControl(key, val);
    }
    this.#updatePresetButtons();
    setTimeout(() => this.backBtn?.focus?.(), 50);
  }
}
