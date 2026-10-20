/**
 * HUD de salud del jugador (corazones pixel art).
 * Muestra la salud actual y máxima utilizando corazones llenos, medios y vacíos.
 * Se actualiza únicamente ante cambios de estado y evita escrituras redundantes al DOM.
 */
export class HealthBar {
  #health = null;
  #maxHealth = 20;
  #lastHealth = null;
  #lastMaxHealth = null;
  #heartElements = [];
  #hurtTimeout = null;

  constructor(maxHealth = 20) {
    this.#maxHealth = maxHealth;
    this.element = document.createElement('div');
    this.element.className = 'hud-health-container';
    this.element.setAttribute('role', 'status');
    this.element.setAttribute('aria-label', 'Salud del jugador');
    this.element.hidden = true; // Oculto hasta recibir datos de salud válidos

    this.#buildDOM();
  }

  get health() {
    return this.#health;
  }

  get maxHealth() {
    return this.#maxHealth;
  }

  #buildDOM() {
    this.element.innerHTML = '';
    this.#heartElements = [];

    const totalHearts = Math.ceil(this.#maxHealth / 2);
    const heartsRow = document.createElement('div');
    heartsRow.className = 'hud-health-row';

    for (let i = 0; i < totalHearts; i++) {
      const heart = document.createElement('span');
      heart.className = 'hud-heart hud-heart-full';
      heart.dataset.heartIndex = String(i);
      heart.setAttribute('aria-hidden', 'true');
      heartsRow.appendChild(heart);
      this.#heartElements.push(heart);
    }

    this.labelElement = document.createElement('span');
    this.labelElement.className = 'hud-health-label sr-only';
    this.labelElement.textContent = '';

    this.element.appendChild(heartsRow);
    this.element.appendChild(this.labelElement);
  }

  mount(container) {
    if (!container) return;
    if (!this.element.parentNode) {
      container.appendChild(this.element);
    }
  }

  setVisible(visible) {
    // Si se fuerza visibilidad pero no hay salud válida, mantener oculto
    if (visible && this.#health === null) {
      this.element.hidden = true;
      return;
    }
    this.element.hidden = !visible;
  }

  /**
   * Actualiza la barra de salud.
   * @param {number|null|undefined} currentHealth Salud actual (o null si el motor no tiene sistema de salud activo)
   * @param {number} [maxHealth=20] Salud máxima
   */
  update(currentHealth, maxHealth = this.#maxHealth) {
    if (currentHealth === null || currentHealth === undefined || typeof currentHealth !== 'number') {
      if (!this.element.hidden) {
        this.element.hidden = true;
      }
      this.#health = null;
      return;
    }

    // Normalizar salud
    const sanitizedMax = Math.max(1, maxHealth);
    const sanitizedCurrent = Math.max(0, Math.min(currentHealth, sanitizedMax));

    // Si cambió el máximo de corazones, reconstruir slots
    if (sanitizedMax !== this.#lastMaxHealth) {
      this.#maxHealth = sanitizedMax;
      this.#lastMaxHealth = sanitizedMax;
      this.#buildDOM();
    }

    // Si la salud no cambió, omitir operaciones de DOM
    if (sanitizedCurrent === this.#lastHealth) {
      return;
    }

    const isDamage = this.#lastHealth !== null && sanitizedCurrent < this.#lastHealth;
    this.#lastHealth = sanitizedCurrent;
    this.#health = sanitizedCurrent;

    // Mostrar elemento
    if (this.element.hidden) {
      this.element.hidden = false;
    }

    // Disparar animación de daño si disminuyó la salud
    if (isDamage) {
      this.#triggerHurtAnimation();
    }

    // Actualizar estados de cada corazón (lleno: 2, medio: 1, vacío: 0)
    let remainingHealth = sanitizedCurrent;
    for (let i = 0; i < this.#heartElements.length; i++) {
      const heart = this.#heartElements[i];
      let heartState = 'empty';

      if (remainingHealth >= 2) {
        heartState = 'full';
        remainingHealth -= 2;
      } else if (remainingHealth === 1) {
        heartState = 'half';
        remainingHealth -= 1;
      } else {
        heartState = 'empty';
      }

      heart.className = `hud-heart hud-heart-${heartState}`;
    }

    const textLabel = `Salud: ${sanitizedCurrent} / ${sanitizedMax}`;
    this.labelElement.textContent = textLabel;
    this.element.setAttribute('aria-label', textLabel);
  }

  /**
   * Reinicia la salud a su valor máximo (útil al reaparecer).
   */
  reset() {
    this.update(this.#maxHealth, this.#maxHealth);
  }

  #triggerHurtAnimation() {
    if (this.#hurtTimeout) {
      clearTimeout(this.#hurtTimeout);
    }
    this.element.classList.add('is-hurt');
    this.#hurtTimeout = setTimeout(() => {
      this.element.classList.remove('is-hurt');
      this.#hurtTimeout = null;
    }, 400);
  }
}
