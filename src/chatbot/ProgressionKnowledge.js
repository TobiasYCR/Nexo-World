import { ChatResponse } from './ChatResponse.js';
import { TextNormalizer } from './TextNormalizer.js';
import { NumberFormatter } from './NumberFormatter.js';
import { GameConfig } from '../game/GameConfig.js';
import { createDefaultBlockRegistry } from '../blocks/BlockRegistry.js';

/**
 * Puntos y niveles: lo que se gana jugando y cómo se sube.
 *
 * Toda cifra sale de GameConfig.progression.POINTS y GameConfig.levels. No hay
 * valores escritos acá a propósito: si alguien cambia lo que da un mineral o
 * cuánta experiencia pide un nivel, la respuesta cambia sola. Las respuestas en
 * vivo leen game.progression y, si todavía no hay datos, lo dicen.
 *
 * Las reglas de puntos viven en src/progression/ (Backend 2); esta clase solo
 * las lee. No calcula puntajes ni valida nada del servidor.
 */
export class ProgressionKnowledge {
  #config;
  #registry;
  #formatter;
  #contextProvider = null;

  /**
   * @param {Object} [options]
   * @param {Object} [options.config] GameConfig completo
   * @param {Object} [options.registry] BlockRegistry para los nombres de minerales
   * @param {NumberFormatter} [options.formatter]
   * @param {(() => Object|null)|null} [options.contextProvider] estado vivo de la partida
   */
  constructor({
    config = GameConfig,
    registry = createDefaultBlockRegistry(),
    formatter = new NumberFormatter({ config: config.chatbot }),
    contextProvider = null
  } = {}) {
    this.#config = config;
    this.#registry = registry;
    this.#formatter = formatter;
    this.setContextProvider(contextProvider);
  }

  /** El mismo proveedor que usa GameKnowledge: Game lo actualiza por partida. */
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
   * @returns {Object|null} ChatResponse o null si esta clase no lo cubre
   */
  answer(intentId, normalizedQuestion = '') {
    const handlers = {
      'game.points.earn': () => this.#pointsEarn(),
      'game.points.ore': () => this.#pointsOre(normalizedQuestion),
      'game.levels.how': () => this.#levelsHow(),
      'game.levels.max': () => this.#levelsMax(),
      'game.status.points': () => this.#statusPoints(),
      'game.status.level': () => this.#statusLevel()
    };
    return handlers[intentId]?.() ?? null;
  }

  // -------------------------------------------------------------------- puntos

  #pointsEarn() {
    const points = this.#pointsConfig();
    const ores = this.#oreEntries()
      .sort((a, b) => a.points - b.points)
      .map((ore) => `${ore.label.toLowerCase()}: ${this.#format(ore.points)}`)
      .join(', ');
    const tope = this.#config.progression?.MAX_BLOCKS_BUILT_COUNTED;

    const partes = [
      `Explorar una zona nueva da ${this.#format(points.EXPLORATION_CELL)} puntos`,
      `descubrir un bioma da ${this.#format(points.BIOME_DISCOVERED)}`,
      `construir un bloque da ${this.#format(points.BLOCK_BUILT)}`
    ];
    if (Number.isFinite(tope)) {
      partes.push(`y los bloques construidos cuentan hasta ${this.#format(tope)} por mundo`);
    }

    return ChatResponse.known(
      `Sumás puntos así: ${partes.join(', ')}. Los minerales valen: ${ores}. ` +
        'Para saber cuántos tenés ahora, preguntame "¿cuántos puntos tengo?".',
      ChatResponse.Topics.POINTS,
      'GameConfig.progression.POINTS + MAX_BLOCKS_BUILT_COUNTED'
    );
  }

  #pointsOre(normalizedQuestion) {
    const ore = this.#oreFromQuestion(normalizedQuestion);
    if (!ore) return this.#pointsEarn();

    return ChatResponse.known(
      `El ${ore.label.toLowerCase()} da ${this.#format(ore.points)} ` +
        `${ore.points === 1 ? 'punto' : 'puntos'} por cada uno que sacás del mundo. ` +
        'Solo cuenta la primera vez que lo minás en ese mundo.',
      ChatResponse.Topics.POINTS,
      `GameConfig.progression.POINTS.ORES[${ore.id}]`
    );
  }

  #pointsConfig() {
    return this.#config.progression?.POINTS ?? {};
  }

  /** Minerales que puntúan, con el nombre que muestra el juego. */
  #oreEntries() {
    const ores = this.#pointsConfig().ORES ?? {};
    return Object.entries(ores).map(([id, points]) => {
      const numericId = Number(id);
      const type = this.#registry.has?.(numericId) ? this.#registry.get(numericId) : null;
      return { id: numericId, label: type?.label ?? `mineral ${id}`, points };
    });
  }

  /** El mineral nombrado en la pregunta, si es uno de los que puntúan. */
  #oreFromQuestion(question) {
    const text = String(question ?? '');
    if (text === '') return null;

    return this.#oreEntries().find(({ label }) => {
      const words = TextNormalizer.words(label).filter((word) => word !== 'mineral');
      return words.some((word) => TextNormalizer.mentions(text, word));
    }) ?? null;
  }

  // -------------------------------------------------------------------- niveles

  #levelsHow() {
    const levels = this.#config.levels ?? {};
    return ChatResponse.known(
      'Subís de nivel juntando experiencia. Cada cosa suma: explorar una zona nueva ' +
        `(${this.#format(levels.XP_EXPLORATION_CELL)}), descubrir un bioma (${this.#format(levels.XP_BIOME)}), ` +
        `minar un mineral (${this.#format(levels.XP_ORES)}) y construir un bloque ` +
        `(${this.#format(levels.XP_BLOCK_BUILT)}). Para pasar del nivel 1 al 2 necesitás ` +
        `${this.#format(levels.BASE_XP)} de experiencia, y cada nivel siguiente pide un poco más.`,
      ChatResponse.Topics.LEVELS,
      'GameConfig.levels'
    );
  }

  #levelsMax() {
    const maxLevel = this.#config.levels?.MAX_LEVEL;
    if (maxLevel === null || maxLevel === Infinity) {
      return ChatResponse.known(
        'No hay un nivel máximo: podés seguir juntando experiencia.',
        ChatResponse.Topics.LEVELS,
        'GameConfig.levels.MAX_LEVEL'
      );
    }

    return ChatResponse.known(
      `El nivel máximo es ${this.#format(maxLevel)}. Llegar ahí no bloquea nada: ` +
        'podés seguir jugando, explorando y construyendo.',
      ChatResponse.Topics.LEVELS,
      'GameConfig.levels.MAX_LEVEL'
    );
  }

  // ------------------------------------------------------- estado de la partida

  #statusPoints() {
    const snapshot = this.#snapshot();
    if (!snapshot) return this.#noGame();

    const score = Number.isFinite(snapshot.score) ? snapshot.score : null;
    if (score === null) {
      return ChatResponse.unknown(
        'Todavía no tengo tus puntos: la partida no me pasó ese dato.',
        ChatResponse.Topics.STATUS
      );
    }

    const partes = [`Tenés ${this.#format(score)} ${score === 1 ? 'punto' : 'puntos'} en este mundo.`];
    if (Number.isFinite(snapshot.verifiedScore)) {
      partes.push(`El servidor confirmó ${this.#format(snapshot.verifiedScore)}.`);
    } else if (snapshot.status === 'offline') {
      partes.push('El servidor no responde ahora, así que la marca todavía no está confirmada.');
    } else if (snapshot.status === 'syncing') {
      partes.push('Se están enviando al servidor.');
    }

    return ChatResponse.known(
      partes.join(' '),
      ChatResponse.Topics.STATUS,
      'game.progression.score'
    );
  }

  #statusLevel() {
    const snapshot = this.#snapshot();
    if (!snapshot) return this.#noGame();

    const level = snapshot.level;
    if (!Number.isFinite(level)) {
      return ChatResponse.unknown(
        'Todavía no tengo tu nivel: la partida no me pasó ese dato.',
        ChatResponse.Topics.STATUS
      );
    }

    if (snapshot.isMaxLevel) {
      return ChatResponse.known(
        `Sos nivel ${this.#format(level)}, el nivel máximo. Ya no necesitás más experiencia para subir.`,
        ChatResponse.Topics.STATUS,
        'game.progression.level'
      );
    }

    const current = Number.isFinite(snapshot.experience) ? snapshot.experience : 0;
    const next = Number.isFinite(snapshot.experienceForNextLevel)
      ? snapshot.experienceForNextLevel
      : null;
    const falta = next === null ? null : Math.max(0, next - current);
    const tramo = Number.isFinite(snapshot.levelProgress)
      ? ` Vas ${Math.round(snapshot.levelProgress * 100)}% del camino.`
      : '';

    const texto = falta === null
      ? `Sos nivel ${this.#format(level)}.`
      : `Sos nivel ${this.#format(level)} y te faltan ${this.#format(falta)} de experiencia ` +
        `para el nivel ${this.#format(level + 1)}.`;

    return ChatResponse.known(
      `${texto}${tramo}`,
      ChatResponse.Topics.STATUS,
      'game.progression.level + experienceForNextLevel'
    );
  }

  #snapshot() {
    const progression = this.#context?.progression;
    if (!progression) return null;
    try {
      return progression.snapshot?.() ?? progression;
    } catch {
      return null;
    }
  }

  #noGame() {
    return ChatResponse.unknown(
      'Eso solo lo puedo responder con una partida en curso. Entrá al mundo y volvé a preguntarme.',
      ChatResponse.Topics.STATUS
    );
  }

  #format(value) {
    return this.#formatter.format(value);
  }
}
