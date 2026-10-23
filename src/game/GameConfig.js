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

  /**
   * Puntuación y clasificación (Backend 2). Ver docs/PROGRESION.md para la
   * justificación de cada regla. Ningún otro módulo declara valores de puntos.
   */
  progression: Object.freeze({
    /** Modo de la partida actual. Cada modo tiene su propia clasificación. */
    GAME_MODE: 'survival',
    MODES: Object.freeze(['survival', 'creative']),
    /** Lado, en columnas, de cada celda de exploración del mapa. */
    EXPLORATION_CELL_SIZE: 8,
    POINTS: Object.freeze({
      /** Por cada celda de exploración visitada por primera vez en un mundo. */
      EXPLORATION_CELL: 5,
      /** Por cada bioma pisado por primera vez en un mundo. */
      BIOME_DISCOVERED: 50,
      /** Por cada bloque construido que sigue en pie (saldo neto). */
      BLOCK_BUILT: 1,
      /** Por mineral natural extraído, una sola vez por posición. */
      ORES: Object.freeze({
        [BlockIds.COAL_ORE]: 1,
        [BlockIds.IRON_ORE]: 2,
        [BlockIds.GOLD_ORE]: 5,
        [BlockIds.DIAMOND_ORE]: 10
      })
    }),
    /** Tope de bloques construidos que suman puntos por mundo: el servidor no puede verificarlos. */
    MAX_BLOCKS_BUILT_COUNTED: 2000,
    /** Cada cuántos segundos de juego se envía el progreso pendiente al servidor. */
    SYNC_INTERVAL_SECONDS: 10,
    REQUEST_TIMEOUT_MS: 5000,
    API_BASE_PATH: '/api',
    LEADERBOARD_DEFAULT_LIMIT: 10,
    LEADERBOARD_MAX_LIMIT: 100,
    /** Ritmo máximo de puntos que acepta el servidor, más un margen inicial. */
    MAX_POINTS_PER_MINUTE: 600,
    RATE_BURST_POINTS: 300,
    PLAYER_NAME_MIN_LENGTH: 3,
    PLAYER_NAME_MAX_LENGTH: 20
  }),

  /**
   * Niveles representativos (Frontend 1). La experiencia tiene pesos propios
   * y se deriva de las estadísticas de progreso; no desbloquea contenido.
   * BASE_XP es el umbral del nivel 2 y GROWTH multiplica cada umbral siguiente.
   */
  levels: Object.freeze({
    /** Explorar una celda nueva premia el recorrido, sin dominar la curva. */
    XP_EXPLORATION_CELL: 5,
    /** Descubrir un bioma es menos frecuente y por eso tiene mayor peso. */
    XP_BIOME: 40,
    /** Cada mineral natural extraído aporta una cantidad intermedia. */
    XP_ORES: 12,
    /** Construir aporta poco por bloque y nunca resta experiencia. */
    XP_BLOCK_BUILT: 1,
    /** Experiencia acumulada para pasar del nivel 1 al 2. */
    BASE_XP: 100,
    /** Curva progresiva: cada umbral es 1,35 veces el anterior. */
    GROWTH: 1.35,
    /** Tope representativo; el contenido nunca depende de este valor. */
    MAX_LEVEL: 50,
    SHOW_LEVEL_UP_EFFECT: true,
    /** Parámetros del destello de primera persona, separado del contrato numérico. */
    EFFECT_DURATION: 0.8,
    EFFECT_PARTICLE_COUNT: 8,
    EFFECT_RADIUS: 5,
    EFFECT_PARTICLE_HEIGHT: 0.8,
    EFFECT_SIZE: 1.5,
    EFFECT_SPIN_SPEED: 4,
    EFFECT_COLOR: Object.freeze([255, 220, 96]),
    EFFECT_ALPHA: 220,
    EFFECT_HAND_OFFSET: Object.freeze({ x: 9, y: -3, z: -15 })
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
        SWING_ROTATION: 0.85,
        OFFSET: Object.freeze({ x: -2, y: 3, z: -1 })
      })
    }),

    highlight: Object.freeze({
      /** Cuánto más grande es la caja de resalte que el bloque, para no parpadear contra sus caras. */
      EXPANSION: 0.005,
      STROKE_COLOR: Object.freeze([12, 12, 14, 170]),
      STROKE_WEIGHT: 1.5
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
      /** Tope del pool: ninguna partícula nueva se crea por encima de este número. */
      MAX_PARTICLES: 64
    }),

    viewBob: Object.freeze({
      AMPLITUDE: 2.2,
      FREQUENCY: 9,
      /** Velocidad horizontal a la que el balanceo llega a su amplitud máxima. */
      REFERENCE_SPEED: 120
    })
  })
});
