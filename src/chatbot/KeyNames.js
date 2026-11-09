/** Nombres que entiende un chico para los códigos de tecla del navegador. */
const NAMES = Object.freeze({
  Space: 'Espacio',
  ShiftLeft: 'Shift',
  ShiftRight: 'Shift',
  ControlLeft: 'Control',
  ControlRight: 'Control',
  AltLeft: 'Alt',
  AltRight: 'Alt',
  Escape: 'Esc',
  Enter: 'Enter',
  Tab: 'Tab',
  Backspace: 'Borrar',
  ArrowUp: 'flecha arriba',
  ArrowDown: 'flecha abajo',
  ArrowLeft: 'flecha izquierda',
  ArrowRight: 'flecha derecha'
});

/**
 * Traduce códigos como "Space" o "KeyW" al nombre que está impreso en el
 * teclado ("Espacio", "W"). El chat sigue leyendo las teclas de la
 * configuración; solo cambia cómo las nombra.
 */
export class KeyNames {
  static of(code) {
    if (Object.hasOwn(NAMES, code)) return NAMES[code];
    if (/^Key[A-Z]$/.test(code)) return code.slice(3);
    if (/^Digit\d$/.test(code)) return code.slice(5);
    return code;
  }

  /** Nombres sin repetir: Shift izquierdo y derecho son la misma tecla para quien juega. */
  static list(codes) {
    return [...new Set(codes.map((code) => KeyNames.of(code)))];
  }
}
