/**
 * Normalización de texto en español para comparar preguntas.
 *
 * Fuse.js hace la búsqueda difusa, pero compara los caracteres que se le dan:
 * "¿CÓMO SALTO?" y "como salto" son cadenas distintas para cualquier métrica.
 * Esta clase las vuelve comparables antes de que Fuse las vea.
 */
export class TextNormalizer {
  /**
   * Palabras que no aportan al tema de la pregunta. Incluye los pronombres
   * interrogativos a propósito: sin ellos fuera, "quién inventó el avión"
   * matcheaba con "quién sos" por compartir "quien".
   */
  static STOPWORDS = Object.freeze(new Set([
    'el', 'la', 'los', 'las', 'un', 'una', 'unos', 'unas', 'de', 'del', 'al',
    'a', 'en', 'y', 'o', 'u', 'que', 'se', 'por', 'para', 'con', 'sin', 'su',
    'sus', 'mi', 'mis', 'me', 'te', 'lo', 'le', 'es', 'son', 'hay', 'tiene',
    'tienen', 'puedo', 'puede', 'pueden', 'quiero', 'hace', 'hacen', 'esta',
    'este', 'esto', 'estos', 'estas', 'ese', 'eso', 'yo', 'vos', 'tu', 'si',
    'no', 'mas', 'muy', 'ya', 'ser', 'estar', 'como', 'cual', 'cuales', 'que',
    'quien', 'quienes', 'donde', 'cuando', 'cuanto', 'cuanta', 'cuantos',
    'cuantas', 'porque', 'por', 'decime', 'deci', 'dime', 'sabes', 'sabe'
  ]));

  /**
   * Sufijos verbales y de número que se recortan para que "saltar", "salto" y
   * "saltando" caigan en la misma raíz.
   *
   * La familia -cion/-ciones quedó deliberadamente afuera: recortarla convierte
   * "estaciones" en "esta", que choca con el stopword "estas". Un sufijo que
   * genera colisiones hace más daño que el que evita.
   */
  static SUFFIXES = Object.freeze([
    'andome', 'iendome', 'arselo', 'andolo', 'iendolo',
    'ando', 'iendo', 'arse', 'erse', 'irse',
    'amos', 'emos', 'imos', 'aron', 'eron', 'ieron',
    'aba', 'ia', 'ar', 'er', 'ir', 'an', 'en', 'as', 'es', 'os', 'a', 'o', 's'
  ]);

  /** Minúsculas, sin acentos, sin signos, con espacios colapsados. */
  static normalize(text) {
    return String(text ?? '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Como normalize(), pero conserva los símbolos de una cuenta, una conversión
   * o una fecha.
   *
   * normalize() los borra a propósito, porque para comparar temas estorban.
   * Pero "1234*7" sin el asterisco es "1234 7" y "25/12/2026" sin las barras es
   * una lista de números: las preguntas que se reconocen por su FORMA necesitan
   * los símbolos intactos.
   */
  static normalizeSymbols(text) {
    return String(text ?? '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9+\-*/^%().,!:\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Colapsa letras repetidas: "holaaaa" -> "hola".
   *
   * Los dígitos quedan fuera a propósito. Colapsarlos convertía "5000" en
   * "500", así que una pregunta por un número salía con otro número.
   */
  static collapseRepeats(text) {
    return String(text ?? '').replace(/([a-z])\1{1,}/gi, '$1');
  }

  /** Palabras normalizadas, sin stopwords ni palabras de una letra. */
  static words(text) {
    return TextNormalizer.normalize(text)
      .split(' ')
      .filter((word) => word.length > 1 && !TextNormalizer.STOPWORDS.has(word));
  }

  /** Raíz aproximada de una palabra ya normalizada. */
  static stem(word) {
    const clean = String(word ?? '');
    if (clean.length <= 4) return clean;

    for (const suffix of TextNormalizer.SUFFIXES) {
      if (clean.endsWith(suffix) && clean.length - suffix.length >= 4) {
        return clean.slice(0, clean.length - suffix.length);
      }
    }
    return clean;
  }

  /** Texto reducido a raíces, que es la forma con la que compara el matcher. */
  static stemmed(text) {
    return TextNormalizer.words(text)
      .map((word) => TextNormalizer.stem(TextNormalizer.collapseRepeats(word)))
      .join(' ');
  }

  /**
   * ¿La pregunta menciona alguno de estos términos como PALABRA, con plural
   * opcional?
   *
   * La versión por subcadena daba falsos positivos silenciosos: "oro" aparece
   * dentro de "corro", así que "¿cómo corro más rápido?" se contestaba con la
   * profundidad del mineral de oro. Para términos de varias palabras el borde
   * se aplica en los extremos de la frase.
   */
  static mentionsWord(normalizedText, ...terms) {
    const text = String(normalizedText ?? '');
    return terms.some((term) => {
      const needle = TextNormalizer.normalize(term);
      if (needle === '') return false;
      return TextNormalizer.wordPattern(needle).test(text);
    });
  }

  /** Patrón de palabra completa con plural opcional, cacheado por término. */
  static wordPattern(needle) {
    let pattern = TextNormalizer.#patternCache.get(needle);
    if (!pattern) {
      const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      pattern = new RegExp(`\\b${escaped}e?s?\\b`);
      TextNormalizer.#patternCache.set(needle, pattern);
    }
    return pattern;
  }

  static #patternCache = new Map();

  /**
   * ¿La pregunta menciona alguno de estos términos? Compara sobre el texto
   * normalizado y también sobre su versión sin letras repetidas, para que
   * "diamanteee" cuente como mención de "diamante".
   */
  static mentions(normalizedText, ...terms) {
    const collapsed = TextNormalizer.collapseRepeats(normalizedText);
    return terms.some((term) => {
      const needle = TextNormalizer.normalize(term);
      if (needle === '') return false;
      return normalizedText.includes(needle) ||
        collapsed.includes(TextNormalizer.collapseRepeats(needle));
    });
  }
}
