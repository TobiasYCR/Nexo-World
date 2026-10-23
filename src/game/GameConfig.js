import { InputActions, BlockIds } from '../utils/Constants.js';

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
    SAND_LEVEL: 6,
    TREE_DENSITY: 0.08,
    TREE_MIN_DISTANCE: 5,
    TREE_MIN_HEIGHT: 4,
    TREE_MAX_HEIGHT: 6,
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
    /** Velocidad de caída máxima: evita atravesar bloques a bajo framerate. */
    MAX_FALL_SPEED: 600,
    VOID_Y: -80,
    /** Dimensiones de la caja de colisión, en unidades de mundo. */
    WIDTH: 12,
    HEIGHT: 34,
    /** Altura de los ojos medida desde los pies. */
    EYE_HEIGHT: 30,
    /** Holgura entre la caja y una cara sólida: anti pegote por punto flotante. */
    COLLISION_SKIN: 0.05,
    /** Tolerancia de la sonda de suelo: debe ser mayor que COLLISION_SKIN. */
    GROUND_TOLERANCE: 0.3,
    /** Desnivel que se sube sin saltar, en unidades de mundo (un bloque). */
    STEP_HEIGHT: 20,
    SPAWN: Object.freeze({ x: 160, y: 200, z: 160 })
  }),

  blocks: Object.freeze({
    /** Alcance máximo del raycast de interacción, en unidades de mundo. */
    REACH_DISTANCE: 80,
    BREAK_TIME_PER_HARDNESS: 0.25
  }),

  /**
   * Generación del mundo (Backend 2). Las alturas en bloques de las secciones
   * worldGeneration, caves y ores están pensadas para un mundo de
   * REFERENCE_HEIGHT bloques y se escalan a la altura real (world.WORLD_HEIGHT).
   */
  worldGeneration: Object.freeze({
    REFERENCE_HEIGHT: 48,
    /** Frecuencia del ruido que reparte biomas: más chico, regiones más grandes. */
    BIOME_SCALE: 0.02,
    /** Ancho de la franja de mezcla de alturas entre biomas, en unidades de puntaje de bioma. */
    HEIGHT_SMOOTHING: 0.14,
    /** Capas inferiores con roca madre: y=0 siempre, las siguientes con probabilidad decreciente. */
    BEDROCK_LAYERS: 3,
    /** Bloques libres que se garantizan sobre el punto más alto del terreno. */
    SKY_MARGIN: 4,
    /** Frecuencia del ruido que agrupa árboles y abre claros en los bosques. */
    TREE_CLUSTER_SCALE: 0.08
  }),

  /** Peso relativo de cada bioma en el reparto del mapa (0 lo desactiva). */
  biomes: Object.freeze({
    PLAINS_WEIGHT: 1,
    FOREST_WEIGHT: 1,
    DESERT_WEIGHT: 1,
    MOUNTAINS_WEIGHT: 1
  }),

  caves: Object.freeze({
    ENABLED: true,
    /** Frecuencia del ruido de túneles: más alto, túneles más cortos y retorcidos. */
    FREQUENCY: 0.07,
    /** Grosor de los túneles (distancia a 0.5 en ambos campos de ruido). */
    TUNNEL_RADIUS: 0.035,
    /** Frecuencia del ruido de cavernas: más chico, salas más grandes. */
    CAVERN_FREQUENCY: 0.045,
    /** Umbral de cavernas: más alto, menos y más chicas. */
    THRESHOLD: 0.7,
    /** Estira las cuevas en horizontal (>1 = más chatas). */
    VERTICAL_SQUASH: 1.7,
    /** Altura (y) mínima y máxima donde puede haber cuevas. */
    MIN_DEPTH: 4,
    MAX_DEPTH: 36,
    /** Bloques de techo que se respetan bajo la superficie fuera de las entradas. */
    SURFACE_MARGIN: 4,
    /** Entradas: zonas donde la cueva puede abrirse al exterior. */
    ENTRANCE_SCALE: 0.06,
    ENTRANCE_THRESHOLD: 0.78
  }),

  /**
   * Vetas de mineral. MIN_Y/MAX_Y: rango de altura; VEINS_PER_CHUNK: vetas por
   * cada 16x16 columnas; MIN_SIZE/MAX_SIZE: bloques por veta. El orden importa:
   * los declarados después pisan a los anteriores donde se cruzan.
   */
  ores: Object.freeze({
    COAL: Object.freeze({ BLOCK: BlockIds.COAL_ORE, MIN_Y: 5, MAX_Y: 40, VEINS_PER_CHUNK: 9, MIN_SIZE: 4, MAX_SIZE: 10 }),
    IRON: Object.freeze({ BLOCK: BlockIds.IRON_ORE, MIN_Y: 3, MAX_Y: 28, VEINS_PER_CHUNK: 6, MIN_SIZE: 3, MAX_SIZE: 7 }),
    GOLD: Object.freeze({ BLOCK: BlockIds.GOLD_ORE, MIN_Y: 2, MAX_Y: 14, VEINS_PER_CHUNK: 2, MIN_SIZE: 3, MAX_SIZE: 6 }),
    DIAMOND: Object.freeze({ BLOCK: BlockIds.DIAMOND_ORE, MIN_Y: 1, MAX_Y: 9, VEINS_PER_CHUNK: 0.6, MIN_SIZE: 2, MAX_SIZE: 4 })
  }),

  survival: Object.freeze({
    MAX_HEALTH: 20,
    /** Velocidad vertical de impacto (unidades/s) desde la que hay daño: ~3,5 bloques de caída. */
    FALL_DAMAGE_THRESHOLD: 190,
    /** Puntos de vida por cada unidad/s de impacto sobre el umbral. */
    FALL_DAMAGE_MULTIPLIER: 0.05
  }),

  audio: Object.freeze({
    MASTER_VOLUME: 1,
    SFX_VOLUME: 1,
    MUSIC_VOLUME: 0.6,
    AMBIENT_VOLUME: 0.8
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

  users: Object.freeze({
    USERNAME_MIN_LENGTH: 3,
    USERNAME_MAX_LENGTH: 20,
    /** Letras, números, guion y guion bajo. Sin espacios ni símbolos: el nombre se usa como clave. */
    USERNAME_PATTERN: /^[A-Za-z0-9_-]+$/,
    PASSWORD_MIN_LENGTH: 8,
    /** Laxo a propósito: ver el comentario de UserValidator.checkEmail. */
    EMAIL_PATTERN: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    EMAIL_MAX_LENGTH: 254,
    /** Duración de una sesión local, en milisegundos: 7 días. */
    SESSION_TTL_MS: 7 * 24 * 60 * 60 * 1000,
    /** Tope alto para no derivar PBKDF2 sobre una entrada enorme y colgar la pestaña. */
    PASSWORD_MAX_LENGTH: 128,
    /**
     * Costo de PBKDF2. Más iteraciones encarecen la fuerza bruta y también el
     * login legítimo; 210.000 es la recomendación de OWASP para PBKDF2-SHA-256
     * y tarda decenas de milisegundos en un equipo de escritorio.
     */
    PBKDF2_ITERATIONS: 210000,
    SALT_BYTES: 16,
    DERIVED_KEY_BYTES: 32
  }),

  inventory: Object.freeze({
    HOTBAR_SIZE: 9,
    SLOT_MAX_STACK: 64,
    STARTER_BLOCK_COUNT: 64
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
  }),

  /**
   * Viewmodel: mano en primera persona y feedback visual de romper/colocar.
   * Sección de Frontend 1 (issue #9) — el resto de GameConfig no se toca.
   */
  viewmodel: Object.freeze({
    hand: Object.freeze({
      /** Duración del swing al romper/colocar, en segundos. */
      SWING_DURATION: 0.25,
      /** Distancia que recorre la mano durante el swing, en unidades de mundo. */
      SWING_DISTANCE: 6,
      /** Duración de la animación al cambiar de slot, en segundos. */
      SLOT_CHANGE_DURATION: 0.15,
      /** Cuánto baja la mano al cambiar de slot, en unidades de mundo. */
      SLOT_CHANGE_DROP: 5,
      /** Offset en reposo respecto al ojo de la cámara fija (x: derecha, y: arriba, z: adelante). */
      IDLE_OFFSET: Object.freeze({ x: 9, y: -3, z: -15 }),
      /** Lado del cubo que representa el bloque en la mano. */
      BLOCK_SCALE: 3,
      ARM_WIDTH: 3.5,
      ARM_LENGTH: 11,
      ARM_COLOR: Object.freeze([214, 168, 132]),
      PICKAXE: Object.freeze({
        HANDLE_COLOR: Object.freeze([116, 76, 42]),
        HEAD_COLOR: Object.freeze([150, 158, 166]),
        HANDLE_WIDTH: 1.2,
        HANDLE_LENGTH: 8,
        HEAD_WIDTH: 9,
        HEAD_HEIGHT: 1.8,
        HEAD_DEPTH: 1.6,
        /** Inclinación natural del pico: la cabeza queda por encima de la mano. */
        HOLD_ROTATION: -0.35,
        SWING_ROTATION: 0.85,
        OFFSET: Object.freeze({ x: -2, y: 3, z: -1 })
      })
    }),

    highlight: Object.freeze({
      /** Cuánto más grande es la caja de resalte que el bloque, para no parpadear contra sus caras. */
      EXPANSION: 0.005,
      STROKE_COLOR: Object.freeze([12, 12, 14, 170]),
      STROKE_WEIGHT: 1.5,
      TRANSITION_DURATION: 0.1
    }),

    breakOverlay: Object.freeze({
      STAGE_COUNT: 10,
      TEXTURE_BASE_PATH: '/textures/effects/',
      /** Segundos necesarios por punto de dureza del bloque para completar una rotura. */
      BREAK_DURATION_PER_HARDNESS: 0.25,
      /** Igual criterio que highlight.EXPANSION: evita z-fighting contra las caras del bloque. */
      EXPANSION: 0.01,
      /** Oscurecimiento de respaldo por etapa mientras la textura no cargó (0 a 1). */
      FALLBACK_ALPHA_PER_STAGE: 22
    }),

    particles: Object.freeze({
      MIN_COUNT: 12,
      MAX_COUNT: 16,
      LIFETIME_SECONDS: 0.6,
      GRAVITY: -260,
      SIZE: 2.5,
      INITIAL_SPEED: 55,
      PLACED_MIN_COUNT: 5,
      PLACED_MAX_COUNT: 8,
      PLACED_LIFETIME: 0.42,
      PLACED_INITIAL_SPEED: 28,
      PLACEMENT_BOUNCE: 0.25,
      ROTATION_SPEED: 4,
      TRANSPARENT_ALPHA: 0.7,
      /** Tope del pool: ninguna partícula nueva se crea por encima de este número. */
      MAX_PARTICLES: 64
    }),

    viewBob: Object.freeze({
      AMPLITUDE: 2.2,
      FREQUENCY: 9,
      /** Velocidad horizontal a la que el balanceo llega a su amplitud máxima. */
      REFERENCE_SPEED: 120,
      WALK_BOB_AMPLITUDE: 2.2,
      WALK_BOB_FREQUENCY: 9,
      RUN_BOB_MULTIPLIER: 1.2,
      STOP_SMOOTHING: 14
    }),

    handAnimator: Object.freeze({
      IDLE_BREATH_AMPLITUDE: 0.35,
      IDLE_BREATH_FREQUENCY: 1.6,
      BREAK_ROTATION: 0.85,
      PLACE_ROTATION: 0.38,
      LANDING_ROTATION: 0.08,
      LANDING_OFFSET: 2.2,
      LANDING_COMPRESSION: 0.08,
      EASING_POWER: 3
    }),

    landing: Object.freeze({
      ENABLED: true,
      MIN_IMPACT_SPEED: 135,
      MAX_IMPACT_SPEED: 360,
      DURATION: 0.24,
      HAND_OFFSET: 2.4,
      HAND_COMPRESSION: 0.08,
      CAMERA_OFFSET: 1.2
    }),

    damage: Object.freeze({
      ENABLED: true,
      FLASH_DURATION: 0.28,
      MAX_OPACITY: 0.42,
      COLOR: Object.freeze([210, 32, 32]),
      DEATH_DURATION: 0.45,
      DEATH_MAX_OPACITY: 0.58
    }),

    cameraEffects: Object.freeze({
      ENABLED: true,
      MAX_AMPLITUDE: 2.5,
      MAX_ROTATION: 0.035,
      DEFAULT_DURATION: 0.22,
      DECAY: 14
    }),

    ambientParticles: Object.freeze({
      ENABLED: true,
      MAX_PARTICLES: 64,
      DISTANCE: 120,
      PARTICLE_LIFETIME: 2.4,
      SIZE: 1.4,
      SPAWN_RATE: 26,
      DENSITY_PLAINS: 0.22,
      DENSITY_FOREST: 0.7,
      DENSITY_DESERT: 0.58,
      DENSITY_MOUNTAINS: 0.18,
      COLORS: Object.freeze({
        plains: Object.freeze([205, 225, 190]),
        forest: Object.freeze([154, 205, 132]),
        desert: Object.freeze([214, 178, 112]),
        mountains: Object.freeze([205, 215, 225])
      })
    }),

    effects: Object.freeze({
      PAUSE_FREEZES: true
    })
  })
});
