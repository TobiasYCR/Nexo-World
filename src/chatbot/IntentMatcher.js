import Fuse from 'fuse.js';
import { IntentCatalog } from './IntentCatalog.js';
import { TextNormalizer } from './TextNormalizer.js';
import { GameConfig } from '../game/GameConfig.js';

/**
 * Mapea la pregunta del jugador a una intención del catálogo.
 *
 * La búsqueda difusa la hace Fuse.js: tolera errores de tipeo y palabras
 * faltantes sin que haya que escribir una métrica de distancia a mano.
 *
 * Pero Fuse sola no alcanza, y conviene saber por qué: su puntaje premia que la
 * consulta aparezca dentro del texto indexado, así que una frase corta como
 * "ayuda" matchea casi cualquier pregunta larga que contenga esas letras. Acá
 * Fuse se usa solo para PROPONER candidatos, con un umbral permisivo, y la
 * decisión la toma una segunda vuelta con dos correcciones:
 *
 * - **Cobertura en los dos sentidos (F1).** Cuántas palabras de la pregunta
 *   están en la frase candidata y cuántas de la frase están en la pregunta. Así
 *   una frase de una palabra no le gana a una pregunta de diez por compartir
 *   una sola.
 * - **Peso por rareza (IDF).** Una palabra que aparece en muchas frases del
 *   catálogo pesa menos que una que aparece en una sola. Sin esto, "¿de cuántos
 *   bloques es un chunk?" se contestaba con la lista de bloques colocables:
 *   "bloque" está en media docena de frases y "chunk" en una, pero las dos
 *   contaban igual.
 */
export class IntentMatcher {
  #fuse;
  #rows;
  #weights;
  #config;

  /**
   * @param {Array<{id: string, phrases: string[]}>} [catalog]
   * @param {Object} [config] sección chatbot de GameConfig
   */
  constructor(catalog = IntentCatalog, config = GameConfig.chatbot) {
    this.#config = config;
    this.#rows = catalog.flatMap(({ id, phrases }) =>
      phrases.map((phrase) => ({
        id,
        phrase,
        stemmed: TextNormalizer.stemmed(phrase),
        tokens: new Set(TextNormalizer.stemmed(phrase).split(' ').filter(Boolean))
      }))
    );

    this.#weights = IntentMatcher.#inverseDocumentFrequency(this.#rows);

    this.#fuse = new Fuse(this.#rows, {
      keys: ['stemmed'],
      includeScore: true,
      ignoreLocation: true,
      threshold: config.MATCH_THRESHOLD,
      minMatchCharLength: 2
    });
  }

  get intentCount() {
    return new Set(this.#rows.map(({ id }) => id)).size;
  }

  /**
   * @param {string} question pregunta cruda del jugador
   * @returns {{id: string, confidence: number, phrase: string}|null}
   */
  match(question) {
    const stemmed = TextNormalizer.stemmed(question);
    if (stemmed === '') return null;

    const askedTokens = new Set(stemmed.split(' ').filter(Boolean));
    const candidates = this.#fuse.search(stemmed, { limit: this.#config.MATCH_CANDIDATES });

    let best = null;
    for (const { item, score } of candidates) {
      // Fuse devuelve 0 para el match perfecto: se invierte para que todo lo
      // que se compara acá sea "más alto es mejor".
      const fuzzy = 1 - (score ?? 1);
      const overlap = this.#f1(askedTokens, item.tokens);
      const weight = this.#config.OVERLAP_WEIGHT;
      const confidence = (overlap * weight) + (fuzzy * (1 - weight));
      if (best === null || confidence > best.confidence) {
        best = { id: item.id, confidence, phrase: item.phrase };
      }
    }

    if (best === null || best.confidence < this.#config.MIN_CONFIDENCE) return null;
    return best;
  }

  /**
   * Cobertura en los dos sentidos, con cada palabra pesada por su rareza:
   * media armónica de precisión y exhaustividad.
   */
  #f1(askedTokens, phraseTokens) {
    if (askedTokens.size === 0 || phraseTokens.size === 0) return 0;

    let shared = 0;
    for (const token of askedTokens) {
      if (phraseTokens.has(token)) shared += this.#weightOf(token);
    }
    if (shared === 0) return 0;

    const askedWeight = this.#totalWeight(askedTokens);
    const phraseWeight = this.#totalWeight(phraseTokens);
    const precision = shared / askedWeight;
    const recall = shared / phraseWeight;
    return (2 * precision * recall) / (precision + recall);
  }

  #weightOf(token) {
    // Una palabra que no está en el catálogo es, por definición, la más rara.
    return this.#weights.get(token) ?? this.#weights.get('') ?? 1;
  }

  #totalWeight(tokens) {
    let total = 0;
    for (const token of tokens) total += this.#weightOf(token);
    return total;
  }

  /**
   * Peso de cada palabra: log(1 + total de frases / frases que la contienen).
   * Una palabra en una sola frase pesa varias veces más que una en la mitad del
   * catálogo.
   */
  static #inverseDocumentFrequency(rows) {
    const documentCount = new Map();
    for (const { tokens } of rows) {
      for (const token of tokens) {
        documentCount.set(token, (documentCount.get(token) ?? 0) + 1);
      }
    }

    const weights = new Map();
    for (const [token, count] of documentCount) {
      weights.set(token, Math.log(1 + rows.length / count));
    }
    // Clave vacía: el peso de una palabra desconocida, que no aparece en ninguna
    // frase y por lo tanto es máximamente informativa.
    weights.set('', Math.log(1 + rows.length));
    return weights;
  }
}
