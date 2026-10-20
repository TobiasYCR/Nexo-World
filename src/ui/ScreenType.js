/**
 * Enumeración inmutable de identificadores de pantalla del juego.
 * Define los tipos admitidos por ScreenManager y acordados entre Frontend 1 y Frontend 2.
 */
export const ScreenType = Object.freeze({
  MENU: 'menu',
  SETTINGS: 'settings',
  CONTROLS: 'controls',
  INVENTORY: 'inventory',
  PLAYING: 'playing',
  PAUSE: 'pause',
  WORLD_SELECTION: 'world-selection',
  WORLD_CREATION: 'world-creation',
  LOGIN: 'login',
  REGISTER: 'register',
  PROFILE: 'profile',
  PASSWORD_RECOVERY: 'password-recovery'
});
