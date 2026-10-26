/**
 * Catálogo de intenciones del chat bot: qué puede preguntar un jugador y con
 * qué identificador se resuelve.
 *
 * Cada entrada tiene varias formulaciones de la MISMA pregunta. No son
 * respuestas: son ejemplos para que el matcher difuso reconozca la variante que
 * escribió el jugador. Las respuestas se derivan de los datos del juego
 * (GameKnowledge) o de las librerías (GeneralKnowledge), nunca se escriben acá.
 *
 * El prefijo del id enruta: "game." lo contesta GameKnowledge, "general." lo
 * contesta GeneralKnowledge.
 */
export const IntentCatalog = Object.freeze([
  // ---------------------------------------------------------------- controles
  Object.freeze({
    id: 'game.controls.move',
    phrases: Object.freeze(['como me muevo', 'como camino', 'controles de movimiento', 'cuales son los controles', 'como se juega', 'teclas del juego', 'como manejo al personaje'])
  }),
  Object.freeze({
    id: 'game.controls.jump',
    phrases: Object.freeze(['como salto', 'cual es la tecla para saltar', 'como se salta', 'tecla de salto'])
  }),
  Object.freeze({
    id: 'game.controls.sprint',
    phrases: Object.freeze(['como corro', 'como voy mas rapido', 'tecla para correr', 'como esprinto'])
  }),
  Object.freeze({
    id: 'game.controls.pause',
    phrases: Object.freeze(['como pauso el juego', 'tecla de pausa', 'como salgo del juego', 'como vuelvo al menu'])
  }),
  Object.freeze({
    id: 'game.controls.debug',
    phrases: Object.freeze(['que hace f3', 'para que sirve f3', 'panel de depuracion', 'como veo los fps', 'como veo mi posicion en pantalla'])
  }),
  Object.freeze({
    id: 'game.controls.hotbar',
    phrases: Object.freeze(['como elijo un bloque', 'como cambio de bloque', 'para que sirve la hotbar', 'como selecciono el slot'])
  }),
  Object.freeze({
    id: 'game.controls.interact',
    phrases: Object.freeze(['como rompo un bloque', 'como pongo un bloque', 'como construyo', 'como coloco bloques', 'con que boton rompo'])
  }),
  Object.freeze({
    id: 'game.controls.inventory',
    phrases: Object.freeze(['como abro el inventario', 'tecla del inventario', 'donde veo mis bloques'])
  }),
  Object.freeze({
    id: 'game.controls.chat',
    phrases: Object.freeze(['como abro el chat', 'como te hablo', 'tecla del chat', 'como cierro el chat'])
  }),

  // ----------------------------------------------------------------- bloques
  Object.freeze({
    id: 'game.blocks.list',
    phrases: Object.freeze(['que bloques hay', 'lista de bloques', 'que tipos de bloque existen', 'que materiales hay'])
  }),
  Object.freeze({
    id: 'game.blocks.count',
    phrases: Object.freeze(['cuantos tipos de bloque hay', 'cuantos bloques distintos hay'])
  }),
  Object.freeze({
    id: 'game.blocks.placeable',
    phrases: Object.freeze(['que bloques puedo colocar', 'que puedo construir', 'con que bloques puedo edificar'])
  }),
  Object.freeze({
    id: 'game.blocks.breakTime',
    phrases: Object.freeze(['cuanto tarda en romperse un bloque', 'por que tarda tanto romper', 'como funciona la dureza'])
  }),

  // --------------------------------------------------------------- minerales
  Object.freeze({
    id: 'game.ores.list',
    phrases: Object.freeze(['que minerales hay', 'lista de minerales', 'que puedo minar', 'donde hay minerales'])
  }),

  // ---------------------------------------------------------- supervivencia
  Object.freeze({
    id: 'game.survival.health',
    phrases: Object.freeze(['cuanta vida tengo', 'cuantos corazones hay', 'cual es la vida maxima', 'como funciona la salud'])
  }),
  Object.freeze({
    id: 'game.survival.fall',
    phrases: Object.freeze(['desde que altura me lastimo', 'como funciona el dano por caida', 'cuanto puedo caer sin morir', 'me hago dano si me caigo'])
  }),
  Object.freeze({
    id: 'game.survival.death',
    phrases: Object.freeze(['que pasa si me muero', 'que pasa cuando pierdo toda la vida', 'donde reaparezco'])
  }),

  // -------------------------------------------------------------------- mundo
  Object.freeze({
    id: 'game.world.size',
    phrases: Object.freeze(['que tamano tiene el mundo', 'cuan grande es el mapa', 'cuantos bloques mide el mundo', 'hasta donde llega el mundo'])
  }),
  Object.freeze({
    id: 'game.world.chunk',
    phrases: Object.freeze(['que es un chunk', 'de que tamano es un chunk', 'como se divide el mundo'])
  }),
  Object.freeze({
    id: 'game.world.seed',
    phrases: Object.freeze(['cual es la semilla del mundo', 'que semilla tiene la partida', 'puedo cambiar la semilla'])
  }),
  Object.freeze({
    id: 'game.world.biomes',
    phrases: Object.freeze(['que biomas hay', 'cuantos biomas tiene el juego', 'hay desierto', 'hay montanas'])
  }),
  Object.freeze({
    id: 'game.world.caves',
    phrases: Object.freeze(['hay cuevas', 'como encuentro una cueva', 'a que profundidad hay cuevas'])
  }),
  Object.freeze({
    id: 'game.world.trees',
    phrases: Object.freeze(['hay arboles', 'como se generan los arboles', 'de que altura son los arboles'])
  }),
  Object.freeze({
    id: 'game.world.save',
    phrases: Object.freeze(['como se guarda la partida', 'donde se guarda mi mundo', 'se pierde mi partida', 'puedo cargar una partida'])
  }),

  Object.freeze({
    id: 'game.world.bottom',
    phrases: Object.freeze(['que pasa si cavo hasta abajo', 'que hay en el fondo del mundo', 'hasta donde puedo cavar', 'que es la roca madre'])
  }),
  Object.freeze({
    id: 'game.world.ceiling',
    phrases: Object.freeze(['hasta que altura puedo construir', 'cual es el limite de altura', 'cuan alto puedo llegar'])
  }),
  Object.freeze({
    id: 'game.world.findCaves',
    phrases: Object.freeze(['como encuentro una cueva', 'donde entro a una cueva', 'como llego a las cuevas'])
  }),
  Object.freeze({
    id: 'game.world.mining',
    phrases: Object.freeze(['como consigo diamantes', 'cual es la mejor forma de minar', 'donde conviene cavar', 'como encuentro minerales'])
  }),

  // ------------------------------------------------------------- el programa
  Object.freeze({
    id: 'game.meta.settings',
    phrases: Object.freeze(['como cambio la configuracion', 'donde estan las opciones', 'como cambio la sensibilidad del mouse', 'como cambio el campo de vision'])
  }),
  Object.freeze({
    id: 'game.meta.performance',
    phrases: Object.freeze(['por que va lento', 'como mejoro los fps', 'el juego va a tirones', 'por que tengo pocos fps'])
  }),
  Object.freeze({
    id: 'game.meta.account',
    phrases: Object.freeze(['como me registro', 'como creo una cuenta', 'para que sirve iniciar sesion', 'se guardan mis datos'])
  }),
  Object.freeze({
    id: 'game.meta.sound',
    phrases: Object.freeze(['hay sonido', 'por que no escucho nada', 'como activo el audio'])
  }),

  // ------------------------------------------------------- estado de partida
  Object.freeze({
    id: 'game.status.position',
    phrases: Object.freeze(['donde estoy', 'cual es mi posicion', 'en que coordenadas estoy', 'a que altura estoy'])
  }),
  Object.freeze({
    id: 'game.status.health',
    phrases: Object.freeze(['cuanta vida me queda', 'como estoy de salud', 'estoy herido'])
  }),
  Object.freeze({
    id: 'game.status.hotbar',
    phrases: Object.freeze(['que bloque tengo en la mano', 'que tengo seleccionado', 'que hay en mi hotbar'])
  }),
  Object.freeze({
    id: 'game.status.world',
    phrases: Object.freeze(['en que bioma estoy', 'que hay debajo de mi', 'en que chunk estoy'])
  }),

  // ---------------------------------------------------------------- el juego
  Object.freeze({
    id: 'game.about',
    phrases: Object.freeze(['que es nexo world', 'de que trata el juego', 'quien hizo el juego', 'con que esta hecho el juego', 'que se puede hacer en el juego'])
  }),

  // --------------------------------------------------------- charla y ayuda
  Object.freeze({
    id: 'general.help',
    phrases: Object.freeze(['ayuda', 'que podes hacer', 'que sabes hacer', 'de que puedo preguntarte', 'en que me podes ayudar', 'que cosas sabes'])
  }),
  Object.freeze({
    id: 'general.smallTalk.greeting',
    phrases: Object.freeze(['hola', 'buenas', 'buen dia', 'buenas tardes', 'buenas noches', 'que hace'])
  }),
  Object.freeze({
    id: 'general.smallTalk.name',
    phrases: Object.freeze(['quien sos', 'como te llamas', 'cual es tu nombre', 'sos un bot', 'sos una inteligencia artificial', 'quien te hizo', 'quien te programo'])
  }),
  Object.freeze({
    id: 'general.smallTalk.mood',
    phrases: Object.freeze(['como estas', 'como andas', 'todo bien', 'que tal'])
  }),
  Object.freeze({
    id: 'general.smallTalk.thanks',
    phrases: Object.freeze(['gracias', 'muchas gracias', 'te agradezco', 'genial gracias'])
  }),
  Object.freeze({
    id: 'general.smallTalk.bye',
    phrases: Object.freeze(['chau', 'adios', 'hasta luego', 'nos vemos', 'me voy'])
  }),
  Object.freeze({
    id: 'general.smallTalk.joke',
    phrases: Object.freeze(['contame un chiste', 'decime algo graciosos', 'hacete el gracioso', 'sabes chistes'])
  }),
  Object.freeze({
    id: 'general.random.coin',
    phrases: Object.freeze(['cara o cruz', 'tira una moneda', 'decidi por mi', 'si o no'])
  }),
  Object.freeze({
    id: 'general.random.dice',
    phrases: Object.freeze(['tira un dado', 'tirame un dado', 'numero al azar', 'dame un numero random'])
  }),
  Object.freeze({
    id: 'general.time.today',
    phrases: Object.freeze(['que dia es hoy', 'que fecha es', 'que hora es', 'en que ano estamos'])
  })
]);
