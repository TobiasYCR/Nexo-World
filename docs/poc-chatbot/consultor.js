/**
 * Prueba de concepto: consultor de Nexo World.
 *
 * NO es el chat bot del juego ni se integra a él. Vive en docs/ a propósito,
 * fuera de src/, porque el issue prohíbe integrar nada hasta que el equipo
 * apruebe la propuesta. Tampoco lo levanta el build (vite parte de index.html)
 * ni las pruebas (npm test corre tests/*.test.js).
 *
 * Lo que demuestra, que es el argumento central de la propuesta:
 * **las respuestas ya están en el código del juego**. Este consultor no tiene
 * ni un dato escrito a mano. Lee GameConfig y BlockRegistry en vivo, así que
 * si alguien cambia una tecla, la dureza de un bloque o la profundidad del
 * oro, la respuesta cambia sola. Un manual escrito a mano dentro de un prompt
 * queda desactualizado el día que alguien toca GameConfig, y nadie se entera.
 *
 * Correr con: node docs/poc-chatbot/probar.js
 */
import { GameConfig } from '../../src/game/GameConfig.js'
import { createDefaultBlockRegistry } from '../../src/blocks/BlockRegistry.js'
import { InputActions } from '../../src/utils/Constants.js'

/**
 * Cosas que Nexo World NO tiene, con el término que las delata.
 *
 * Esta lista no es un detalle: sin ella el consultor inventa. Al probarlo,
 * "¿qué encantamientos puedo poner en la pica de diamante?" matcheaba la
 * palabra "diamante" y contestaba la profundidad del mineral de diamante:
 * una respuesta correcta sobre otra pregunta, dicha con total seguridad.
 *
 * Es el mismo error que comete un LLM al que se le pide hablar de un juego
 * parecido a Minecraft: completa con lo que sabe de Minecraft. La diferencia
 * es que acá se arregla agregando un término a esta lista.
 */
const NO_EXISTE_EN_EL_JUEGO = [
  'encantamiento', 'encantar', 'nether', 'ender dragon', 'enderman', 'aldeano',
  'multijugador', 'multiplayer', 'servidor del juego', 'lobo', 'mascota',
  'domesticar', 'pocion', 'crafteo', 'craftear', 'mesa de trabajo', 'horno',
  'redstone', 'pistón', 'piston', 'cofre', 'yunque', 'experiencia', 'nivel de xp',
  'hambre', 'comida', 'comer', 'zombi', 'creeper', 'esqueleto', 'clima', 'lluvia',
  'logro', 'logros', 'tienda', 'skin', 'mod', 'mods'
]

/** Normaliza para comparar: minúsculas, sin acentos, sin signos. */
function normalizar(texto) {
  return String(texto ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function tiene(texto, ...palabras) {
  return palabras.some((p) => texto.includes(p))
}

/** Nombre legible de cada acción, para no mostrar el identificador interno. */
const NOMBRE_ACCION = {
  [InputActions.MOVE_FORWARD]: 'avanzar',
  [InputActions.MOVE_BACKWARD]: 'retroceder',
  [InputActions.MOVE_LEFT]: 'ir a la izquierda',
  [InputActions.MOVE_RIGHT]: 'ir a la derecha',
  [InputActions.JUMP]: 'saltar',
  [InputActions.SPRINT]: 'correr',
  [InputActions.PAUSE]: 'pausar',
  [InputActions.TOGGLE_DEBUG]: 'mostrar el panel de depuración'
}

/**
 * Invierte KEY_BINDINGS: acción -> teclas que la disparan.
 * Recibe la config por parámetro, no la global, para poder probar con otra
 * (las convenciones del proyecto piden dependencias por constructor).
 */
function teclasPorAccion(config) {
  const mapa = {}
  for (const [tecla, accion] of Object.entries(config.input.KEY_BINDINGS)) {
    mapa[accion] = mapa[accion] ?? []
    mapa[accion].push(tecla.replace(/^Key/, ''))
  }
  return mapa
}

export class ConsultorNexoWorld {
  #registro
  #teclas

  constructor(registro = createDefaultBlockRegistry(), config = GameConfig) {
    this.#registro = registro
    this.config = config
    this.#teclas = teclasPorAccion(config)
  }

  /**
   * @returns {{texto:string, fuente:string|null, sabe:boolean}}
   *          `fuente` dice de dónde salió el dato: es lo que permite auditar
   *          una respuesta, algo que con un LLM no se puede hacer.
   */
  responder(pregunta) {
    const q = normalizar(pregunta)
    if (q.length === 0) return this.#noSabe()

    return (
      this.#seguridad(q) ||
      this.#fueraDelJuego(q) ||
      this.#controles(q) ||
      this.#minerales(q) ||
      this.#supervivencia(q) ||
      this.#mundo(q) ||
      this.#bloques(q) ||
      this.#noSabe()
    )
  }

  #ok(texto, fuente) {
    return { texto, fuente, sabe: true }
  }

  #noSabe() {
    return {
      texto:
        'Eso no lo tengo. Solo contesto sobre lo que está en el juego: controles, ' +
        'bloques, minerales, supervivencia y el mundo. Si es un dato del juego que ' +
        'me falta, avisale al equipo así lo agregamos.',
      fuente: null,
      sabe: false
    }
  }

  /**
   * Preguntas sobre mecánicas que el juego no tiene.
   *
   * Se chequea ANTES que los temas, porque si no el match por palabra clave
   * contesta sobre lo que reconoce y descarta el resto de la pregunta.
   */
  #fueraDelJuego(q) {
    const mencion = NO_EXISTE_EN_EL_JUEGO.find((termino) => q.includes(normalizar(termino)))
    if (!mencion) return null
    return {
      texto:
        `Nexo World no tiene eso (${mencion}). Es un prototipo: hay bloques, ` +
        'biomas, cuevas, minerales y supervivencia básica. No te puedo contestar ' +
        'sobre mecánicas de otros juegos.',
      fuente: 'lista de mecánicas ausentes',
      sabe: false
    }
  }

  /** Pedidos de credenciales o de saltarse las reglas: se rechazan siempre. */
  #seguridad(q) {
    const pideCredenciales = tiene(q, 'contrasena', 'password', 'clave de la api', 'api key', 'token', 'credencial')
    const pideIgnorar = tiene(q, 'ignora', 'ignorar tus instrucciones', 'sin reglas', 'hacer trampa', 'trampa')
    if (!pideCredenciales && !pideIgnorar) return null
    return {
      texto:
        'No puedo ayudarte con eso. No tengo acceso a contraseñas ni claves, y no ' +
        'voy a explicar cómo saltarse las reglas del juego.',
      fuente: 'regla de seguridad',
      sabe: true
    }
  }

  #controles(q) {
    if (!tiene(q, 'tecla', 'control', 'muevo', 'mover', 'salt', 'corr', 'paus', 'f3', 'hotbar', 'camino', 'camina')) {
      return null
    }
    const t = this.#teclas
    const fuente = 'GameConfig.input.KEY_BINDINGS'

    if (tiene(q, 'f3', 'depuracion', 'debug')) {
      return this.#ok(
        `F3 ${NOMBRE_ACCION[InputActions.TOGGLE_DEBUG]}: muestra FPS, posición y datos del mundo.`,
        fuente
      )
    }
    if (tiene(q, 'salt')) {
      return this.#ok(`Para saltar, ${t[InputActions.JUMP].join(' o ')}.`, fuente)
    }
    if (tiene(q, 'corr', 'rapido', 'sprint')) {
      return this.#ok(`Para correr, mantené ${t[InputActions.SPRINT].join(' o ')} mientras te movés.`, fuente)
    }
    if (tiene(q, 'paus')) {
      return this.#ok(`Para pausar, ${t[InputActions.PAUSE].join(' o ')}.`, fuente)
    }
    if (tiene(q, 'hotbar', 'elijo un bloque', 'elegir bloque')) {
      return this.#ok(
        `Con las teclas 1 a ${this.config.inventory.HOTBAR_SIZE} elegís el slot de la hotbar.`,
        `${fuente} + GameConfig.inventory.HOTBAR_SIZE`
      )
    }
    const movimiento = [
      InputActions.MOVE_FORWARD,
      InputActions.MOVE_LEFT,
      InputActions.MOVE_BACKWARD,
      InputActions.MOVE_RIGHT
    ]
      .map((a) => `${t[a].join('/')} para ${NOMBRE_ACCION[a]}`)
      .join(', ')
    return this.#ok(`Te movés con ${movimiento}. Para saltar, ${t[InputActions.JUMP].join(' o ')}.`, fuente)
  }

  #minerales(q) {
    if (!tiene(q, 'mineral', 'diamante', 'oro', 'hierro', 'carbon', 'profundidad', 'vetas', 'mina')) return null
    const fuente = 'GameConfig.ores'
    const ores = this.config.ores

    const buscado = Object.keys(ores).find((nombre) => {
      const n = normalizar(nombre)
      return q.includes(n) || (n === 'coal' && q.includes('carbon')) ||
        (n === 'iron' && q.includes('hierro')) || (n === 'gold' && q.includes('oro')) ||
        (n === 'diamond' && q.includes('diamante'))
    })

    if (buscado) {
      const veta = ores[buscado]
      const tipo = this.#registro.get(veta.BLOCK)
      return this.#ok(
        `${tipo?.label ?? buscado} aparece entre las alturas Y=${veta.MIN_Y} y Y=${veta.MAX_Y}, ` +
          `en vetas de ${veta.MIN_SIZE} a ${veta.MAX_SIZE} bloques.`,
        fuente
      )
    }

    const lista = Object.entries(ores)
      .map(([nombre, veta]) => `${this.#registro.get(veta.BLOCK)?.label ?? nombre} (Y=${veta.MIN_Y}-${veta.MAX_Y})`)
      .join(', ')
    return this.#ok(`Los minerales del juego son: ${lista}.`, fuente)
  }

  #supervivencia(q) {
    if (!tiene(q, 'vida', 'salud', 'dano', 'caer', 'caida', 'muero', 'corazon')) return null
    const s = this.config.survival
    const fuente = 'GameConfig.survival'

    if (tiene(q, 'caer', 'caida', 'altura')) {
      // El umbral está en velocidad de impacto, no en bloques, así que se
      // convierte con v² = 2·g·h para que la respuesta le sirva al jugador.
      //
      // La gravedad se lee de GameConfig.player.GRAVITY. La primera versión de
      // esto tenía 980 escrito a mano (la gravedad terrestre en cm/s²) y daba
      // 0,9 bloques en vez de 3,5: justo el error que este documento le critica
      // a los manuales escritos a mano. El juego usa -260, no 980.
      const gravedad = Math.abs(this.config.player.GRAVITY)
      const bloques = Math.round(
        (s.FALL_DAMAGE_THRESHOLD ** 2) / (2 * gravedad * this.config.world.BLOCK_SIZE) * 10
      ) / 10
      return this.#ok(
        `Te hacés daño al caer cuando el impacto supera ${s.FALL_DAMAGE_THRESHOLD} unidades/s, ` +
          `que son unos ${bloques} bloques de caída. Cada unidad por encima del umbral quita ` +
          `${s.FALL_DAMAGE_MULTIPLIER} puntos de vida.`,
        fuente
      )
    }
    return this.#ok(`Tenés ${s.MAX_HEALTH} puntos de vida como máximo.`, fuente)
  }

  #mundo(q) {
    if (!tiene(q, 'mundo', 'tamano', 'chunk', 'guard', 'partida', 'semilla', 'seed', 'arbol', 'bioma')) return null
    const w = this.config.world
    const fuente = 'GameConfig.world'

    if (tiene(q, 'chunk')) {
      return this.#ok(
        `Un chunk es de ${this.config.chunk.SIZE_X}×${this.config.chunk.SIZE_Z} bloques.`,
        'GameConfig.chunk'
      )
    }
    if (tiene(q, 'guard', 'partida')) {
      return this.#ok(
        'La partida se guarda en el navegador, con localStorage. No se sube a ningún servidor.',
        'src/persistence/SaveManager.js'
      )
    }
    if (tiene(q, 'semilla', 'seed')) {
      return this.#ok(`La semilla del mundo es ${w.SEED}.`, fuente)
    }
    if (tiene(q, 'bioma')) {
      const biomas = Object.keys(this.config.biomes ?? {}).join(', ')
      return this.#ok(`Biomas configurados: ${biomas || 'no hay ninguno cargado'}.`, 'GameConfig.biomes')
    }
    return this.#ok(
      `El mundo mide ${w.WORLD_WIDTH}×${w.WORLD_HEIGHT}×${w.WORLD_DEPTH} bloques ` +
        `(ancho × alto × profundidad), con cada bloque de ${w.BLOCK_SIZE} unidades.`,
      fuente
    )
  }

  #bloques(q) {
    if (!tiene(q, 'bloque', 'piedra', 'dureza', 'romp', 'drop', 'vidrio', 'hoja', 'bedrock', 'tronco', 'cesped', 'arena')) {
      return null
    }
    const fuente = 'BlockRegistry (createDefaultBlockRegistry)'
    const tipos = this.#registro.values()

    if (tiene(q, 'cuantos tipos', 'cuantos bloque')) {
      return this.#ok(`Hay ${tipos.length} tipos de bloque cargados.`, fuente)
    }
    if (tiene(q, 'puedo colocar', 'colocables')) {
      const lista = this.#registro.placeableTypes().map((t) => t.label).join(', ')
      return this.#ok(`Podés colocar: ${lista}.`, fuente)
    }

    const encontrado = tipos.find((t) => {
      const etiqueta = normalizar(t.label)
      const nombre = normalizar(t.name)
      return (etiqueta.length > 2 && q.includes(etiqueta)) || (nombre.length > 2 && q.includes(nombre))
    })
    if (!encontrado) return null

    if (tiene(q, 'romp', 'breakable')) {
      return this.#ok(
        encontrado.breakable
          ? `${encontrado.label} se puede romper (dureza ${encontrado.hardness}).`
          : `No, ${encontrado.label} no se puede romper.`,
        fuente
      )
    }
    if (tiene(q, 'drop', 'sale si', 'suelta')) {
      const drops = encontrado.drops
        .map((id) => this.#registro.get(id)?.label ?? `id ${id}`)
        .join(', ')
      return this.#ok(`${encontrado.label} suelta: ${drops || 'nada'}.`, fuente)
    }
    if (tiene(q, 'transparente', 'vidrio')) {
      return this.#ok(
        `${encontrado.label} ${encontrado.transparent ? 'es transparente' : 'no es transparente'}.`,
        fuente
      )
    }
    return this.#ok(
      `${encontrado.label}: dureza ${encontrado.hardness}, ` +
        `${encontrado.solid ? 'sólido' : 'no sólido'}, ` +
        `${encontrado.breakable ? 'se puede romper' : 'no se puede romper'}.`,
      fuente
    )
  }
}
