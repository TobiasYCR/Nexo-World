/**
 * Intenciones que una pantalla puede emitir. Son verbos del usuario, no
 * acciones del motor: una pantalla nunca sabe qué pasa cuando emite una de
 * estas, solo que "el usuario quiso esto".
 */
export const UIIntent = Object.freeze({
  PLAY: 'play',
  RESUME: 'resume',
  OPEN_SETTINGS: 'openSettings',
  OPEN_CONTROLS: 'openControls',
  OPEN_INVENTORY: 'openInventory',
  RETURN_TO_MENU: 'returnToMenu',
  BACK: 'back'
});
