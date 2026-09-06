/**
 * Identificadores estables de cada pantalla de la interfaz. PLAYING es especial:
 * representa "sin overlay visible" (el HUD in-game a secas), no una pantalla
 * con contenido propio, por eso ScreenManager la trata como caso particular.
 */
export const ScreenId = Object.freeze({
  MENU: 'menu',
  SETTINGS: 'settings',
  CONTROLS: 'controls',
  INVENTORY: 'inventory',
  PLAYING: 'playing',
  PAUSE: 'pause'
});
