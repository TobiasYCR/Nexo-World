import { IntentBus } from './IntentBus.js';
import { ScreenType } from './ScreenType.js';
import { Icons, setIconLabel } from './Icons.js';
import { SpeechService } from '../audio/SpeechService.js';
import { resolveBlockSyllables } from '../blocks/BlockType.js';

/**
 * Panel HUD in-game del Modo Educativo (Desafíos de Construcción con Presets).
 * Muestra el plano activo, barra de progreso, materiales requeridos y el próximo
 * bloque a construir con su separación en sílabas y botón de lectura con audio (TTS).
 */
export class BuildChallengeHUD {
  #intentBus;
  #speechService;
  #lastChallengeKey = '';

  /**
   * @param {Object} [options]
   * @param {IntentBus} [options.intentBus]
   * @param {SpeechService} [options.speechService]
   */
  constructor({ intentBus = null, speechService = null } = {}) {
    this.#intentBus = intentBus;
    this.#speechService = speechService ?? SpeechService.getInstance();

    this.element = document.createElement('div');
    this.element.className = 'hud-education-panel';
    this.element.hidden = true;

    this.#buildDOM();
  }

  #buildDOM() {
    this.update(null);
  }

  mount(container) {
    if (!container) return;
    if (!this.element.parentNode) {
      container.appendChild(this.element);
    }
  }

  setVisible(visible) {
    this.element.hidden = !visible;
  }

  /**
   * Actualiza la vista del HUD educativo solo cuando cambia el estado del desafío.
   * @param {Object|null} activeChallenge
   */
  update(activeChallenge = null) {
    const key = activeChallenge
      ? `${activeChallenge.id}:${activeChallenge.placedBlocks}/${activeChallenge.totalBlocks}:${activeChallenge.wrongBlocks ?? 0}:${activeChallenge.nextBlock?.blockId ?? 'done'}`
      : 'none';

    if (key === this.#lastChallengeKey && this.element.children.length > 0) {
      return;
    }
    this.#lastChallengeKey = key;
    this.element.innerHTML = '';

    if (!activeChallenge) {
      this.#renderInactiveState();
      return;
    }

    this.#renderActiveChallenge(activeChallenge);
  }

  #renderInactiveState() {
    const launcher = document.createElement('div');
    launcher.className = 'hud-edu-launcher';

    const openBtn = document.createElement('button');
    openBtn.type = 'button';
    openBtn.className = 'nx-btn nx-btn-primary nx-btn-small hud-edu-open-btn';
    setIconLabel(openBtn, Icons.blueprint, 'Planos de Construcción (P)');
    openBtn.setAttribute('aria-label', 'Abrir selector de planos de construcción');
    openBtn.addEventListener('click', () => {
      this.#intentBus?.emit(IntentBus.Events.OPEN_SCREEN, { screen: ScreenType.PRESETS });
    });

    launcher.appendChild(openBtn);
    this.element.appendChild(launcher);
  }

  #renderActiveChallenge(challenge) {
    const card = document.createElement('div');
    card.className = `hud-edu-card ${challenge.completed ? 'is-completed' : ''}`;

    // Encabezado
    const header = document.createElement('div');
    header.className = 'hud-edu-header';

    const titleWrap = document.createElement('div');
    titleWrap.className = 'hud-edu-title-wrap';

    const badge = document.createElement('span');
    badge.className = 'nx-badge nx-badge-success';
    badge.textContent = 'PLANO ACTIVO';

    const title = document.createElement('h4');
    title.className = 'hud-edu-title';
    title.textContent = challenge.name;

    titleWrap.appendChild(badge);
    titleWrap.appendChild(title);

    const headerActions = document.createElement('div');
    headerActions.className = 'hud-edu-header-actions';

    const changeBtn = document.createElement('button');
    changeBtn.type = 'button';
    changeBtn.className = 'nx-btn nx-btn-secondary nx-btn-small hud-edu-change-btn';
    setIconLabel(changeBtn, Icons.blueprint, 'Planos');
    changeBtn.addEventListener('click', () => {
      this.#intentBus?.emit(IntentBus.Events.OPEN_SCREEN, { screen: ScreenType.PRESETS });
    });

    const cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.className = 'nx-btn nx-btn-danger nx-btn-small hud-edu-cancel-btn';
    cancelBtn.innerHTML = Icons.close;
    cancelBtn.setAttribute('aria-label', 'Cancelar desafío');
    cancelBtn.addEventListener('click', () => {
      this.#intentBus?.emit(IntentBus.Events.CANCEL_BUILD_CHALLENGE);
    });

    headerActions.appendChild(changeBtn);
    headerActions.appendChild(cancelBtn);

    header.appendChild(titleWrap);
    header.appendChild(headerActions);
    card.appendChild(header);

    // Barra de progreso
    const progressWrap = document.createElement('div');
    progressWrap.className = 'hud-edu-progress-wrap';

    const progressLabel = document.createElement('div');
    progressLabel.className = 'hud-edu-progress-label';
    const pct = Math.round((challenge.progress ?? 0) * 100);
    progressLabel.textContent = `Progreso: ${challenge.placedBlocks} / ${challenge.totalBlocks} bloques (${pct}%)`;

    const progressTrack = document.createElement('div');
    progressTrack.className = 'hud-edu-progress-track';

    const progressFill = document.createElement('div');
    progressFill.className = 'hud-edu-progress-fill';
    if (progressFill.style) {
      progressFill.style.width = `${pct}%`;
    }

    progressTrack.appendChild(progressFill);
    progressWrap.appendChild(progressLabel);
    progressWrap.appendChild(progressTrack);
    card.appendChild(progressWrap);

    // Si completó el plano
    if (challenge.completed) {
      const doneBanner = document.createElement('div');
      doneBanner.className = 'hud-edu-completed-banner';
      setIconLabel(doneBanner, Icons.celebrate, '¡Construcción completada! ¡Felicitaciones!');
      card.appendChild(doneBanner);
      this.element.appendChild(card);
      return;
    }

    // Tarjeta del próximo bloque a colocar con sílabas y audio
    if (challenge.nextBlock) {
      const next = challenge.nextBlock;
      const nextBox = document.createElement('div');
      nextBox.className = 'hud-edu-next-block';

      const nextHeader = document.createElement('span');
      nextHeader.className = 'hud-edu-next-caption';
      nextHeader.textContent = 'PRÓXIMO BLOQUE A COLOCAR:';

      const nextRow = document.createElement('div');
      nextRow.className = 'hud-edu-next-row';

      const swatch = document.createElement('div');
      swatch.className = 'nx-block-swatch hud-edu-swatch';
      const rgb = next.color ?? [180, 180, 180];
      if (next.texture && swatch.style) {
        swatch.style.backgroundImage = `url('assets/textures/blocks/${next.texture}')`;
        swatch.style.backgroundColor = `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;
      } else if (swatch.style) {
        swatch.style.backgroundColor = `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;
      }

      const textCol = document.createElement('div');
      textCol.className = 'hud-edu-next-info';

      const blockName = document.createElement('span');
      blockName.className = 'hud-edu-next-name';
      blockName.textContent = `${next.label} (faltan ${next.remaining})`;

      const syllablesRow = document.createElement('div');
      syllablesRow.className = 'hud-edu-syllables';

      const { syllables } = resolveBlockSyllables(next);
      const syllableParts = [];
      syllables.forEach((syl, idx) => {
        if (idx > 0) {
          const sep = document.createElement('span');
          sep.className = 'nx-syllable-sep';
          sep.textContent = '-';
          syllablesRow.appendChild(sep);
        }
        const part = document.createElement('span');
        part.className = 'nx-syllable-part';
        part.dataset.syllableIndex = String(idx);
        part.textContent = syl;
        syllablesRow.appendChild(part);
        syllableParts.push(part);
      });

      textCol.appendChild(blockName);
      textCol.appendChild(syllablesRow);

      const speakBtn = document.createElement('button');
      speakBtn.type = 'button';
      speakBtn.className = 'nx-btn nx-btn-primary nx-btn-small hud-edu-speak-btn';
      setIconLabel(speakBtn, Icons.speaker, 'Escuchar');
      speakBtn.setAttribute('aria-label', `Escuchar sílabas de ${next.label}`);
      speakBtn.addEventListener('click', () => {
        this.#speechService?.speakSyllables(next, {
          onSyllable: (idx) => {
            syllableParts.forEach((el, i) => el.classList.toggle('is-speaking', i === idx));
          },
          onCompleteWord: () => {
            syllableParts.forEach((el) => el.classList.add('is-speaking'));
          },
          onEnd: () => {
            syllableParts.forEach((el) => el.classList.remove('is-speaking'));
          }
        });
      });

      nextRow.appendChild(swatch);
      nextRow.appendChild(textCol);
      nextRow.appendChild(speakBtn);

      nextBox.appendChild(nextHeader);
      nextBox.appendChild(nextRow);
      card.appendChild(nextBox);
    }

    // Lista de materiales del plano
    if (Array.isArray(challenge.materials) && challenge.materials.length > 0) {
      const matList = document.createElement('div');
      matList.className = 'hud-edu-materials';

      challenge.materials.forEach((mat) => {
        const item = document.createElement('div');
        const isDone = mat.remaining === 0;
        item.className = `hud-edu-mat-item ${isDone ? 'is-done' : ''}`;
        if (isDone) {
          setIconLabel(item, Icons.check, `${mat.label} (${mat.syllableText}): ${mat.placed}/${mat.count}`);
        } else {
          item.textContent = `• ${mat.label} (${mat.syllableText}): ${mat.placed}/${mat.count}`;
        }
        matList.appendChild(item);
      });

      card.appendChild(matList);
    }

    this.element.appendChild(card);
  }
}
