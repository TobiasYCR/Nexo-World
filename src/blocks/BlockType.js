/**
 * Diccionario de respaldo de separación en sílabas para bloques conocidos
 * (por nombre técnico o etiqueta en español).
 */
export const FALLBACK_SYLLABLES_DICTIONARY = Object.freeze({
  air: Object.freeze(['AI', 'RE']),
  aire: Object.freeze(['AI', 'RE']),
  grass: Object.freeze(['CES', 'PED']),
  cesped: Object.freeze(['CES', 'PED']),
  pasto: Object.freeze(['PAS', 'TO']),
  dirt: Object.freeze(['TIE', 'RRA']),
  tierra: Object.freeze(['TIE', 'RRA']),
  stone: Object.freeze(['PIE', 'DRA']),
  piedra: Object.freeze(['PIE', 'DRA']),
  log: Object.freeze(['TRON', 'CO']),
  tronco: Object.freeze(['TRON', 'CO']),
  wood: Object.freeze(['MA', 'DE', 'RA']),
  madera: Object.freeze(['MA', 'DE', 'RA']),
  leaves: Object.freeze(['HO', 'JAS']),
  hojas: Object.freeze(['HO', 'JAS']),
  planks: Object.freeze(['TA', 'BLO', 'NES']),
  tablones: Object.freeze(['TA', 'BLO', 'NES']),
  sand: Object.freeze(['A', 'RE', 'NA']),
  arena: Object.freeze(['A', 'RE', 'NA']),
  cobblestone: Object.freeze(['PIE', 'DRA', 'PAR', 'TI', 'DA']),
  'piedra partida': Object.freeze(['PIE', 'DRA', 'PAR', 'TI', 'DA']),
  glass: Object.freeze(['VI', 'DRIO']),
  vidrio: Object.freeze(['VI', 'DRIO']),
  cristal: Object.freeze(['CRIS', 'TAL']),
  sandstone: Object.freeze(['A', 'RE', 'NIS', 'CA']),
  arenisca: Object.freeze(['A', 'RE', 'NIS', 'CA']),
  bedrock: Object.freeze(['RO', 'CA', 'MA', 'DRE']),
  'roca madre': Object.freeze(['RO', 'CA', 'MA', 'DRE']),
  coalore: Object.freeze(['MI', 'NE', 'RAL', 'DE', 'CAR', 'BON']),
  'mineral de carbon': Object.freeze(['MI', 'NE', 'RAL', 'DE', 'CAR', 'BON']),
  ironore: Object.freeze(['MI', 'NE', 'RAL', 'DE', 'HIE', 'RRO']),
  'mineral de hierro': Object.freeze(['MI', 'NE', 'RAL', 'DE', 'HIE', 'RRO']),
  goldore: Object.freeze(['MI', 'NE', 'RAL', 'DE', 'O', 'RO']),
  'mineral de oro': Object.freeze(['MI', 'NE', 'RAL', 'DE', 'O', 'RO']),
  diamondore: Object.freeze(['MI', 'NE', 'RAL', 'DE', 'DIA', 'MAN', 'TE']),
  'mineral de diamante': Object.freeze(['MI', 'NE', 'RAL', 'DE', 'DIA', 'MAN', 'TE']),
  brick: Object.freeze(['LA', 'DRI', 'LLO']),
  ladrillo: Object.freeze(['LA', 'DRI', 'LLO']),
  pane: Object.freeze(['PA', 'NEL']),
  panel: Object.freeze(['PA', 'NEL']),
  water: Object.freeze(['A', 'GUA']),
  agua: Object.freeze(['A', 'GUA'])
});

/**
 * Normaliza una clave quitando tildes y pasando a minúsculas.
 * @param {string} text
 * @returns {string}
 */
function normalizeKey(text) {
  return String(text ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/**
 * Separador silábico algorítmico de respaldo para palabras en español
 * que no estén en el diccionario predefinido.
 * @param {string} word
 * @returns {string[]}
 */
export function splitSpanishWordIntoSyllables(word) {
  const clean = String(word ?? '')
    .trim()
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-ZÑ]/g, '');

  if (!clean) return [];
  if (clean.length <= 3) return [clean];

  const isVowel = (ch) => 'AEIOU'.includes(ch);
  const isWeakVowel = (ch) => 'IU'.includes(ch);
  const inseparablePairs = new Set([
    'BL', 'BR', 'CL', 'CR', 'DR', 'FL', 'FR', 'GL', 'GR', 'PL', 'PR', 'TR', 'CH', 'LL', 'RR'
  ]);

  // Agrupar núcleos vocálicos (diptongos) y consonantes
  const syllables = [];
  let i = 0;
  const n = clean.length;

  while (i < n) {
    let syl = '';

    // 1. Ataque consonántico
    while (i < n && !isVowel(clean[i])) {
      syl += clean[i];
      i++;
    }

    // 2. Núcleo vocálico (incluyendo diptongos)
    if (i < n && isVowel(clean[i])) {
      syl += clean[i];
      i++;
      while (i < n && isVowel(clean[i])) {
        const prev = clean[i - 1];
        const curr = clean[i];
        // Diptongo si al menos una es cerrada (I, U)
        if (isWeakVowel(prev) || isWeakVowel(curr)) {
          syl += curr;
          i++;
        } else {
          break;
        }
      }
    }

    // 3. Coda consonántica: mirar cuántas consonantes siguen antes de la próxima vocal
    let consStart = i;
    while (i < n && !isVowel(clean[i])) {
      i++;
    }
    const consCount = i - consStart;

    if (i === n) {
      // No hay más vocales: todas las consonantes restantes cierran esta sílaba
      syl += clean.slice(consStart, n);
    } else if (consCount === 1) {
      // 1 consonante entre vocales va con la sílaba siguiente
      i = consStart;
    } else if (consCount === 2) {
      const pair = clean.slice(consStart, consStart + 2);
      if (inseparablePairs.has(pair)) {
        // Grupo inseparable va completo a la siguiente sílaba
        i = consStart;
      } else {
        syl += clean[consStart];
        i = consStart + 1;
      }
    } else if (consCount >= 3) {
      const lastTwo = clean.slice(i - 2, i);
      if (inseparablePairs.has(lastTwo)) {
        syl += clean.slice(consStart, i - 2);
        i = i - 2;
      } else {
        syl += clean.slice(consStart, i - 1);
        i = i - 1;
      }
    }

    if (syl) syllables.push(syl);
  }

  return syllables.length > 0 ? syllables : [clean];
}

/**
 * Resuelve la separación en sílabas y el texto formateado para un bloque.
 * @param {Object} params
 * @param {string} [params.label]
 * @param {string} [params.name]
 * @param {string[]} [params.syllables]
 * @param {string} [params.syllableText]
 * @returns {{ syllables: ReadonlyArray<string>, syllableText: string }}
 */
export function resolveBlockSyllables({ label, name, syllables, syllableText } = {}) {
  let resolvedList = null;

  if (Array.isArray(syllables) && syllables.length > 0) {
    resolvedList = syllables
      .map((s) => String(s ?? '').trim().toUpperCase())
      .filter(Boolean);
  }

  if (!resolvedList || resolvedList.length === 0) {
    const labelKey = normalizeKey(label);
    const nameKey = normalizeKey(name);
    if (labelKey && FALLBACK_SYLLABLES_DICTIONARY[labelKey]) {
      resolvedList = [...FALLBACK_SYLLABLES_DICTIONARY[labelKey]];
    } else if (nameKey && FALLBACK_SYLLABLES_DICTIONARY[nameKey]) {
      resolvedList = [...FALLBACK_SYLLABLES_DICTIONARY[nameKey]];
    } else {
      const rawText = String(label || name || 'BLOQUE').trim();
      const words = rawText.split(/\s+/).filter(Boolean);
      resolvedList = [];
      for (const w of words) {
        const wKey = normalizeKey(w);
        if (FALLBACK_SYLLABLES_DICTIONARY[wKey]) {
          resolvedList.push(...FALLBACK_SYLLABLES_DICTIONARY[wKey]);
        } else {
          resolvedList.push(...splitSpanishWordIntoSyllables(w));
        }
      }
    }
  }

  if (!resolvedList || resolvedList.length === 0) {
    resolvedList = ['BLO', 'QUE'];
  }

  const frozenSyllables = Object.freeze(resolvedList);
  const formattedText = typeof syllableText === 'string' && syllableText.trim().length > 0
    ? syllableText.trim().toUpperCase()
    : frozenSyllables.join(' - ');

  return {
    syllables: frozenSyllables,
    syllableText: formattedText
  };
}

/**
 * Agrupa las sílabas de un bloque en líneas (1 palabra arriba y otra abajo cuando
 * el nombre tiene varias palabras) para evitar cortes de sílabas a mitad de palabra en la UI.
 * @param {Object} block
 * @returns {ReadonlyArray<ReadonlyArray<string>>}
 */
export function resolveBlockSyllableLines(block = {}) {
  const { syllables } = resolveBlockSyllables(block);
  const rawLabel = String(block.label || block.name || '').trim();
  const words = rawLabel.split(/\s+/).filter(Boolean);

  if (words.length <= 1) {
    return Object.freeze([Object.freeze([...syllables])]);
  }

  // Obtener las sílabas de cada palabra individual
  const wordSyllables = words.map((w) => {
    const wKey = normalizeKey(w);
    if (FALLBACK_SYLLABLES_DICTIONARY[wKey]) {
      return [...FALLBACK_SYLLABLES_DICTIONARY[wKey]];
    }
    return splitSpanishWordIntoSyllables(w);
  }).filter((arr) => arr.length > 0);

  if (wordSyllables.length <= 1) {
    return Object.freeze([Object.freeze([...syllables])]);
  }

  // Si son 2 palabras (ej. "Piedra partida", "Roca madre"): palabra 1 arriba, palabra 2 abajo
  if (wordSyllables.length === 2) {
    return Object.freeze([
      Object.freeze(wordSyllables[0]),
      Object.freeze(wordSyllables[1])
    ]);
  }

  // Si son 3 o más palabras (ej. "Mineral de carbon", "Mineral de diamante"):
  // agrupar "MI - NE - RAL" arriba y el resto abajo, o si la última palabra es larga,
  // unir la preposición corta ("DE") a la línea más corta para que ambas queden equilibradas.
  const firstWord = wordSyllables[0];
  const lastWord = wordSyllables[wordSyllables.length - 1];
  const middleSyllables = wordSyllables.slice(1, -1).flat();

  if (firstWord.length <= lastWord.length) {
    return Object.freeze([
      Object.freeze([...firstWord, ...middleSyllables]),
      Object.freeze(lastWord)
    ]);
  }
  return Object.freeze([
    Object.freeze(firstWord),
    Object.freeze([...middleSyllables, ...lastWord])
  ]);
}

/**
 * Definición inmutable de una clase de bloque. Describe QUÉ es un bloque
 * (propiedades y apariencia), nunca dónde está ni cómo se dibuja.
 *
 * Todo comportamiento particular (dureza, drops, opacidad, si se puede romper,
 * cómo lo trata la generación del mundo) se declara acá como propiedad: ningún
 * sistema compara ids para decidirlo.
 */
export class BlockType {
  constructor({
    id,
    name,
    label = name,
    syllables = undefined,
    syllableText = undefined,
    solid = true,
    texture = null,
    textures = null,
    /** Color de respaldo usado mientras la textura no está disponible. */
    color = [255, 255, 255],
    transparent = false,
    /** Alternativa declarativa a transparent: isOpaque: false equivale a transparent: true. */
    isOpaque = undefined,
    breakable = true,
    /** Alias de breakable con el nombre del contrato de minería. */
    isBreakable = undefined,
    hardness = 1,
    drops = undefined,
    /** Terreno natural que las cuevas pueden excavar. Lo colocado después (árboles, construcciones) no lo es. */
    carvable = false,
    /** Roca que los minerales pueden reemplazar al generar vetas. */
    oreHost = false,
    /** Superficie sobre la que la generación puede plantar árboles. */
    sustainsTrees = false,
    /** Se entrega en la hotbar inicial de la partida. */
    starter = false
  }) {
    if (!Number.isInteger(id) || id < 0) {
      throw new TypeError(`BlockType "${name}": id debe ser un entero >= 0.`);
    }
    if (!name) {
      throw new TypeError(`BlockType con id ${id}: name es obligatorio.`);
    }

    this.id = id;
    this.name = name;
    this.label = label;

    const resolvedSyllables = resolveBlockSyllables({ label, name, syllables, syllableText });
    this.syllables = resolvedSyllables.syllables;
    this.syllableText = resolvedSyllables.syllableText;

    this.solid = solid;
    this.texture = texture;
    this.textures = Object.freeze({
      top: textures?.top ?? texture,
      side: textures?.side ?? texture,
      bottom: textures?.bottom ?? texture
    });
    this.color = Object.freeze([...color]);
    this.transparent = isOpaque === undefined ? transparent : !isOpaque;
    this.breakable = isBreakable === undefined ? breakable : isBreakable;
    this.hardness = hardness;
    this.drops = Object.freeze(drops === undefined ? [id] : [...drops]);
    this.carvable = carvable;
    this.oreHost = oreHost;
    this.sustainsTrees = sustainsTrees;
    this.starter = starter;

    Object.freeze(this);
  }

  /** Un bloque opaco tapa las caras vecinas y permite descartarlas al dibujar. */
  get isOpaque() {
    return this.solid && !this.transparent;
  }

  get isBreakable() {
    return this.breakable;
  }
}
