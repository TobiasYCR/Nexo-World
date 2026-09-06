import { GameConfig } from '../game/GameConfig.js';

/**
 * Franja de accesos rápidos. Solo dibuja lo que le pasan por render(): no
 * consulta el Hotbar del motor por su cuenta.
 *
 * Backend 1 todavía no expone el contenido del inventario, así que hasta que
 * eso pase se ve vacía: nueve ranuras sin bloque asignado (ver 4.3 de la tarea).
 */
export class HotbarView {
  #slotElements = [];

  constructor(size = GameConfig.inventory.HOTBAR_SIZE) {
    this.size = size;
    this.element = document.createElement('div');
    this.element.className = 'hud-hotbar';
    this.#buildSlots();
  }

  #buildSlots() {
    for (let index = 0; index < this.size; index += 1) {
      const slot = document.createElement('div');
      slot.className = 'hud-hotbar__slot';

      const label = document.createElement('span');
      label.className = 'hud-hotbar__label';
      slot.appendChild(label);

      this.element.appendChild(slot);
      this.#slotElements.push({ slot, label });
    }
  }

  mount(container) {
    container.appendChild(this.element);
  }

  /**
   * @param {Array<{name: string}|null>} slots contenido por ranura, o vacío/null
   * @param {number} selectedIndex ranura activa
   */
  render(slots = [], selectedIndex = -1) {
    this.#slotElements.forEach(({ slot, label }, index) => {
      const content = slots[index] ?? null;
      slot.className =
        index === selectedIndex ? 'hud-hotbar__slot hud-hotbar__slot--active' : 'hud-hotbar__slot';
      label.textContent = content ? content.name : '';
    });
  }
}
