import { create, all } from 'mathjs';
import dayjs from 'dayjs';
import 'dayjs/locale/es.js';
import Fuse from 'fuse.js';
import { ChatResponse } from './ChatResponse.js';
import { GeneralTopics } from './GeneralTopics.js';
import { NumberFormatter } from './NumberFormatter.js';
import { TextNormalizer } from './TextNormalizer.js';
import { GameConfig } from '../game/GameConfig.js';

dayjs.locale('es');

/**
 * Instancia de mathjs acotada, compartida por todas las consultas.
 *
 * El orden de estas dos líneas importa y no es evidente: `evaluate` se captura
 * ANTES de deshabilitar funciones. mathjs resuelve `parse` por su propio
 * contenedor de dependencias, así que si se deshabilita `parse` primero, la
 * `evaluate` que queda tampoco sirve. Capturada antes, la referencia conserva
 * el parser original y las deshabilitadas siguen fuera del alcance del jugador.
 *
 * Qué se deshabilita y por qué: `import` y `createUnit` modifican la instancia,
 * y las demás permiten construir expresiones que se evalúan solas. Es la
 * recomendación de seguridad de mathjs para evaluar texto de terceros, y acá
 * todo lo que entra lo escribió el jugador.
 */
const math = create(all);
const evaluateExpression = math.evaluate;
const disabled = () => {
  throw new Error('Función deshabilitada en el evaluador del chat.');
};
math.import(
  {
    import: disabled,
    createUnit: disabled,
    reviver: disabled,
    evaluate: disabled,
    parse: disabled,
    simplify: disabled,
    derivative: disabled
  },
  { override: true }
);

/**
 * Las respuestas que no salen del juego: cuentas, conversiones de unidades,
 * fechas, temas generales y charla.
 *
 * Acá es donde el bot "responde un poco de todo", y donde se apoya en librerías
 * en lugar de reimplementarlas: mathjs evalúa las expresiones y convierte
 * unidades, dayjs hace la aritmética de fechas y Fuse.js busca el tema más
 * parecido. La alternativa era un parser de expresiones y una tabla de factores
 * escritos a mano, que es más código y más errores.
 */
export class GeneralKnowledge {
  /**
   * Unidades en español -> unidades de mathjs. mathjs entiende "m", "ft" o
   * "km/h", no "metros" ni "kilómetros por hora".
   */
  static UNIT_ALIASES = Object.freeze({
    milimetro: 'mm', milimetros: 'mm', mm: 'mm',
    centimetro: 'cm', centimetros: 'cm', cm: 'cm',
    metro: 'm', metros: 'm', m: 'm',
    kilometro: 'km', kilometros: 'km', km: 'km',
    pulgada: 'inch', pulgadas: 'inch',
    pie: 'ft', pies: 'ft',
    yarda: 'yd', yardas: 'yd',
    milla: 'mi', millas: 'mi',
    gramo: 'g', gramos: 'g', g: 'g',
    kilo: 'kg', kilos: 'kg', kilogramo: 'kg', kilogramos: 'kg', kg: 'kg',
    tonelada: 'ton', toneladas: 'ton',
    libra: 'lbm', libras: 'lbm',
    onza: 'oz', onzas: 'oz',
    litro: 'L', litros: 'L', l: 'L',
    mililitro: 'mL', mililitros: 'mL', ml: 'mL',
    galon: 'gal', galones: 'gal',
    segundo: 's', segundos: 's', s: 's',
    minuto: 'min', minutos: 'min', min: 'min',
    hora: 'h', horas: 'h', h: 'h',
    dia: 'day', dias: 'day',
    semana: 'week', semanas: 'week',
    ano: 'year', anos: 'year',
    celsius: 'degC', grados: 'degC', centigrados: 'degC',
    fahrenheit: 'degF',
    kelvin: 'K',
    byte: 'B', bytes: 'B',
    kilobyte: 'kB', kilobytes: 'kB',
    megabyte: 'MB', megabytes: 'MB',
    gigabyte: 'GB', gigabytes: 'GB',
    'km h': 'km/h', 'metros por segundo': 'm/s', 'millas por hora': 'mi/h'
  });

  /** Operadores escritos con palabras, como los tipea un jugador. */
  static WORD_OPERATORS = Object.freeze([
    // El porcentaje va primero: "10% de 50" tiene que resolverse antes de que
    // "de" se confunda con cualquier otra cosa.
    [/(\d+(?:[.,]\d+)?)\s*(?:%|por ciento)\s+de\s+(\d+(?:[.,]\d+)?)/g, '($2 * $1 / 100)'],
    [/\bmas\b/g, '+'],
    [/\bmenos\b/g, '-'],
    [/\b(?:por|multiplicado)\b/g, '*'],
    [/\b(?:dividido|entre)\b/g, '/'],
    [/\b(?:elevado a|a la)\b/g, '^'],
    [/\braiz(?:\s+cuadrada)?\s+de\s+(\d+(?:[.,]\d+)?)/g, 'sqrt($1)'],
    [/\braiz(?:\s+cuadrada)?\s+de\b/g, 'sqrt'],
    [/\braiz\b/g, 'sqrt'],
    [/\bfactorial de\s+(\d+)/g, 'factorial($1)']
  ]);

  /**
   * Lo único que se acepta en una expresión: números, operadores y un puñado de
   * funciones. Es una lista blanca a propósito: cualquier otra letra suelta
   * ("x = 3", "import") no llega al evaluador.
   */
  static EXPRESSION_PATTERN = /^[\d\s+\-*/^%().,!]*(?:(?:sqrt|abs|round|floor|ceil|log|ln|exp|sin|cos|tan|pi|e|factorial|nthRoot|mod)[\d\s+\-*/^%().,!]*)*$/;

  #config;
  #numbers;
  #clock;
  #topics;
  #topicFuse;

  /**
   * @param {Object} [options]
   * @param {Object} [options.config] sección chatbot de GameConfig
   * @param {NumberFormatter} [options.numbers]
   * @param {() => Date} [options.clock] reloj inyectable: las pruebas no pueden
   *        depender de la fecha real del día en que se corren
   * @param {Array} [options.topics]
   */
  constructor({
    config = GameConfig.chatbot,
    numbers = new NumberFormatter({ config }),
    clock = () => new Date(),
    topics = GeneralTopics
  } = {}) {
    this.#config = config;
    this.#numbers = numbers;
    this.#clock = clock;
    this.#topics = topics;
    this.#topicFuse = new Fuse(
      topics.map((topic) => ({ ...topic, haystack: topic.phrases.map((p) => TextNormalizer.stemmed(p)).join(' | ') })),
      { keys: ['haystack'], includeScore: true, ignoreLocation: true, threshold: config.TOPIC_THRESHOLD }
    );
  }

  /**
   * Respuestas que se reconocen por la forma de la pregunta, no por su tema:
   * una cuenta, una conversión o una fecha. Se prueban antes del matcher difuso
   * porque "¿cuánto es 1234*7?" no se parece a ninguna frase de ejemplo.
   * @returns {Object|null}
   */
  answerDirect(question) {
    // Se conservan los símbolos: sin ellos "1234*7" y "25/12/2026" llegan como
    // listas de números y no se reconoce ni la cuenta ni la fecha.
    const normalized = TextNormalizer.normalizeSymbols(question);
    return this.#conversion(normalized) ?? this.#dateMath(normalized) ?? this.#arithmetic(normalized);
  }

  /**
   * @param {string} intentId identificador del catálogo ("general.…")
   * @returns {Object|null}
   */
  answer(intentId) {
    const handlers = {
      'general.help': () => this.#help(),
      'general.smallTalk.greeting': () => this.#greeting(),
      'general.smallTalk.name': () => this.#name(),
      'general.smallTalk.mood': () => this.#mood(),
      'general.smallTalk.thanks': () => this.#thanks(),
      'general.smallTalk.bye': () => this.#bye(),
      'general.smallTalk.joke': () => this.#joke(),
      'general.time.today': () => this.#today()
    };
    return handlers[intentId]?.() ?? null;
  }

  /**
   * Tema general más parecido a la pregunta, si hay alguno lo bastante cerca.
   * @returns {Object|null}
   */
  answerTopic(question) {
    const stemmed = TextNormalizer.stemmed(question);
    if (stemmed === '') return null;

    const [best] = this.#topicFuse.search(stemmed, { limit: 1 });
    if (!best || (best.score ?? 1) > this.#config.TOPIC_THRESHOLD) return null;

    return ChatResponse.known(
      best.item.answer,
      ChatResponse.Topics.GENERAL,
      // Se declara que está escrita a mano: es lo que la distingue de un dato
      // del juego, que sí se puede verificar contra el código.
      'respuesta escrita a mano'
    );
  }

  get topicIds() {
    return this.#topics.map(({ id }) => id);
  }

  // ------------------------------------------------------------------- cuentas

  /** Expresión aritmética: "cuanto es 12*7", "(3+4)^2", "raiz de 81". */
  #arithmetic(normalized) {
    const stripped = normalized
      .replace(/^(?:cuanto|cuanta|cuantos)\s+(?:es|son|da|vale)\s*/, '')
      .replace(/^(?:calcula|calcular|resolve|resolver|cuenta)\s*/, '')
      .replace(/\s*\?+\s*$/, '')
      .trim();
    if (stripped === '') return null;

    let expression = stripped;
    for (const [pattern, replacement] of GeneralKnowledge.WORD_OPERATORS) {
      expression = expression.replace(pattern, replacement);
    }
    // El jugador escribe 1,5; mathjs espera 1.5. La coma de miles no se usa en
    // español, así que no hay ambigüedad.
    expression = expression.replace(/(\d),(\d)/g, '$1.$2').trim();

    if (!/\d/.test(expression)) return null;
    if (expression.length > this.#config.MAX_EXPRESSION_LENGTH) return null;
    if (!GeneralKnowledge.EXPRESSION_PATTERN.test(expression)) return null;
    // Un número solo no es una cuenta: "tengo 20 de vida" no se contesta con "20".
    if (!/[+\-*/^%!]|sqrt|factorial|nthRoot|log|sin|cos|tan/.test(expression)) return null;

    try {
      const result = evaluateExpression(expression, {});
      if (typeof result !== 'number' || !Number.isFinite(result)) return null;
      // Se repite la cuenta COMO LA ESCRIBIÓ el jugador, no como quedó después
      // de traducir "por" a "*": es su pregunta la que tiene que reconocer.
      return ChatResponse.known(
        `${stripped} = ${this.#numbers.format(result)}`,
        ChatResponse.Topics.MATH,
        'mathjs'
      );
    } catch {
      return null;
    }
  }

  /** Conversión de unidades: "3 metros en pies", "20 celsius a fahrenheit". */
  #conversion(normalized) {
    const match = normalized.match(
      /^(?:cuanto\s+(?:es|son)\s+)?(-?\d+(?:[.,]\d+)?)\s*([a-z]+(?:\s+[a-z]+){0,2}?)\s+(?:a|en)\s+([a-z]+(?:\s+[a-z]+){0,2})\s*$/
    );
    if (!match) return null;

    const [, rawAmount, rawFrom, rawTo] = match;
    const from = GeneralKnowledge.#resolveUnit(rawFrom);
    const to = GeneralKnowledge.#resolveUnit(rawTo);
    if (!from || !to) return null;

    const amount = Number(rawAmount.replace(',', '.'));
    try {
      const converted = evaluateExpression(`${amount} ${from.unit} to ${to.unit}`, {});
      const value = typeof converted?.toNumber === 'function' ? converted.toNumber(to.unit) : Number(converted);
      if (!Number.isFinite(value)) return null;

      return ChatResponse.known(
        `${this.#numbers.format(amount)} ${from.label} son ${this.#numbers.format(value)} ${to.label}.`,
        ChatResponse.Topics.UNITS,
        'mathjs (conversión de unidades)'
      );
    } catch {
      // Unidades incompatibles ("3 metros en kilos") caen acá: no es un error
      // del jugador que valga un mensaje técnico, se deriva como no sabido.
      return ChatResponse.unknown(
        `No puedo convertir ${from.label} a ${to.label}: no miden lo mismo.`,
        ChatResponse.Topics.UNITS,
        'mathjs (conversión de unidades)'
      );
    }
  }

  static #resolveUnit(raw) {
    const key = TextNormalizer.normalize(raw);
    const unit = GeneralKnowledge.UNIT_ALIASES[key];
    return unit ? { unit, label: key } : null;
  }

  // -------------------------------------------------------------------- fechas

  #today() {
    const now = dayjs(this.#clock());
    return ChatResponse.known(
      `Hoy es ${now.format('dddd D [de] MMMM [de] YYYY')} y son las ${now.format('HH:mm')}. ` +
        'Es la hora de tu máquina: el juego no consulta ningún servidor.',
      ChatResponse.Topics.TIME,
      'dayjs + reloj del navegador'
    );
  }

  /** "cuantos dias faltan para el 25/12/2026", "que dia fue el 1/1/2020". */
  #dateMath(normalized) {
    const match = normalized.match(/(\d{1,2})[/\-](\d{1,2})(?:[/\-](\d{2,4}))?/);
    if (!match) return null;
    if (!/\bdia|fecha|falta|faltan|paso|pasaron|cuando\b/.test(normalized)) return null;

    const [, day, month, year] = match;
    const now = dayjs(this.#clock());
    const target = dayjs(
      new Date(
        year ? Number(year.length === 2 ? `20${year}` : year) : now.year(),
        Number(month) - 1,
        Number(day)
      )
    );
    if (!target.isValid()) return null;

    const days = target.startOf('day').diff(now.startOf('day'), 'day');
    const formatted = target.format('dddd D [de] MMMM [de] YYYY');

    if (days === 0) {
      return ChatResponse.known(`${formatted} es hoy.`, ChatResponse.Topics.TIME, 'dayjs');
    }
    if (days > 0) {
      return ChatResponse.known(
        `Faltan ${this.#numbers.format(days)} días para el ${formatted}.`,
        ChatResponse.Topics.TIME,
        'dayjs'
      );
    }
    return ChatResponse.known(
      `Pasaron ${this.#numbers.format(Math.abs(days))} días desde el ${formatted}.`,
      ChatResponse.Topics.TIME,
      'dayjs'
    );
  }

  // ------------------------------------------------------------ charla y ayuda

  #help() {
    return ChatResponse.known(
      'Te puedo contestar sobre el juego: controles, bloques y su dureza, minerales y a qué ' +
        'profundidad están, vida y daño por caída, el mundo, los biomas y cómo se guarda la ' +
        'partida. Con una partida abierta también sé dónde estás, cuánta vida te queda y qué ' +
        'tenés en la mano. Fuera del juego hago cuentas, convierto unidades y digo la fecha. ' +
        'De lo que no sé, te lo digo en vez de inventarlo.',
      ChatResponse.Topics.HELP,
      'catálogo de intenciones'
    );
  }

  #greeting() {
    return ChatResponse.known(
      `¡Hola! Soy ${this.#config.BOT_NAME}, el asistente de Nexo World. Preguntame lo que ` +
        'quieras del juego, o escribí "ayuda" para ver de qué sé.',
      ChatResponse.Topics.SMALL_TALK
    );
  }

  #name() {
    return ChatResponse.known(
      `Me llamo ${this.#config.BOT_NAME} y me hizo el equipo de Nexo World. Soy un asistente de ` +
        'reglas, no un modelo de lenguaje: leo la configuración del juego y contesto con lo que ' +
        'dice. Por eso no invento datos, funciono sin internet y no sé nada que no esté en el juego.',
      ChatResponse.Topics.SMALL_TALK
    );
  }

  #mood() {
    return ChatResponse.known(
      'Bien, corriendo en tu navegador sin gastarte un peso. ¿Qué querés saber del juego?',
      ChatResponse.Topics.SMALL_TALK
    );
  }

  #thanks() {
    return ChatResponse.known('De nada. Cualquier otra cosa, preguntá.', ChatResponse.Topics.SMALL_TALK);
  }

  #bye() {
    return ChatResponse.known('¡Chau! Buena construcción.', ChatResponse.Topics.SMALL_TALK);
  }

  #joke() {
    const jokes = [
      '¿Por qué el bloque de roca madre no tiene amigos? Porque es irrompible.',
      'Cavé hasta Y=1 buscando diamantes y encontré una cueva. La cueva me encontró a mí.',
      'Un jugador le pregunta a otro: "¿cuántos bloques caben en el mundo?". "32 por 24 por 32", ' +
        'contesta. "¿Y en el inventario?". "Ahí no entra ni la paciencia".'
    ];
    // Elegir por el minuto del reloj inyectado, en vez de Math.random, para que
    // la respuesta sea reproducible en las pruebas.
    const index = dayjs(this.#clock()).minute() % jokes.length;
    return ChatResponse.known(jokes[index], ChatResponse.Topics.SMALL_TALK);
  }
}
