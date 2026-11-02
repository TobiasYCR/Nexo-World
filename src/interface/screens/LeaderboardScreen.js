import { Screen } from '../../ui/Screen.js';
import { ScreenType } from '../../ui/ScreenType.js';
import { Modal } from '../components/Modal.js';
import { Button } from '../components/Button.js';
import { ProgressionResult } from '../../progression/ProgressionResult.js';

const MODE_LABELS = Object.freeze({ survival: 'Supervivencia', creative: 'Creativo' });

/**
 * Tabla de puntuaciones. Muestra las primeras posiciones de cada modo y la
 * posición del jugador actual. Los datos vienen de ProgressionUiService; la
 * pantalla no calcula puntos.
 */
export class LeaderboardScreen extends Screen {
  #service;
  #mode = null;
  #tabButtons = {};
  /** Evita que una respuesta lenta de otra pestaña pise la que se está mirando. */
  #request = 0;

  /**
   * @param {import('../../progression/ProgressionUiService.js').ProgressionUiService|null} [service]
   * @param {import('../../ui/ScreenManager.js').ScreenManager} [screenManager]
   * @param {import('../../ui/IntentBus.js').IntentBus} [intentBus]
   */
  constructor(service = null, screenManager = null, intentBus = null) {
    super(ScreenType.LEADERBOARD, screenManager, intentBus);
    this.#service = service;
    this.#buildDOM();
  }

  setService(service) {
    this.#service = service;
  }

  /** Modo que se está mostrando. */
  get mode() {
    return this.#mode;
  }

  #buildDOM() {
    this.element.className = 'screen screen-leaderboard nx-modal-backdrop';

    this.modal = new Modal({
      title: 'Clasificación',
      className: 'nx-leaderboard-dialog',
      onClose: () => this.handleBack()
    });

    const tabs = document.createElement('div');
    tabs.className = 'nx-settings-tabs';
    tabs.setAttribute('role', 'tablist');
    tabs.setAttribute('aria-label', 'Modo de juego');
    for (const [mode, label] of Object.entries(MODE_LABELS)) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'nx-settings-tab-btn';
      button.id = `leaderboard-tab-${mode}`;
      button.setAttribute('role', 'tab');
      button.textContent = label;
      button.addEventListener('click', () => this.selectMode(mode));
      tabs.appendChild(button);
      this.#tabButtons[mode] = button;
    }
    this.modal.addBodyItem(tabs);

    this.statusMessage = document.createElement('p');
    this.statusMessage.className = 'nx-leaderboard-status';
    this.statusMessage.setAttribute('role', 'status');
    this.modal.addBodyItem(this.statusMessage);

    this.table = document.createElement('table');
    this.table.className = 'nx-leaderboard-table';
    const head = document.createElement('thead');
    const headRow = document.createElement('tr');
    for (const title of ['#', 'Jugador', 'Puntos']) {
      const cell = document.createElement('th');
      cell.scope = 'col';
      cell.textContent = title;
      headRow.appendChild(cell);
    }
    head.appendChild(headRow);
    this.rows = document.createElement('tbody');
    this.table.appendChild(head);
    this.table.appendChild(this.rows);
    this.modal.addBodyItem(this.table);

    this.ownStanding = document.createElement('p');
    this.ownStanding.className = 'nx-leaderboard-own';
    this.modal.addBodyItem(this.ownStanding);

    this.refreshBtn = new Button({
      text: 'ACTUALIZAR',
      variant: 'secondary',
      id: 'leaderboard-btn-refresh',
      onClick: () => this.refresh()
    });
    this.backBtn = new Button({
      text: 'VOLVER',
      variant: 'primary',
      id: 'leaderboard-btn-back',
      onClick: () => this.handleBack()
    });
    this.modal.addFooterItem(this.refreshBtn);
    this.modal.addFooterItem(this.backBtn);
    this.element.appendChild(this.modal.element);
  }

  show(params = {}) {
    super.show(params);
    const mode = params.mode ?? this.#mode ?? this.#service?.currentMode ?? 'survival';
    this.selectMode(mode);
  }

  /** Cambia de pestaña y carga esa tabla. */
  selectMode(mode) {
    this.#mode = MODE_LABELS[mode] ? mode : 'survival';
    for (const [key, button] of Object.entries(this.#tabButtons)) {
      const active = key === this.#mode;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-selected', String(active));
    }
    return this.refresh();
  }

  /** Vuelve a pedir la tabla y la posición del jugador. Nunca lanza. */
  async refresh() {
    const request = ++this.#request;
    const mode = this.#mode ?? 'survival';
    this.#clearRows();
    this.table.hidden = true;
    this.ownStanding.textContent = '';

    if (!this.#service) {
      this.#showStatus('La clasificación no está disponible en este momento.');
      return;
    }

    this.#showStatus('Cargando...');
    const [top, standing] = await Promise.all([this.#service.top(mode), this.#service.standing(mode)]);
    if (request !== this.#request) return;

    if (!top.ok) {
      this.#showStatus(LeaderboardScreen.#errorText(top));
      return;
    }
    if (top.entries.length === 0) {
      this.#showStatus(`Todavía no hay puntuaciones en ${MODE_LABELS[mode].toLowerCase()}.`);
    } else {
      this.#showStatus('');
      this.#renderRows(top.entries);
      this.table.hidden = false;
    }
    this.ownStanding.textContent = LeaderboardScreen.#standingText(standing);
  }

  #renderRows(entries) {
    const own = this.#service.currentPlayerId;
    for (const entry of entries) {
      const row = document.createElement('tr');
      if (entry.playerId === own) {
        row.classList.add('is-own');
        row.setAttribute('aria-current', 'true');
      }
      for (const text of [`${entry.position}`, entry.name, `${entry.score}`]) {
        const cell = document.createElement('td');
        cell.textContent = text;
        row.appendChild(cell);
      }
      this.rows.appendChild(row);
    }
  }

  #clearRows() {
    while (this.rows.children.length > 0) this.rows.removeChild(this.rows.children[0]);
  }

  #showStatus(text) {
    this.statusMessage.textContent = text;
    this.statusMessage.hidden = text === '';
  }

  static #standingText(standing) {
    if (!standing.ok) return '';
    if (standing.position === null) return 'Todavía no figurás en esta tabla: jugá en este modo para sumar puntos.';
    return `Tu posición: #${standing.position} con ${standing.score} puntos.`;
  }

  static #errorText(result) {
    const { Reasons } = ProgressionResult;
    if (result.reason === Reasons.OFFLINE || result.reason === Reasons.TIMEOUT) {
      return 'No se pudo conectar con el servidor de puntuaciones. Revisá que esté corriendo (npm run server).';
    }
    return 'No se pudo cargar la clasificación. Probá de nuevo en un momento.';
  }

  handleBack() {
    this.screenManager?.back();
  }
}
