/**
 * Constantes puras del dominio: valores que no son configurables por el jugador
 * ni por el diseño de una partida. Lo ajustable vive en GameConfig.
 */

/** Identificadores estables de los tipos de bloque base. */
export const BlockIds = Object.freeze({
  AIR: 0,
  GRASS: 1,
  DIRT: 2,
  STONE: 3,
  LOG: 4,
  LEAVES: 5,
  PLANKS: 6,
  SAND: 7,
  COBBLESTONE: 8,
  GLASS: 9,
  SANDSTONE: 10,
  BEDROCK: 11,
  COAL_ORE: 12,
  IRON_ORE: 13,
  GOLD_ORE: 14,
  DIAMOND_ORE: 15
});

/** Acciones lógicas del juego. El input se expresa en acciones, nunca en teclas. */
export const InputActions = Object.freeze({
  MOVE_FORWARD: 'moveForward',
  MOVE_BACKWARD: 'moveBackward',
  MOVE_LEFT: 'moveLeft',
  MOVE_RIGHT: 'moveRight',
  JUMP: 'jump',
  SPRINT: 'sprint',
  PAUSE: 'pause',
  TOGGLE_DEBUG: 'toggleDebug'
});

/** Botones de mouse normalizados (coinciden con MouseEvent.button). */
export const MouseButtons = Object.freeze({
  LEFT: 0,
  MIDDLE: 1,
  RIGHT: 2
});

/** Ejes cardinales en espacio de bloques, usados por raycast y vecindad de caras. */
export const BlockFaces = Object.freeze([
  Object.freeze({ name: 'east', x: 1, y: 0, z: 0 }),
  Object.freeze({ name: 'west', x: -1, y: 0, z: 0 }),
  Object.freeze({ name: 'top', x: 0, y: 1, z: 0 }),
  Object.freeze({ name: 'bottom', x: 0, y: -1, z: 0 }),
  Object.freeze({ name: 'south', x: 0, y: 0, z: 1 }),
  Object.freeze({ name: 'north', x: 0, y: 0, z: -1 })
]);

export const EPSILON = 1e-6;

/** Categorías de mezcla del audio. Cada una tiene su propio control de volumen. */
export const AudioCategories = Object.freeze({
  SFX: 'sfx',
  MUSIC: 'music',
  AMBIENT: 'ambient'
});

/** Identificadores lógicos de sonido. Las rutas se resuelven en AssetCatalog. */
export const SoundIds = Object.freeze({
  BLOCK_PLACE: 'blockPlace',
  BLOCK_BREAK: 'blockBreak'
});
