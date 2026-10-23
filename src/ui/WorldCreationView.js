import { GameConfig } from '../game/GameConfig.js';

/**
 * Formulario de creación y configuración de nuevos mundos.
 * Valida nombres, admite semillas opcionales y permite seleccionar el modo de juego.
 */
export class WorldCreationView {
  #worldName = 'Nuevo Mundo';
  #seed = '';
  #gameMode = 'creative'; // 'creative' | 'survival'
  #onSubmit;
  #onCancel;

  /**
   * @param {Object} options
   * @param {Function} [options.onSubmit]
   * @param {Function} [options.onCancel]
   */
  constructor({ onSubmit = null, onCancel = null } = {}) {
    this.#onSubmit = onSubmit;
    this.#onCancel = onCancel;
    this.element = document.createElement('div');
    this.element.className = 'nx-world-creation-view';

    this.#buildDOM();
  }

  get worldName() {
    return this.#worldName;
  }

  get seed() {
    return this.#seed;
  }

  get gameMode() {
    return this.#gameMode;
  }

  #buildDOM() {
    this.element.innerHTML = '';

    // 1. Campo: Nombre del Mundo
    const nameGroup = document.createElement('div');
    nameGroup.className = 'nx-form-group';

    const nameLabel = document.createElement('label');
    nameLabel.className = 'nx-form-label';
    nameLabel.textContent = 'Nombre del Mundo *';

    this.nameInput = document.createElement('input');
    this.nameInput.type = 'text';
    this.nameInput.className = 'nx-input nx-form-input';
    this.nameInput.value = this.#worldName;
    this.nameInput.maxLength = 32;
    this.nameInput.placeholder = 'Mi Mundo';
    this.nameInput.setAttribute('aria-label', 'Nombre del mundo');

    this.nameError = document.createElement('span');
    this.nameError.className = 'nx-form-error';
    this.nameError.textContent = '';
    this.nameError.hidden = true;

    this.nameInput.addEventListener('input', (e) => {
      this.#worldName = e.target.value;
      this.validate();
    });

    nameGroup.appendChild(nameLabel);
    nameGroup.appendChild(this.nameInput);
    nameGroup.appendChild(this.nameError);
    this.element.appendChild(nameGroup);

    // 2. Campo: Semilla (Opcional)
    const seedGroup = document.createElement('div');
    seedGroup.className = 'nx-form-group';

    const seedLabel = document.createElement('label');
    seedLabel.className = 'nx-form-label';
    seedLabel.textContent = 'Semilla del Generador (Opcional)';

    this.seedInput = document.createElement('input');
    this.seedInput.type = 'text';
    this.seedInput.className = 'nx-input nx-form-input';
    this.seedInput.placeholder = 'Dejar en blanco para semilla aleatoria';
    this.seedInput.setAttribute('aria-label', 'Semilla del mundo');
    this.seedInput.addEventListener('input', (e) => {
      this.#seed = e.target.value.trim();
    });

    seedGroup.appendChild(seedLabel);
    seedGroup.appendChild(this.seedInput);
    this.element.appendChild(seedGroup);

    // 3. Campo: Modo de Juego
    const modeGroup = document.createElement('div');
    modeGroup.className = 'nx-form-group';

    const modeLabel = document.createElement('label');
    modeLabel.className = 'nx-form-label';
    modeLabel.textContent = 'Modo de Juego';

    const modeOptions = document.createElement('div');
    modeOptions.className = 'nx-mode-options';
    modeOptions.setAttribute('role', 'radiogroup');
    modeOptions.setAttribute('aria-label', 'Modo de juego');

    const modes = [
      { id: 'creative', name: 'Creativo', desc: 'Recursos ilimitados, vuelo y construcción libre.' },
      { id: 'survival', name: 'Supervivencia Básica', desc: 'Salud, recolección de bloques y caída al vacío.' }
    ];

    this.modeCards = {};
    modes.forEach((m) => {
      const card = document.createElement('div');
      card.className = `nx-mode-card ${m.id === this.#gameMode ? 'is-selected' : ''}`;
      card.setAttribute('role', 'radio');
      card.setAttribute('aria-checked', String(m.id === this.#gameMode));
      card.tabIndex = m.id === this.#gameMode ? 0 : -1;

      const title = document.createElement('span');
      title.className = 'nx-mode-title';
      title.textContent = m.name;

      const desc = document.createElement('span');
      desc.className = 'nx-mode-desc';
      desc.textContent = m.desc;

      card.appendChild(title);
      card.appendChild(desc);

      card.addEventListener('click', () => this.setGameMode(m.id));
      card.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          this.setGameMode(m.id);
          e.preventDefault();
        }
      });

      modeOptions.appendChild(card);
      this.modeCards[m.id] = card;
    });

    modeGroup.appendChild(modeLabel);
    modeGroup.appendChild(modeOptions);
    this.element.appendChild(modeGroup);

    // 4. Información técnica / Dimensiones admitidas
    const advGroup = document.createElement('div');
    advGroup.className = 'nx-form-group nx-advanced-info';

    const advHeader = document.createElement('div');
    advHeader.className = 'nx-advanced-header';
    advHeader.textContent = 'Parámetros del Motor';

    const advDetails = document.createElement('div');
    advDetails.className = 'nx-advanced-grid';

    const width = GameConfig.world?.WIDTH ?? 64;
    const height = GameConfig.world?.HEIGHT ?? 32;
    const depth = GameConfig.world?.DEPTH ?? 64;

    advDetails.innerHTML = `
      <span>Dimensiones: <strong>${width}x${height}x${depth} bloques</strong></span>
      <span>Generador: <strong>Voxel Perlin v1.0.0</strong></span>
      <span>Tamaño de chunk: <strong>16x16 bloques</strong></span>
    `;

    advGroup.appendChild(advHeader);
    advGroup.appendChild(advDetails);
    this.element.appendChild(advGroup);
  }

  setGameMode(modeId) {
    this.#gameMode = modeId;
    Object.entries(this.modeCards).forEach(([id, card]) => {
      const isCur = id === modeId;
      card.classList.toggle('is-selected', isCur);
      card.setAttribute('aria-checked', String(isCur));
      card.tabIndex = isCur ? 0 : -1;
    });
  }

  validate() {
    const trimmed = this.#worldName.trim();
    if (!trimmed) {
      this.nameError.textContent = 'El nombre del mundo no puede estar vacío.';
      this.nameError.hidden = false;
      this.nameInput.classList.add('is-invalid');
      return false;
    }
    if (trimmed.length > 32) {
      this.nameError.textContent = 'El nombre no puede exceder 32 caracteres.';
      this.nameError.hidden = false;
      this.nameInput.classList.add('is-invalid');
      return false;
    }

    this.nameError.hidden = true;
    this.nameInput.classList.remove('is-invalid');
    return true;
  }

  submit() {
    if (!this.validate()) {
      this.nameInput.focus();
      return null;
    }

    const payload = {
      name: this.#worldName.trim(),
      seed: this.#seed || String(Math.floor(Math.random() * 1000000)),
      gameMode: this.#gameMode
    };

    if (this.#onSubmit) {
      this.#onSubmit(payload);
    }
    return payload;
  }

  focus() {
    this.nameInput?.focus?.();
  }
}
