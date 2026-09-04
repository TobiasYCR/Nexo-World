import { InputActions } from '../utils/Constants.js';

/**
 * Fuente única de verdad para todos los valores ajustables del juego.
 * Ningún módulo debe declarar magic numbers: si un valor se puede tunear, va acá.
 */
export const GameConfig = Object.freeze({
  world: Object.freeze({
    BLOCK_SIZE: 20,
    WORLD_WIDTH: 32,
    WORLD_HEIGHT: 24,
    WORLD_DEPTH: 32,
    /** Altura base del terreno generado, en bloques. */
    BASE_TERRAIN_HEIGHT: 6,
    /** Amplitud vertical del ruido, en bloques. */
    TERRAIN_AMPLITUDE: 3,
    /** Escala del ruido: valores chicos generan colinas más amplias. */
    NOISE_SCALE: 0.08,
    SEED: 20260904
  }),

  chunk: Object.freeze({
    SIZE_X: 16,
    SIZE_Z: 16
  }),

  player: Object.freeze({
    PLAYER_SPEED: 120,
    SPRINT_MULTIPLIER: 1.6,
    GRAVITY: -260,
    JUMP_FORCE: 150,
    /** Dimensiones de la caja de colisión, en unidades de mundo. */
    WIDTH: 12,
    HEIGHT: 34,
    /** Altura de los ojos medida desde los pies. */
    EYE_HEIGHT: 30,
    SPAWN: Object.freeze({ x: 160, y: 200, z: 160 })
  }),

  camera: Object.freeze({
    MOUSE_SENSITIVITY: 0.0022,
    FOV_DEGREES: 70,
    NEAR_PLANE: 1,
    FAR_PLANE: 4000,
    /** Límite de cabeceo en radianes, justo por debajo de 90° para evitar el giro invertido. */
    MAX_PITCH: Math.PI / 2 - 0.01
  }),

  rendering: Object.freeze({
    /** Radio de render en bloques alrededor del jugador. */
    RENDER_DISTANCE: 24,
    BACKGROUND_COLOR: Object.freeze([135, 175, 215]),
    AMBIENT_LIGHT: Object.freeze([120, 120, 130]),
    DIRECTIONAL_LIGHT: Object.freeze([210, 205, 190]),
    LIGHT_DIRECTION: Object.freeze({ x: -0.4, y: 1, z: -0.6 })
  }),

  inventory: Object.freeze({
    HOTBAR_SIZE: 9,
    SLOT_MAX_STACK: 64
  }),

  assets: Object.freeze({
    /**
     * Vite publica el contenido de /assets en la raíz del servidor (ver vite.config.js),
     * por eso estas rutas no incluyen el prefijo "assets/".
     */
    TEXTURE_BASE_PATH: '/textures/blocks/',
    AUDIO_BASE_PATH: '/audio/'
  }),

  input: Object.freeze({
    /** Mapa tecla -> acción lógica. Cambiar controles no requiere tocar el código. */
    KEY_BINDINGS: Object.freeze({
      KeyW: InputActions.MOVE_FORWARD,
      KeyS: InputActions.MOVE_BACKWARD,
      KeyA: InputActions.MOVE_LEFT,
      KeyD: InputActions.MOVE_RIGHT,
      Space: InputActions.JUMP,
      ShiftLeft: InputActions.SPRINT,
      Escape: InputActions.PAUSE,
      F3: InputActions.TOGGLE_DEBUG
    }),
    /** Teclas 1-9: selección directa de slot de la hotbar. */
    HOTBAR_KEY_PREFIX: 'Digit'
  }),

  debug: Object.freeze({
    SHOW_OVERLAY_ON_START: true,
    /** Intervalo de refresco del overlay en segundos, para no escribir en el DOM cada frame. */
    OVERLAY_REFRESH_INTERVAL: 0.2
  })
});
