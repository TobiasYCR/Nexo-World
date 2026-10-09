/**
 * Categorías del inventario creativo y asignación por tipo de bloque.
 */
export const INVENTORY_CATEGORIES = Object.freeze([
  { id: 'all', label: 'Todos' },
  { id: 'building', label: 'Construcción' },
  { id: 'nature', label: 'Naturaleza' },
  { id: 'minerals', label: 'Minerales' },
  { id: 'decoration', label: 'Decoración' }
]);

/**
 * Clasifica un bloque en su categoría temática.
 * @param {import('../blocks/BlockType.js').BlockType} block
 * @returns {'building'|'nature'|'minerals'|'decoration'}
 */
export function classifyBlockCategory(block) {
  if (block.category) return block.category;

  const name = (block.name || '').toLowerCase();
  const label = (block.label || '').toLowerCase();

  // Naturaleza
  if (name.includes('grass') || label.includes('cesped') || label.includes('pasto') ||
      name.includes('dirt') || label.includes('tierra') ||
      name.includes('log') || label.includes('tronco') ||
      name.includes('leaves') || label.includes('hojas') ||
      name.includes('sand') || label.includes('arena') ||
      name.includes('snow') || label.includes('nieve') ||
      name.includes('ice') || label.includes('hielo') ||
      name.includes('water') || label.includes('agua') ||
      name.includes('clay') || label.includes('arcilla')) {
    return 'nature';
  }

  // Minerales
  if (name.includes('iron') || label.includes('hierro') ||
      name.includes('gold') || label.includes('oro') ||
      name.includes('coal') || label.includes('carb') ||
      name.includes('diamond') || label.includes('diamante') ||
      name.includes('obsidian') || label.includes('obsidiana') ||
      name.includes('stone') || label.includes('piedra')) {
    return 'minerals';
  }

  // Decoración
  if (name.includes('glass') || label.includes('vidrio') || label.includes('cristal') ||
      name.includes('flower') || label.includes('flor') ||
      name.includes('torch') || label.includes('antorcha') ||
      name.includes('leaves') || label.includes('hojas') ||
      name.includes('lava') || label.includes('lava')) {
    return 'decoration';
  }

  // Construcción (por defecto)
  return 'building';
}

/**
 * Componente visual de Inventario Creativo.
 * Maneja filtros por categoría, búsqueda reactiva, renderizado de texturas
 * e inspección de metadatos del bloque.
 */
export class InventoryView {
  #blockRegistry;
  #onSelect;
  #activeCategory = 'all';
  #searchQuery = '';
  #selectedBlock = null;
  #filteredBlocks = [];
  #cardElements = [];

  /**
   * @param {Object} options
   * @param {import('../blocks/BlockRegistry.js').BlockRegistry} options.blockRegistry
   * @param {Function} [options.onSelect]
   */
  constructor({ blockRegistry, onSelect = null }) {
    this.#blockRegistry = blockRegistry;
    this.#onSelect = onSelect;
    this.element = document.createElement('div');
    this.element.className = 'nx-inventory-view';

    this.#buildDOM();
    this.refresh();
  }

  get selectedBlock() {
    return this.#selectedBlock;
  }

  #buildDOM() {
    // 1. Barra de herramientas: Búsqueda y Categorías
    const toolbar = document.createElement('div');
    toolbar.className = 'nx-inventory-toolbar';

    // Buscador
    const searchContainer = document.createElement('div');
    searchContainer.className = 'nx-inventory-search-wrap';

    this.searchInput = document.createElement('input');
    this.searchInput.type = 'search';
    this.searchInput.className = 'nx-input nx-inventory-search';
    this.searchInput.placeholder = 'Buscar bloque...';
    this.searchInput.setAttribute('aria-label', 'Buscar bloque por nombre');
    this.searchInput.addEventListener('input', (e) => {
      this.#searchQuery = e.target.value.trim().toLowerCase();
      this.refresh();
    });

    searchContainer.appendChild(this.searchInput);
    toolbar.appendChild(searchContainer);

    // Filtros de categoría
    const categoriesWrap = document.createElement('div');
    categoriesWrap.className = 'nx-inventory-categories';
    categoriesWrap.setAttribute('role', 'tablist');

    this.categoryButtons = {};
    INVENTORY_CATEGORIES.forEach((cat) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `nx-btn nx-btn-secondary nx-btn-small ${cat.id === this.#activeCategory ? 'is-active' : ''}`;
      btn.textContent = cat.label;
      btn.setAttribute('role', 'tab');
      btn.setAttribute('aria-selected', String(cat.id === this.#activeCategory));
      btn.addEventListener('click', () => {
        this.setCategory(cat.id);
      });
      categoriesWrap.appendChild(btn);
      this.categoryButtons[cat.id] = btn;
    });

    toolbar.appendChild(categoriesWrap);
    this.element.appendChild(toolbar);

    // 2. Grilla de bloques
    this.gridElement = document.createElement('div');
    this.gridElement.className = 'nx-inventory-grid';
    this.gridElement.setAttribute('role', 'grid');
    this.gridElement.setAttribute('aria-label', 'Catálogo de bloques');
    this.element.appendChild(this.gridElement);

    // 3. Panel de detalles / Metadatos del bloque seleccionado
    this.detailsPanel = document.createElement('div');
    this.detailsPanel.className = 'nx-inventory-details';
    this.element.appendChild(this.detailsPanel);
  }

  setCategory(categoryId) {
    this.#activeCategory = categoryId;
    Object.entries(this.categoryButtons).forEach(([id, btn]) => {
      const isCur = id === categoryId;
      btn.classList.toggle('is-active', isCur);
      btn.setAttribute('aria-selected', String(isCur));
    });
    this.refresh();
  }

  /**
   * Refresca la lista de bloques según filtros y actualiza la vista.
   */
  refresh() {
    const allPlaceable = this.#blockRegistry?.placeableTypes ? this.#blockRegistry.placeableTypes() : [];

    this.#filteredBlocks = allPlaceable.filter((block) => {
      // Filtro de categoría
      if (this.#activeCategory !== 'all') {
        const cat = classifyBlockCategory(block);
        if (cat !== this.#activeCategory) return false;
      }

      // Filtro de búsqueda
      if (this.#searchQuery) {
        const nameMatch = (block.name || '').toLowerCase().includes(this.#searchQuery);
        const labelMatch = (block.label || '').toLowerCase().includes(this.#searchQuery);
        if (!nameMatch && !labelMatch) return false;
      }

      return true;
    });

    this.#renderGrid();
    this.#renderDetails();
  }

  #renderGrid() {
    this.gridElement.innerHTML = '';
    this.#cardElements = [];

    if (this.#filteredBlocks.length === 0) {
      const emptyMsg = document.createElement('div');
      emptyMsg.className = 'nx-inventory-empty';
      emptyMsg.textContent = 'No se encontraron bloques con los filtros aplicados.';
      this.gridElement.appendChild(emptyMsg);
      return;
    }

    // Seleccionar el primero si no hay selección válida
    if (!this.#selectedBlock || !this.#filteredBlocks.some((b) => b.id === this.#selectedBlock.id)) {
      this.#selectedBlock = this.#filteredBlocks[0];
    }

    this.#filteredBlocks.forEach((block, index) => {
      const isSelected = this.#selectedBlock && this.#selectedBlock.id === block.id;

      const card = document.createElement('div');
      card.className = `nx-block-card ${isSelected ? 'is-selected' : ''}`;
      card.setAttribute('role', 'gridcell');
      card.setAttribute('tabindex', isSelected ? '0' : '-1');
      card.setAttribute('aria-label', block.label || block.name);
      card.dataset.blockId = String(block.id);

      // Icono / Textura
      const swatch = document.createElement('div');
      swatch.className = 'nx-block-swatch';
      const texture = block.textures?.top || block.texture;
      const rgb = block.color ?? [180, 180, 180];

      if (texture && swatch.style) {
        swatch.style.backgroundImage = `url('assets/textures/blocks/${texture}')`;
        swatch.style.backgroundColor = `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;
      } else if (swatch.style) {
        swatch.style.backgroundColor = `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;
      }

      // Nombre
      const label = document.createElement('span');
      label.className = 'nx-block-name';
      label.textContent = block.label || block.name;

      card.appendChild(swatch);
      card.appendChild(label);

      card.addEventListener('click', () => {
        this.selectBlock(block);
      });

      card.addEventListener('keydown', (e) => {
        this.#handleCardKey(e, index);
      });

      this.gridElement.appendChild(card);
      this.#cardElements.push(card);
    });
  }

  selectBlock(block) {
    if (!block) return;
    this.#selectedBlock = block;

    this.#cardElements.forEach((card) => {
      const isCur = card.dataset.blockId === String(block.id);
      card.classList.toggle('is-selected', isCur);
      card.tabIndex = isCur ? 0 : -1;
      if (isCur) card.focus();
    });

    this.#renderDetails();

    if (this.#onSelect) {
      this.#onSelect(block);
    }
  }

  #renderDetails() {
    this.detailsPanel.innerHTML = '';
    const block = this.#selectedBlock;
    if (!block) return;

    const header = document.createElement('div');
    header.className = 'nx-details-header';

    const title = document.createElement('h3');
    title.className = 'nx-details-title';
    title.textContent = block.label || block.name;

    const categoryBadge = document.createElement('span');
    categoryBadge.className = 'nx-badge nx-badge-accent';
    const catObj = INVENTORY_CATEGORIES.find((c) => c.id === classifyBlockCategory(block));
    categoryBadge.textContent = catObj ? catObj.label : 'General';

    header.appendChild(title);
    header.appendChild(categoryBadge);

    const specs = document.createElement('div');
    specs.className = 'nx-details-specs';

    const infoList = [
      `ID de bloque: ${block.id}`,
      `Nombre técnico: ${block.name}`,
      `Dureza: ${block.hardness ?? 1}`,
      `Rompible: ${block.breakable !== false ? 'Sí' : 'No'}`,
      `Sólido: ${block.solid !== false ? 'Sí' : 'No'}`,
      `Transparente: ${block.transparent ? 'Sí' : 'No'}`
    ];

    infoList.forEach((text) => {
      const item = document.createElement('span');
      item.className = 'nx-details-spec-item';
      item.textContent = text;
      specs.appendChild(item);
    });

    const actionBtn = document.createElement('button');
    actionBtn.type = 'button';
    actionBtn.className = 'nx-btn nx-btn-primary nx-btn-small';
    actionBtn.textContent = 'CARGAR PILA EN HOTBAR (64)';
    actionBtn.addEventListener('click', () => {
      if (this.#onSelect) {
        this.#onSelect(block);
      }
    });

    this.detailsPanel.appendChild(header);
    this.detailsPanel.appendChild(specs);
    this.detailsPanel.appendChild(actionBtn);
  }

  #handleCardKey(e, index) {
    const total = this.#filteredBlocks.length;
    let nextIndex = index;
    const columns = 6;

    switch (e.key) {
      case 'ArrowRight':
        nextIndex = (index + 1) % total;
        e.preventDefault();
        break;
      case 'ArrowLeft':
        nextIndex = (index - 1 + total) % total;
        e.preventDefault();
        break;
      case 'ArrowDown':
        if (index + columns < total) {
          nextIndex = index + columns;
        }
        e.preventDefault();
        break;
      case 'ArrowUp':
        if (index - columns >= 0) {
          nextIndex = index - columns;
        }
        e.preventDefault();
        break;
      case 'Enter':
      case ' ':
        this.selectBlock(this.#filteredBlocks[index]);
        e.preventDefault();
        return;
      default:
        return;
    }

    if (nextIndex !== index && this.#filteredBlocks[nextIndex]) {
      this.selectBlock(this.#filteredBlocks[nextIndex]);
    }
  }

  focus() {
    const activeCard = this.#cardElements.find((c) => c.classList.contains('is-selected'));
    if (activeCard) {
      activeCard.focus();
    } else if (this.searchInput) {
      this.searchInput.focus();
    }
  }
}
