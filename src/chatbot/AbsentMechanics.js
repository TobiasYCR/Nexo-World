import { TextNormalizer } from './TextNormalizer.js';

/**
 * Las mecánicas que Nexo World NO tiene, con el término que las delata.
 *
 * Esta lista es la mitigación más barata y más efectiva del riesgo principal
 * del chat bot (docs/CHATBOT.md §4.1). Sin ella, "¿qué encantamientos puedo
 * poner en la pica de diamante?" matchea la palabra "diamante" y contesta la
 * profundidad del mineral: una respuesta correcta sobre OTRA pregunta, dicha
 * con total seguridad.
 *
 * Se consulta antes que cualquier tema, por eso mismo: si se consultara
 * después, el tema ya habría contestado sobre lo que reconoció.
 *
 * Nexo World se parece a Minecraft, así que la mayoría de las preguntas que un
 * jugador trae de ahí son sobre cosas que acá no existen. Agregar un término
 * a esta lista es la forma de corregir una respuesta inventada.
 */
export class AbsentMechanics {
  static DEFAULT_TERMS = Object.freeze([
    'encantamiento', 'encantar', 'encantada', 'nether', 'ender dragon',
    'enderman', 'aldeano', 'aldea', 'multijugador', 'multiplayer',
    'servidor del juego', 'lobo', 'gato', 'mascota', 'domesticar', 'montar',
    'caballo', 'barco', 'bote', 'carro', 'vagoneta', 'pocion', 'pociones',
    'crafteo', 'craftear', 'craftea', 'receta', 'mesa de trabajo', 'horno',
    'fundir', 'yunque', 'cofre', 'barril', 'redstone', 'piston', 'palanca',
    'antorcha', 'portal', 'experiencia', 'nivel de xp', 'hambre',
    'comida', 'comer', 'granja', 'cultivo', 'semillas de trigo', 'zombi',
    'creeper', 'esqueleto', 'araña', 'mob', 'mobs', 'enemigo', 'enemigos',
    'jefe', 'clima', 'lluvia', 'nieve', 'tormenta', 'noche', 'dia y noche',
    'ciclo de dia', 'logro', 'logros', 'tienda', 'comprar', 'skin', 'skins',
    'mod', 'mods', 'chat de voz', 'herramienta', 'pico', 'pica', 'hacha',
    'espada', 'armadura', 'escudo', 'arco', 'flecha'
  ]);

  #terms;

  /**
   * @param {string[]} [terms] términos que delatan una mecánica ausente
   */
  constructor(terms = AbsentMechanics.DEFAULT_TERMS) {
    // Se compilan una sola vez, en el constructor, porque se comparan en cada
    // pregunta y la lista tiene casi cien entradas.
    //
    // El patrón exige palabra completa (ver TextNormalizer.wordPattern): con
    // subcadenas, "mod" aparecía dentro de "modo" y el bot contestaba "Nexo
    // World no tiene mods" a quien preguntaba por el modo de juego.
    this.#terms = terms
      .map((term) => ({ term, needle: TextNormalizer.normalize(term) }))
      .filter(({ needle }) => needle !== '')
      .map(({ term, needle }) => ({ term, needle, pattern: TextNormalizer.wordPattern(needle) }));
  }

  get terms() {
    return this.#terms.map(({ term }) => term);
  }

  /**
   * @param {string} normalizedQuestion pregunta ya pasada por TextNormalizer
   * @returns {string|null} el término encontrado, o null si no hay ninguno
   */
  find(normalizedQuestion) {
    const question = String(normalizedQuestion ?? '');
    // El término más largo gana: "mesa de trabajo" es más informativo que
    // "mesa" si la pregunta contiene los dos.
    let longest = null;
    for (const { term, needle, pattern } of this.#terms) {
      if (!pattern.test(question)) continue;
      if (longest === null || needle.length > longest.needle.length) {
        longest = { term, needle };
      }
    }
    return longest?.term ?? null;
  }
}
