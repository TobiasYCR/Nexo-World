/** Fábricas de elementos DOM compartidas por las pantallas. Sin estado propio. */
export class ScreenUI {
  static createPanel() {
    const panel = document.createElement('div');
    panel.className = 'menu-panel';
    return panel;
  }

  static createTitle(text) {
    const title = document.createElement('h2');
    title.className = 'menu-title';
    title.textContent = text;
    return title;
  }

  static createNote(text) {
    const note = document.createElement('p');
    note.className = 'menu-note';
    note.textContent = text;
    return note;
  }

  static createButton(label, onClick, extraClassName = '') {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = extraClassName ? `menu-button ${extraClassName}` : 'menu-button';
    button.textContent = label;
    button.addEventListener('click', onClick);
    return button;
  }
}
