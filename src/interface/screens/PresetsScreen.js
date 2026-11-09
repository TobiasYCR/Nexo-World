import { Screen } from '../../ui/Screen.js';
import { ScreenType } from '../../ui/ScreenType.js';
import { IntentBus } from '../../ui/IntentBus.js';
import { Icons, setIconLabel } from '../../ui/Icons.js';
import { Modal } from '../components/Modal.js';
import { Button } from '../components/Button.js';
import { SpeechService } from '../../audio/SpeechService.js';
import { resolveBlockSyllables } from '../../blocks/BlockType.js';

/**
 * Pantalla de Selección de Planos de Construcción Guiada (Presets Educativos).
 * Permite elegir una estructura predefinida (ej. "Casa de madera"), escuchar la
 * separación en sílabas de cada material requerido e iniciar la construcción en el mundo 3D.
 */
export class PresetsScreen extends Screen {
  #presets;
  #speechService;
  #selectedPresetId = null;

  /**
   * @param {import('../../ui/ScreenManager.js').ScreenManager} [screenManager]
   * @param {IntentBus} [intentBus]
   * @param {Object} [options]
   */
  constructor(screenManager = null, intentBus = null, options = {}) {
    super(ScreenType.PRESETS, screenManager, intentBus);
    // Los planos los entrega GameUiBridge desde game.buildChallenge (ver setPresets).
    this.#presets = options.presets ?? [];
    this.#speechService = options.speechService ?? SpeechService.getInstance();
    this.#selectedPresetId = this.#presets[0]?.id ?? null;

    this.#buildDOM();
  }

  get presets() {
    return this.#presets;
  }

  /**
   * @param {ReadonlyArray<Object>} presets planos ya preparados por BuildChallengeView
   */
  setPresets(presets) {
    this.#presets = presets ?? [];
    if (!this.#presets.some((preset) => preset.id === this.#selectedPresetId)) {
      this.#selectedPresetId = this.#presets[0]?.id ?? null;
    }
    if (this.isVisible) this.renderPresets();
  }

  get selectedPreset() {
    return this.#presets.find((p) => p.id === this.#selectedPresetId) ?? this.#presets[0] ?? null;
  }

  #buildDOM() {
    this.element.className = 'screen screen-presets nx-modal-backdrop';

    this.modal = new Modal({
      title: 'Planos de Construcción (Modo Educativo)',
      className: 'nx-presets-dialog',
      onClose: () => this.handleBack()
    });

    const intro = document.createElement('p');
    intro.className = 'nx-presets-intro';
    intro.textContent = 'Elige un plano para construir paso a paso. Escucha cómo suena cada bloque separado en sílabas y colócalo en la guía luminosa del mundo 3D.';

    this.listContainer = document.createElement('div');
    this.listContainer.className = 'nx-presets-grid';

    this.modal.addBodyItem(intro);
    this.modal.addBodyItem(this.listContainer);

    this.cancelChallengeBtn = new Button({
      text: 'DETENER PLANO ACTIVO',
      variant: 'danger',
      id: 'presets-btn-cancel',
      onClick: () => {
        this.intentBus?.emit(IntentBus.Events.CANCEL_BUILD_CHALLENGE);
        this.handleBack();
      }
    });

    this.backBtn = new Button({
      text: 'VOLVER AL JUEGO',
      variant: 'secondary',
      id: 'presets-btn-back',
      onClick: () => this.handleBack()
    });

    this.modal.addFooterItem(this.cancelChallengeBtn);
    this.modal.addFooterItem(this.backBtn);
    this.element.appendChild(this.modal.element);

    this.renderPresets();
  }

  renderPresets() {
    this.listContainer.innerHTML = '';

    this.#presets.forEach((preset) => {
      const isSelected = preset.id === this.#selectedPresetId;
      const card = document.createElement('div');
      card.className = `nx-preset-card ${isSelected ? 'is-selected' : ''}`;
      card.dataset.presetId = preset.id;

      // Encabezado del plano
      const header = document.createElement('div');
      header.className = 'nx-preset-card-header';

      const title = document.createElement('h3');
      title.className = 'nx-preset-card-title';
      title.textContent = preset.name;

      const diffBadge = document.createElement('span');
      diffBadge.className = 'nx-badge nx-badge-accent';
      diffBadge.textContent = `${preset.difficulty} • ${preset.totalBlocks} bloques`;

      header.appendChild(title);
      header.appendChild(diffBadge);

      const desc = document.createElement('p');
      desc.className = 'nx-preset-card-desc';
      desc.textContent = preset.description;

      // Lista de materiales con separación en sílabas y audio
      const matTitle = document.createElement('div');
      matTitle.className = 'nx-preset-materials-title';
      matTitle.textContent = 'Materiales necesarios (pulsa Escuchar para oír sus sílabas):';

      const matList = document.createElement('div');
      matList.className = 'nx-preset-materials-list';

      preset.materials.forEach((mat) => {
        const matRow = document.createElement('div');
        matRow.className = 'nx-preset-material-row';

        const swatch = document.createElement('div');
        swatch.className = 'nx-block-swatch nx-preset-swatch';
        const rgb = mat.color ?? [180, 180, 180];
        if (mat.texture && swatch.style) {
          swatch.style.backgroundImage = `url('assets/textures/blocks/${mat.texture}')`;
          swatch.style.backgroundColor = `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;
        } else if (swatch.style) {
          swatch.style.backgroundColor = `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;
        }

        const matInfo = document.createElement('div');
        matInfo.className = 'nx-preset-mat-info';

        const matName = document.createElement('span');
        matName.className = 'nx-preset-mat-name';
        matName.textContent = `${mat.label} × ${mat.count}`;

        const matSyllables = document.createElement('div');
        matSyllables.className = 'nx-preset-mat-syllables';

        const { syllables } = resolveBlockSyllables(mat);
        const parts = [];
        syllables.forEach((syl, idx) => {
          if (idx > 0) {
            const sep = document.createElement('span');
            sep.className = 'nx-syllable-sep';
            sep.textContent = '-';
            matSyllables.appendChild(sep);
          }
          const part = document.createElement('span');
          part.className = 'nx-syllable-part';
          part.textContent = syl;
          matSyllables.appendChild(part);
          parts.push(part);
        });

        matInfo.appendChild(matName);
        matInfo.appendChild(matSyllables);

        const speakMatBtn = document.createElement('button');
        speakMatBtn.type = 'button';
        speakMatBtn.className = 'nx-btn-speak-block nx-preset-speak-btn';
        setIconLabel(speakMatBtn, Icons.speaker, 'Escuchar');
        speakMatBtn.setAttribute('aria-label', `Escuchar sílabas de ${mat.label}`);
        speakMatBtn.addEventListener('click', (e) => {
          e.stopPropagation?.();
          this.#speechService?.speakSyllables(mat, {
            onSyllable: (idx) => {
              parts.forEach((el, i) => el.classList.toggle('is-speaking', i === idx));
            },
            onCompleteWord: () => {
              parts.forEach((el) => el.classList.add('is-speaking'));
            },
            onEnd: () => {
              parts.forEach((el) => el.classList.remove('is-speaking'));
            }
          });
        });

        matRow.appendChild(swatch);
        matRow.appendChild(matInfo);
        matRow.appendChild(speakMatBtn);
        matList.appendChild(matRow);
      });

      // Botón para activar el desafío de construcción
      const startBtn = document.createElement('button');
      startBtn.type = 'button';
      startBtn.className = 'nx-btn nx-btn-primary nx-preset-start-btn';
      setIconLabel(startBtn, Icons.hammer, `CONSTRUIR ${preset.name.toUpperCase()}`);
      startBtn.addEventListener('click', (e) => {
        e.stopPropagation?.();
        this.selectAndStartPreset(preset.id);
      });

      card.addEventListener('click', () => {
        this.#selectedPresetId = preset.id;
        this.renderPresets();
      });

      card.appendChild(header);
      card.appendChild(desc);
      card.appendChild(matTitle);
      card.appendChild(matList);
      card.appendChild(startBtn);

      this.listContainer.appendChild(card);
    });
  }

  selectAndStartPreset(presetId) {
    this.#selectedPresetId = presetId;
    if (this.intentBus) {
      this.intentBus.emit(IntentBus.Events.START_BUILD_CHALLENGE, { presetId });
    }
    this.handleBack();
  }

  handleBack() {
    if (this.screenManager) {
      this.screenManager.open(ScreenType.PLAYING);
    }
  }

  show(params = {}) {
    super.show(params);
    this.renderPresets();
  }
}
