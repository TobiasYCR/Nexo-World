import { ChatResponse } from './ChatResponse.js';
import { AbsentMechanics } from './AbsentMechanics.js';
import { GameKnowledge } from './GameKnowledge.js';
import { GeneralKnowledge } from './GeneralKnowledge.js';
import { IntentMatcher } from './IntentMatcher.js';
import { TextNormalizer } from './TextNormalizer.js';
import { GameConfig } from '../game/GameConfig.js';

/**
 * El chat bot de consultas de Nexo World.
 *
 * Es la etapa 1 de docs/CHATBOT.md: reglas sobre los datos del juego. Sin
 * servidor, sin claves de API, sin costo por pregunta y sin que nada salga del
 * navegador. Lo que no sabe, lo dice.
 *
 * El orden en el que pregunta a sus colaboradores NO es intercambiable, y es la
 * parte que más fácil se rompe al tocarla:
 *
 * 1. Seguridad: pedidos de credenciales o de saltarse las reglas se rechazan
 *    antes de que cualquier tema los interprete.
 * 2. Mecánicas ausentes: si la pregunta habla de algo que el juego no tiene, se
 *    deriva. Si esto fuera después, "¿qué encantamientos pongo en la pica de
 *    diamante?" matchearía "diamante" y contestaría la profundidad del mineral:
 *    un dato correcto sobre otra pregunta (docs/CHATBOT.md §4.1).
 * 3. Forma de la pregunta: una cuenta, una conversión o una fecha se reconocen
 *    por cómo están escritas, no por parecerse a una frase de ejemplo.
 * 4. Intención: el matcher difuso contra el catálogo.
 * 5. Entidad nombrada: un bloque o mineral mencionado, aunque la intención no
 *    haya alcanzado la confianza mínima.
 * 6. Tema general.
 * 7. No sé, y lo digo.
 */
export class ChatBot {
  /** Pedidos que se rechazan sin mirar el tema. */
  static CREDENTIAL_TERMS = Object.freeze([
    'contrasena', 'password', 'clave', 'api key', 'apikey', 'token',
    'credencial', 'credenciales', 'hash de mi cuenta'
  ]);

  static CHEAT_TERMS = Object.freeze([
    'hacer trampa', 'trampa', 'truco para', 'hackear', 'hackeo', 'exploit',
    'ignora tus instrucciones', 'ignora las reglas', 'sin reglas',
    'olvida tus instrucciones', 'actua como'
  ]);

  #config;
  #absentMechanics;
  #gameKnowledge;
  #generalKnowledge;
  #matcher;

  /**
   * @param {Object} [options]
   * @param {Object} [options.config] sección chatbot de GameConfig
   * @param {AbsentMechanics} [options.absentMechanics]
   * @param {GameKnowledge} [options.gameKnowledge]
   * @param {GeneralKnowledge} [options.generalKnowledge]
   * @param {IntentMatcher} [options.matcher]
   */
  constructor({
    config = GameConfig.chatbot,
    absentMechanics = new AbsentMechanics(),
    gameKnowledge = new GameKnowledge(),
    generalKnowledge = new GeneralKnowledge({ config }),
    matcher = new IntentMatcher(undefined, config)
  } = {}) {
    this.#config = config;
    this.#absentMechanics = absentMechanics;
    this.#gameKnowledge = gameKnowledge;
    this.#generalKnowledge = generalKnowledge;
    this.#matcher = matcher;
  }

  get name() {
    return this.#config.BOT_NAME;
  }

  get gameKnowledge() {
    return this.#gameKnowledge;
  }

  /** Lo primero que ve el jugador al abrir el chat. */
  greeting() {
    return this.#generalKnowledge.answer('general.smallTalk.greeting');
  }

  /**
   * @param {string} question lo que escribió el jugador
   * @returns {{isKnown: boolean, text: string, topic: string, source: string|null}}
   */
  ask(question) {
    const raw = String(question ?? '').slice(0, this.#config.MAX_QUESTION_LENGTH);
    const normalized = TextNormalizer.normalize(raw);
    if (normalized === '') return this.#empty();

    const safety = this.#safety(normalized);
    if (safety) return safety;

    const absent = this.#absentMechanics.find(normalized);
    if (absent) return this.#absent(absent);

    const direct = this.#generalKnowledge.answerDirect(raw);
    if (direct) return direct;

    const intent = this.#matcher.match(raw);
    if (intent) {
      const answer = intent.id.startsWith('game.')
        ? this.#gameKnowledge.answer(intent.id, normalized)
        : this.#generalKnowledge.answer(intent.id);
      if (answer) return answer;
    }

    const entity = this.#gameKnowledge.answerAboutEntity(normalized);
    if (entity) return entity;

    const topic = this.#generalKnowledge.answerTopic(raw);
    if (topic) return topic;

    return this.#unknown();
  }

  #empty() {
    return ChatResponse.unknown(
      'Escribime una pregunta. Si no sabés por dónde empezar, probá con "ayuda".',
      ChatResponse.Topics.HELP
    );
  }

  #safety(normalized) {
    const asksCredentials = TextNormalizer.mentions(normalized, ...ChatBot.CREDENTIAL_TERMS);
    const asksCheat = TextNormalizer.mentions(normalized, ...ChatBot.CHEAT_TERMS);
    if (!asksCredentials && !asksCheat) return null;

    // Se contesta con un "no" explícito y no con un "no sé": el bot sabe la
    // respuesta, decide no darla, y conviene que el jugador vea la diferencia.
    return ChatResponse.known(
      'Con eso no te puedo ayudar. No tengo acceso a contraseñas ni claves de nadie, y no voy a ' +
        'explicar cómo saltearse las reglas del juego. Lo que sí puedo: contarte cómo se guardan ' +
        'las contraseñas, si te interesa.',
      ChatResponse.Topics.SAFETY,
      'regla de seguridad del bot'
    );
  }

  #absent(term) {
    return ChatResponse.unknown(
      `Nexo World no tiene eso (${term}). Es un prototipo: hay bloques, biomas, cuevas, ` +
        'minerales y supervivencia básica. No te puedo contestar sobre mecánicas de otros juegos, ' +
        'y preferí decírtelo antes que inventar una respuesta que suene bien.',
      ChatResponse.Topics.ABSENT,
      'lista de mecánicas ausentes'
    );
  }

  #unknown() {
    return ChatResponse.unknown(
      'Eso no lo sé. Contesto sobre el juego (controles, bloques, minerales, supervivencia, el ' +
        'mundo y tu partida), hago cuentas y convierto unidades. Si es un dato del juego que me ' +
        'falta, avisale al equipo así lo agregamos.',
      ChatResponse.Topics.UNKNOWN
    );
  }
}
