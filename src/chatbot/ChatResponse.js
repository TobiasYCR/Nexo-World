/**
 * Respuesta del chat bot. Se devuelve en lugar de lanzar, igual que UserResult
 * y SaveResult: quien pregunta quiere un texto para mostrar, no una excepción.
 *
 * Forma: { isKnown, text, source, topic }.
 *
 * `source` dice de dónde salió el dato ("GameConfig.input.KEY_BINDINGS", por
 * ejemplo). Es lo que vuelve auditable una respuesta y lo que distingue un dato
 * del juego de una frase escrita a mano: si la fuente es nula, el jugador sabe
 * que nadie puede verificarla contra el código.
 *
 * `isKnown` en false no es un error: significa que el bot no sabía y lo dijo.
 * Derivar es el comportamiento correcto frente a inventar (ver docs/CHATBOT.md).
 */
export class ChatResponse {
  static Topics = Object.freeze({
    CONTROLS: 'controls',
    BLOCKS: 'blocks',
    ORES: 'ores',
    SURVIVAL: 'survival',
    WORLD: 'world',
    STATUS: 'status',
    MATH: 'math',
    UNITS: 'units',
    TIME: 'time',
    GENERAL: 'general',
    SMALL_TALK: 'smallTalk',
    HELP: 'help',
    ABSENT: 'absent',
    SAFETY: 'safety',
    UNKNOWN: 'unknown'
  });

  /**
   * @param {string} text texto listo para mostrar
   * @param {string} topic uno de ChatResponse.Topics
   * @param {string|null} [source] de dónde salió el dato
   */
  static known(text, topic, source = null) {
    return Object.freeze({ isKnown: true, text, topic, source });
  }

  /**
   * El bot no sabe y lo dice. Se cuenta como acierto, no como falla.
   */
  static unknown(text, topic = ChatResponse.Topics.UNKNOWN, source = null) {
    return Object.freeze({ isKnown: false, text, topic, source });
  }
}
