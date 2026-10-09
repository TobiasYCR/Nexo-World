import { SaveManager } from '../persistence/SaveManager.js';
import { SaveResult } from '../persistence/SaveResult.js';

/**
 * Vista de selección y administración de mundos guardados.
 * Lee las partidas existentes sin alterarlas, clasifica su estado (disponible,
 * incompatible o corrupta), y expone acciones de jugar, crear y eliminar.
 */
export class WorldSelectionView {
  #storage;
  #onSelectWorld;
  #onCreateNew;
  #onDeleteWorld;
  #worlds = [];
  #selectedSlot = null;
  #selectedWorld = null;

  /**
   * @param {Object} options
   * @param {Storage} [options.storage]
   * @param {Function} [options.onSelectWorld] Callback al jugar un mundo
   * @param {Function} [options.onCreateNew] Callback para abrir creación de mundo
   * @param {Function} [options.onDeleteWorld] Callback al eliminar
   */
  constructor({
    storage = null,
    onSelectWorld = null,
    onCreateNew = null,
    onDeleteWorld = null
  } = {}) {
    this.#storage = storage ?? (typeof window !== 'undefined' ? window.localStorage : null);
    this.#onSelectWorld = onSelectWorld;
    this.#onCreateNew = onCreateNew;
    this.#onDeleteWorld = onDeleteWorld;

    this.element = document.createElement('div');
    this.element.className = 'nx-world-selection-view';

    this.#buildDOM();
    this.refresh();
  }

  get selectedSlot() {
    return this.#selectedSlot;
  }

  get selectedWorld() {
    return this.#selectedWorld;
  }

  #buildDOM() {
    this.listContainer = document.createElement('div');
    this.listContainer.className = 'nx-world-list';
    this.listContainer.setAttribute('role', 'listbox');
    this.listContainer.setAttribute('aria-label', 'Lista de mundos guardados');

    this.element.appendChild(this.listContainer);
  }

  /**
   * Escanea el almacenamiento y clasifica las partidas guardadas.
   */
  scanWorlds() {
    const list = [];
    if (!this.#storage) return list;

    try {
      for (let i = 0; i < this.#storage.length; i++) {
        const key = this.#storage.key(i);
        if (!key || !key.startsWith(SaveManager.STORAGE_PREFIX)) continue;

        const slotName = key.slice(SaveManager.STORAGE_PREFIX.length);
        const raw = this.#storage.getItem(key);
        const bytes = raw ? raw.length : 0;

        let envelope = null;
        let status = 'available';
        let statusText = 'Disponible';
        let savedAt = null;
        let seed = 'N/D';
        let dimensions = '64x32x64';
        let saveVersion = null;

        try {
          envelope = JSON.parse(raw);
          if (!envelope || typeof envelope !== 'object' || envelope.format !== SaveManager.FORMAT_ID) {
            status = 'corrupt';
            statusText = 'Datos no válidos';
          } else if (envelope.saveVersion !== SaveManager.SAVE_VERSION) {
            status = 'incompatible';
            statusText = `Incompatible (v${envelope.saveVersion})`;
            saveVersion = envelope.saveVersion;
          } else {
            status = 'available';
            statusText = 'Listo para jugar';
            saveVersion = envelope.saveVersion;
            savedAt = envelope.savedAt ? new Date(envelope.savedAt).toLocaleString() : null;
            if (envelope.world) {
              dimensions = `${envelope.world.width ?? 64}x${envelope.world.height ?? 32}x${envelope.world.depth ?? 64}`;
              seed = envelope.world.seed ?? envelope.seed ?? 'N/D';
            }
          }
        } catch (_) {
          status = 'corrupt';
          statusText = 'Archivo corrupto';
        }

        list.push({
          slotName,
          status,
          statusText,
          savedAt,
          seed,
          dimensions,
          bytes,
          saveVersion,
          raw
        });
      }
    } catch (err) {
      console.error('[WorldSelectionView] Error al escanear partidas:', err);
    }

    // Ordenar de más reciente a más antiguo si hay fecha
    list.sort((a, b) => (b.savedAt || '').localeCompare(a.savedAt || ''));
    return list;
  }

  /**
   * Refresca la lista de mundos en el DOM.
   */
  refresh() {
    this.#worlds = this.scanWorlds();
    this.listContainer.innerHTML = '';

    if (this.#worlds.length === 0) {
      this.#renderEmptyState();
      return;
    }

    // Seleccionar el primer mundo disponible o el primero si no había selección
    if (!this.#selectedSlot || !this.#worlds.some((w) => w.slotName === this.#selectedSlot)) {
      const firstAvailable = this.#worlds.find((w) => w.status === 'available') || this.#worlds[0];
      this.#selectedSlot = firstAvailable.slotName;
      this.#selectedWorld = firstAvailable;
    }

    this.#worlds.forEach((world, index) => {
      const isSelected = world.slotName === this.#selectedSlot;

      const card = document.createElement('div');
      card.className = `nx-world-card nx-world-${world.status} ${isSelected ? 'is-selected' : ''}`;
      card.setAttribute('role', 'option');
      card.setAttribute('aria-selected', String(isSelected));
      card.tabIndex = isSelected ? 0 : -1;
      card.dataset.slotName = world.slotName;

      // Encabezado de tarjeta (Nombre y Badge de estado)
      const header = document.createElement('div');
      header.className = 'nx-world-card-header';

      const name = document.createElement('h4');
      name.className = 'nx-world-title';
      name.textContent = world.slotName;

      const badge = document.createElement('span');
      badge.className = `nx-badge nx-badge-${world.status === 'available' ? 'success' : world.status === 'incompatible' ? 'warning' : 'danger'}`;
      badge.textContent = world.statusText;

      header.appendChild(name);
      header.appendChild(badge);

      // Metadatos
      const meta = document.createElement('div');
      meta.className = 'nx-world-meta';

      const dateInfo = document.createElement('span');
      dateInfo.textContent = world.savedAt ? `🕒 ${world.savedAt}` : '🕒 Fecha desconocida';

      const sizeInfo = document.createElement('span');
      sizeInfo.textContent = `💾 ${(world.bytes / 1024).toFixed(1)} KB`;

      const dimInfo = document.createElement('span');
      dimInfo.textContent = `📐 ${world.dimensions}`;

      meta.appendChild(dateInfo);
      meta.appendChild(sizeInfo);
      meta.appendChild(dimInfo);

      // Botones de acción rápida por tarjeta
      const cardActions = document.createElement('div');
      cardActions.className = 'nx-world-card-actions';

      const playBtn = document.createElement('button');
      playBtn.type = 'button';
      playBtn.className = 'nx-btn nx-btn-primary nx-btn-small';
      playBtn.textContent = 'JUGAR';
      playBtn.disabled = world.status !== 'available';
      playBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.selectWorld(world);
        if (this.#onSelectWorld) this.#onSelectWorld(world);
      });

      const deleteBtn = document.createElement('button');
      deleteBtn.type = 'button';
      deleteBtn.className = 'nx-btn nx-btn-danger nx-btn-small';
      deleteBtn.textContent = 'ELIMINAR';
      deleteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (this.#onDeleteWorld) this.#onDeleteWorld(world);
      });

      cardActions.appendChild(playBtn);
      cardActions.appendChild(deleteBtn);

      card.appendChild(header);
      card.appendChild(meta);
      card.appendChild(cardActions);

      card.addEventListener('click', () => {
        this.selectWorld(world);
      });

      card.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          this.selectWorld(world);
          if (world.status === 'available' && this.#onSelectWorld) {
            this.#onSelectWorld(world);
          }
          e.preventDefault();
        } else if (e.key === 'ArrowDown') {
          const next = this.#worlds[index + 1];
          if (next) this.selectWorld(next);
          e.preventDefault();
        } else if (e.key === 'ArrowUp') {
          const prev = this.#worlds[index - 1];
          if (prev) this.selectWorld(prev);
          e.preventDefault();
        }
      });

      this.listContainer.appendChild(card);
    });
  }

  #renderEmptyState() {
    const empty = document.createElement('div');
    empty.className = 'nx-world-empty';

    const icon = document.createElement('div');
    icon.className = 'nx-world-empty-icon';
    icon.textContent = '🌍';

    const msg = document.createElement('p');
    msg.className = 'nx-world-empty-text';
    msg.textContent = 'No hay mundos guardados todavía.';

    const createBtn = document.createElement('button');
    createBtn.type = 'button';
    createBtn.className = 'nx-btn nx-btn-primary nx-btn-large';
    createBtn.textContent = 'CREAR NUEVO MUNDO';
    createBtn.addEventListener('click', () => {
      if (this.#onCreateNew) this.#onCreateNew();
    });

    empty.appendChild(icon);
    empty.appendChild(msg);
    empty.appendChild(createBtn);

    this.listContainer.appendChild(empty);
  }

  selectWorld(world) {
    if (!world) return;
    this.#selectedSlot = world.slotName;
    this.#selectedWorld = world;

    const cards = this.listContainer.querySelectorAll('.nx-world-card');
    cards.forEach((card) => {
      const isCur = card.dataset.slotName === world.slotName;
      card.classList.toggle('is-selected', isCur);
      card.setAttribute('aria-selected', String(isCur));
      card.tabIndex = isCur ? 0 : -1;
      if (isCur) card.focus();
    });
  }

  focus() {
    const active = this.listContainer.querySelector('.nx-world-card.is-selected') ||
                   this.listContainer.querySelector('.nx-world-card') ||
                   this.listContainer.querySelector('button');
    if (active) active.focus();
  }
}
