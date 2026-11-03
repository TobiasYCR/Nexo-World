import { ChatResponse } from './ChatResponse.js';
import { TextNormalizer } from './TextNormalizer.js';

/**
 * Modo educativo: planos de construcción y el desafío en curso.
 *
 * El contrato todavía no existe en main (lo define Andrea Cubas). Para no
 * inventar datos, esta clase consulta game.buildChallenge solo si está
 * disponible y, cuando no lo está, lo dice. Las formas que acepta son las
 * mínimas para leer los planos y el próximo bloque:
 *
 *   buildChallenge.blueprints() -> [{ name, materials: [{ label, count }] }]
 *   buildChallenge.activeChallenge() -> { name, nextBlock } | null
 *
 * Si el contrato final usa otros nombres, se adapta acá: el resto del bot no
 * cambia. Nunca se escribe a mano la lista de planos ni de materiales.
 */
export class EducationKnowledge {
  #contextProvider = null;

  /**
   * @param {Object} [options]
   * @param {(() => Object|null)|null} [options.contextProvider]
   */
  constructor({ contextProvider = null } = {}) {
    this.setContextProvider(contextProvider);
  }

  setContextProvider(provider) {
    this.#contextProvider = typeof provider === 'function' ? provider : null;
  }

  get #context() {
    if (!this.#contextProvider) return null;
    try {
      return this.#contextProvider();
    } catch {
      return null;
    }
  }

  /**
   * @param {string} intentId
   * @param {string} [normalizedQuestion]
   * @returns {Object|null}
   */
  answer(intentId, normalizedQuestion = '') {
    const handlers = {
      'game.education.blueprints': () => this.#blueprintsAnswer(),
      'game.education.materials': () => this.#materialsAnswer(normalizedQuestion),
      'game.status.challenge': () => this.#statusChallenge()
    };
    return handlers[intentId]?.() ?? null;
  }

  #blueprintsAnswer() {
    const blueprints = this.#blueprints();
    if (!blueprints) return this.#unavailable();

    const nombres = blueprints.map((blueprint) => this.#nameOf(blueprint)).filter(Boolean);
    if (nombres.length === 0) {
      return ChatResponse.unknown(
        'El modo educativo no me pasó ningún plano todavía.',
        ChatResponse.Topics.EDUCATION
      );
    }

    return ChatResponse.known(
      `Hay ${nombres.length} ${nombres.length === 1 ? 'plano' : 'planos'}: ${nombres.join(', ')}. ` +
        'Preguntame por uno y te digo qué materiales lleva.',
      ChatResponse.Topics.EDUCATION,
      'game.buildChallenge.blueprints()'
    );
  }

  #materialsAnswer(normalizedQuestion) {
    const blueprints = this.#blueprints();
    if (!blueprints) return this.#unavailable();

    const blueprint = this.#findBlueprint(blueprints, normalizedQuestion);
    if (!blueprint) {
      const nombres = blueprints.map((item) => this.#nameOf(item)).filter(Boolean);
      return ChatResponse.known(
        `Todavía no sé de qué plano me hablás. Los que hay son: ${nombres.join(', ')}. ` +
          'Decime uno y te cuento sus materiales.',
        ChatResponse.Topics.EDUCATION,
        'game.buildChallenge.blueprints()'
      );
    }

    const materiales = this.#materialsOf(blueprint);
    if (!materiales) {
      return ChatResponse.unknown(
        `El plano ${this.#nameOf(blueprint)} no me dice qué materiales lleva todavía.`,
        ChatResponse.Topics.EDUCATION
      );
    }

    return ChatResponse.known(
      `El plano ${this.#nameOf(blueprint)} lleva: ${materiales}.`,
      ChatResponse.Topics.EDUCATION,
      `game.buildChallenge.blueprints() → ${this.#nameOf(blueprint)}.materials`
    );
  }

  #statusChallenge() {
    const challenge = this.#challenge();
    if (!challenge) return this.#unavailable();

    const active = this.#activeChallenge();
    if (active === undefined) {
      return ChatResponse.unknown(
        'El modo educativo no me dice cuál es el desafío activo.',
        ChatResponse.Topics.EDUCATION
      );
    }
    if (active === null) {
      return ChatResponse.known(
        'No hay un desafío activo ahora. Elegí un plano para empezar a construir.',
        ChatResponse.Topics.STATUS,
        'game.buildChallenge.activeChallenge()'
      );
    }

    const name = this.#nameOf(active.blueprint ?? active) ?? 'el desafío';
    const next = this.#nextBlockOf(active);
    if (!next) {
      return ChatResponse.unknown(
        `El desafío ${name} está activo, pero no me dice cuál es el próximo bloque.`,
        ChatResponse.Topics.STATUS
      );
    }

    return ChatResponse.known(
      `El próximo bloque del desafío ${name} es ${next}.`,
      ChatResponse.Topics.STATUS,
      'game.buildChallenge.activeChallenge()'
    );
  }

  #challenge() {
    return this.#context?.buildChallenge ?? null;
  }

  #blueprints() {
    const challenge = this.#challenge();
    if (!challenge || typeof challenge.blueprints !== 'function') return null;
    try {
      const list = challenge.blueprints();
      return Array.isArray(list) ? list : null;
    } catch {
      return null;
    }
  }

  /** undefined = el contrato existe pero no informa el activo; null = no hay desafío. */
  #activeChallenge() {
    const challenge = this.#challenge();
    if (!challenge) return undefined;
    for (const method of ['activeChallenge', 'active', 'currentChallenge', 'current']) {
      if (typeof challenge[method] !== 'function') continue;
      try {
        return challenge[method]() ?? null;
      } catch {
        return undefined;
      }
    }
    return undefined;
  }

  #findBlueprint(blueprints, question) {
    const text = String(question ?? '');
    if (text === '') return null;

    let best = null;
    for (const blueprint of blueprints) {
      const name = this.#nameOf(blueprint);
      if (!name) continue;
      const words = TextNormalizer.words(name);
      const matches = words.filter((word) => TextNormalizer.mentions(text, word)).length;
      if (matches > 0 && (best === null || matches > best.matches)) {
        best = { blueprint, matches };
      }
    }
    return best?.blueprint ?? null;
  }

  #nameOf(item) {
    if (typeof item === 'string') return item;
    return item?.name ?? item?.label ?? item?.title ?? item?.id ?? null;
  }

  #materialsOf(blueprint) {
    const materials = blueprint?.materials ?? blueprint?.requirements ?? blueprint?.requisitos;
    const parts = [];
    if (Array.isArray(materials)) {
      for (const entry of materials) parts.push(this.#materialEntry(entry));
    } else if (materials && typeof materials === 'object') {
      for (const [label, count] of Object.entries(materials)) {
        parts.push(`${String(label).toLowerCase()} (${count})`);
      }
    }
    const clean = parts.filter(Boolean);
    return clean.length > 0 ? clean.join(', ') : null;
  }

  #materialEntry(entry) {
    if (typeof entry === 'string') return entry.toLowerCase();
    if (!entry || typeof entry !== 'object') return null;
    const label = entry.label ?? entry.name ?? entry.block ?? entry.material ?? entry.id;
    if (!label) return null;
    const count = entry.count ?? entry.quantity ?? entry.amount ?? entry.cantidad;
    return count === undefined ? String(label).toLowerCase() : `${String(label).toLowerCase()} (${count})`;
  }

  #nextBlockOf(active) {
    const next = active.nextBlock ?? active.next ?? active.proximoBloque;
    if (next === undefined || next === null) return null;
    if (typeof next === 'string') return next.toLowerCase();
    if (typeof next === 'object') {
      const label = next.label ?? next.name ?? next.block?.label ?? next.block;
      const count = next.count ?? next.quantity ?? next.remaining;
      if (!label) return null;
      return count === undefined ? String(label).toLowerCase() : `${String(label).toLowerCase()} (${count})`;
    }
    return null;
  }

  #unavailable() {
    return ChatResponse.unknown(
      'El modo educativo todavía no está conectado a esta partida, así que no puedo ver los ' +
        'planos. Cuando el juego me los pase, te digo qué materiales lleva cada uno.',
      ChatResponse.Topics.EDUCATION
    );
  }
}
