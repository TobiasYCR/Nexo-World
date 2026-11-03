/**
 * Temas generales que el bot puede explicar, fuera de los datos del juego.
 *
 * A diferencia de GameKnowledge, estas respuestas están ESCRITAS A MANO: no se
 * derivan de nada y nadie las puede verificar contra el código. Por eso el bot
 * las devuelve con la fuente "respuesta escrita a mano" y por eso la lista es
 * corta y se limita a cosas que no cambian.
 *
 * Es la concesión consciente del punto 1.3 de docs/CHATBOT.md: el texto escrito
 * a mano es el único origen que cubre el "por qué", y el único que se
 * desactualiza en silencio. Conviene que sea lo más chico posible.
 */
export const GeneralTopics = Object.freeze([
  Object.freeze({
    id: 'voxel',
    phrases: Object.freeze(['que es un voxel', 'que significa voxel', 'que es un juego de voxels']),
    answer: 'Un voxel es el equivalente 3D de un píxel: un cubo en una grilla. En lugar de ' +
      'guardar formas, el mundo se guarda como "qué hay en cada celda", y eso es lo que permite ' +
      'romper y poner bloques en cualquier lado.'
  }),
  Object.freeze({
    id: 'chunk',
    phrases: Object.freeze(['que es un chunk en los juegos', 'para que sirven los chunks', 'por que se divide el mundo en chunks']),
    answer: 'Un chunk es un pedazo del mundo que se trata como una unidad. Sirve para no ' +
      'recalcular todo el mapa cuando cambia un bloque: se marca sucio solo el chunk afectado.'
  }),
  Object.freeze({
    id: 'javascript',
    phrases: Object.freeze(['que es javascript', 'que lenguaje es javascript', 'para que sirve javascript']),
    answer: 'JavaScript es el lenguaje que corre dentro del navegador. Es con el que está hecho ' +
      'todo Nexo World, motor y chat incluidos: no hay nada de servidor.'
  }),
  Object.freeze({
    id: 'p5',
    phrases: Object.freeze(['que es p5js', 'que es p5', 'que libreria usa el juego para dibujar']),
    answer: 'p5.js es una librería de dibujo para el navegador. Nexo World la usa en modo WEBGL, ' +
      'que es la que da acceso a la aceleración 3D de la placa de video.'
  }),
  Object.freeze({
    id: 'webgl',
    phrases: Object.freeze(['que es webgl', 'que es una gpu', 'por que el juego va lento']),
    answer: 'WebGL es la API que le permite al navegador dibujar en 3D usando la placa de video. ' +
      'Si la máquina no tiene GPU, el navegador lo emula por software y los FPS se caen: ahí el ' +
      'cuello de botella es el equipo, no el juego.'
  }),
  Object.freeze({
    id: 'localstorage',
    phrases: Object.freeze(['que es localstorage', 'donde guarda el navegador los datos', 'es seguro localstorage']),
    answer: 'localStorage es un almacén de texto que el navegador guarda por sitio. Es donde ' +
      'viven las partidas y las cuentas de Nexo World. No es un lugar seguro: el dueño del ' +
      'navegador lo puede leer y editar con las herramientas de desarrollo.'
  }),
  Object.freeze({
    id: 'git',
    phrases: Object.freeze(['que es git', 'que es un commit', 'que es un pull request']),
    answer: 'Git es el control de versiones del proyecto: un commit es un cambio con nombre y un ' +
      'pull request es el pedido de incorporar una rama, para que alguien la revise antes.'
  }),
  Object.freeze({
    id: 'ruido',
    phrases: Object.freeze(['que es el ruido perlin', 'como se genera el terreno', 'que es ruido procedural']),
    answer: 'El terreno no está dibujado a mano: sale de una función de ruido, que devuelve ' +
      'valores suaves y repetibles para cada coordenada. Con la misma semilla da siempre el ' +
      'mismo mundo, que es por qué una semilla alcanza para reconstruirlo.'
  }),
  Object.freeze({
    id: 'llm',
    phrases: Object.freeze(['que es un llm', 'que es un modelo de lenguaje', 'usas inteligencia artificial', 'usas chatgpt']),
    answer: 'Un modelo de lenguaje grande (LLM) genera texto prediciendo la continuación más ' +
      'probable. Yo no soy uno: funciono con reglas sobre los datos del juego. Por eso no ' +
      'invento, no cuesto plata y funciono sin internet, pero tampoco puedo charlar de cualquier cosa.'
  }),
  Object.freeze({
    id: 'hash',
    phrases: Object.freeze(['que es un hash', 'como se guardan las contrasenas', 'que es pbkdf2']),
    answer: 'Un hash es una huella de un dato, imposible de revertir en la práctica. Las ' +
      'contraseñas de Nexo World se guardan así, derivadas con PBKDF2 y una sal distinta por ' +
      'cuenta, para que quien lea el almacenamiento no obtenga la contraseña en claro.'
  }),
  Object.freeze({
    id: 'fps',
    phrases: Object.freeze(['que son los fps', 'cuantos fps son buenos', 'que es el framerate']),
    answer: 'Los FPS son los cuadros que se dibujan por segundo. De 60 para arriba se siente ' +
      'fluido, de 30 para abajo se nota el tirón. Los podés ver con el panel de depuración.'
  }),
  Object.freeze({
    id: 'colision',
    phrases: Object.freeze(['que es una caja de colision', 'que es un aabb', 'como sabe el juego que choque']),
    answer: 'Una AABB es una caja alineada a los ejes que envuelve al personaje. Comparar dos ' +
      'cajas así son seis comparaciones de números, que es la razón por la que casi todos los ' +
      'juegos de bloques las usan en lugar de la forma real.'
  }),
  Object.freeze({
    id: 'raycast',
    phrases: Object.freeze(['que es un raycast', 'como sabe que bloque estoy mirando']),
    answer: 'Un raycast es una línea que sale de la cámara y avanza celda por celda hasta tocar ' +
      'un bloque sólido. Es así como el juego decide a qué bloque le apuntás y cuál se rompe.'
  }),
  Object.freeze({
    id: 'fisica-gravedad',
    phrases: Object.freeze(['que es la gravedad', 'por que caen las cosas', 'por que caigo tan rapido en el juego']),
    answer: 'La gravedad es la atracción entre cuerpos con masa; en la Tierra acelera la caída unos ' +
      '9,8 m/s². En Nexo World es un número de configuración, no una medición: se eligió el valor ' +
      'que hace que saltar y caer se sientan bien, no el real.'
  }),
  Object.freeze({
    id: 'binario',
    phrases: Object.freeze(['que es el sistema binario', 'por que las computadoras usan ceros y unos', 'que es un bit']),
    answer: 'Un bit es un sí o un no. Las computadoras trabajan con dos estados porque es lo que un ' +
      'circuito distingue sin equivocarse: hay corriente o no hay. Ocho bits son un byte, y con un ' +
      'byte se cuentan 256 valores distintos.'
  }),
  Object.freeze({
    id: 'algoritmo',
    phrases: Object.freeze(['que es un algoritmo', 'que significa programar', 'que es el codigo']),
    answer: 'Un algoritmo son los pasos para resolver algo, escritos de forma que no quede nada a ' +
      'interpretación. Programar es escribirlos en un lenguaje que la máquina ejecuta igual todas ' +
      'las veces, incluso cuando lo que escribiste no era lo que querías decir.'
  }),
  Object.freeze({
    id: 'internet',
    phrases: Object.freeze(['que es internet', 'como funciona una pagina web', 'que es un servidor']),
    answer: 'Un servidor es una computadora que espera pedidos y contesta. Una página web es un pedido ' +
      'a uno de ellos que devuelve texto, que el navegador dibuja. Nexo World no tiene servidor: ' +
      'todo lo que ves corre en tu máquina.'
  }),
  Object.freeze({
    id: 'memoria',
    phrases: Object.freeze(['que es la memoria ram', 'cuanta memoria usa el juego', 'que es un gigabyte']),
    answer: 'La RAM es la memoria de trabajo: rápida y se borra al apagar. Un gigabyte son mil millones ' +
      'de bytes, más o menos. Un mundo de voxels se guarda como un número por celda, así que su ' +
      'tamaño en memoria es ancho × alto × profundidad, nada más.'
  }),
  Object.freeze({
    id: 'coordenadas',
    phrases: Object.freeze(['que significa x y z', 'que son las coordenadas', 'que significan las coordenadas', 'para que sirve el eje y', 'que es el eje vertical']),
    answer: 'X y Z son el plano horizontal y la Y es la altura. En Nexo World la Y crece hacia arriba: ' +
      'Y=0 es el fondo del mundo y los números grandes son el cielo. Las ves en el panel de ' +
      'depuración, o preguntándome dónde estás.'
  }),
  Object.freeze({
    id: 'semilla',
    phrases: Object.freeze(['que es una semilla', 'que es un generador pseudoaleatorio', 'por que el azar se repite']),
    answer: 'Una semilla es el número con el que arranca un generador de azar. El azar de una ' +
      'computadora no es azar: es una cuenta que parece desordenada pero da siempre lo mismo para ' +
      'la misma semilla. Por eso dos personas con la misma semilla reciben el mundo idéntico.'
  }),
  Object.freeze({
    id: 'open-source',
    phrases: Object.freeze(['que es codigo abierto', 'que es github', 'que es una licencia de software']),
    answer: 'Código abierto es software cuyo código se puede leer, copiar y modificar según su ' +
      'licencia. GitHub es donde vive el repositorio: aloja el código, el historial y las ' +
      'discusiones sobre los cambios.'
  }),
  Object.freeze({
    id: 'minecraft',
    phrases: Object.freeze(['esto es minecraft', 'en que se parece a minecraft', 'es una copia de minecraft']),
    answer: 'No. Nexo World es un trabajo de facultad que toma la idea de un mundo de cubos, que ' +
      'Minecraft popularizó. Tiene mucho menos: no hay crafteo, ni mobs, ni ciclo de día y noche, ' +
      'ni multijugador. Si me preguntás por algo de Minecraft que acá no existe, te lo voy a decir.'
  })
]);
