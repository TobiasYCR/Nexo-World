import { resolveBlockSyllables } from '../blocks/BlockType.js';

/**
 * Mapa fonético de sílabas en español para evitar que el motor TTS del navegador
 * interprete sílabas sueltas como símbolos químicos (ej. "Na" -> "sodio", "Ca" -> "calcio"),
 * abreviaturas ("Dr" -> "doctor") o siglas deletreadas ("CES" -> "C-E-S").
 * Al acentuar la vocal tónica de la sílaba en minúscula, el sintetizador en español
 * fuerza la lectura fonética pura de la sílaba.
 */
export const PHONETIC_SYLLABLE_OVERRIDES = Object.freeze({
  a: 'á',
  e: 'é',
  i: 'í',
  o: 'ó',
  u: 'ú',
  ai: 'ái',
  re: 'ré',
  ces: 'cés',
  ped: 'péd',
  tie: 'tié',
  rra: 'rrá',
  pie: 'pié',
  dra: 'drá',
  dre: 'dré',
  dri: 'drí',
  dro: 'dró',
  drio: 'drió',
  tron: 'trón',
  co: 'có',
  ho: 'ó',
  jas: 'jás',
  ta: 'tá',
  blo: 'bló',
  nes: 'nés',
  na: 'ná',
  par: 'pár',
  ti: 'tí',
  da: 'dá',
  vi: 'ví',
  nis: 'nís',
  ca: 'cá',
  ro: 'ró',
  ma: 'má',
  mi: 'mí',
  ne: 'né',
  ral: 'rál',
  de: 'dé',
  car: 'cár',
  bon: 'bón',
  hie: 'hié',
  rro: 'rró',
  dia: 'diá',
  man: 'mán',
  te: 'té',
  la: 'lá',
  llo: 'lló',
  pa: 'pá',
  nel: 'nél',
  gua: 'guá'
});

const VOWEL_TILDE_MAP = Object.freeze({
  a: 'á',
  e: 'é',
  i: 'í',
  o: 'ó',
  u: 'ú'
});

/**
 * Convierte una sílaba visual (ej. "NA", "DRA", "CES") en su representación
 * fonética para que Web Speech API en español la pronuncie como sílaba pura
 * y nunca como símbolo químico ("sodio") ni abreviatura ("doctor").
 * @param {string} syllable
 * @returns {string}
 */
export function formatSyllableForSpeech(syllable) {
  const clean = String(syllable ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  if (!clean) return '';
  if (PHONETIC_SYLLABLE_OVERRIDES[clean]) {
    return PHONETIC_SYLLABLE_OVERRIDES[clean];
  }

  // Si ya contiene una sola letra consonante o vocal, acentuar la vocal principal
  // Priorizar vocales abiertas (a, e, o) en diptongos (ej. "ia" -> "iá", "ue" -> "ué")
  const chars = [...clean];
  let targetVowelIndex = -1;

  for (let i = chars.length - 1; i >= 0; i--) {
    if ('aeo'.includes(chars[i])) {
      targetVowelIndex = i;
      break;
    }
  }

  if (targetVowelIndex === -1) {
    for (let i = chars.length - 1; i >= 0; i--) {
      if ('iu'.includes(chars[i])) {
        targetVowelIndex = i;
        break;
      }
    }
  }

  if (targetVowelIndex >= 0) {
    chars[targetVowelIndex] = VOWEL_TILDE_MAP[chars[targetVowelIndex]] ?? chars[targetVowelIndex];
  }

  return chars.join('');
}

/**
 * Servicio de pronunciación fonética y silábica mediante síntesis de voz nativa (Web Speech API).
 * Diseñado para el Modo Educativo de Nexo World:
 * - Configura voz en español (es-AR / es-419 / es-MX / es-ES) con velocidad reducida (rate: 0.75).
 * - Normaliza cada sílaba fonéticamente para evitar que diga abreviaturas o elementos químicos ("Na" != "sodio").
 * - Soporta lectura silábica pausada con resaltado visual sílaba por sílaba + palabra final.
 * - Cancela automáticamente cualquier locución previa (speechSynthesis.cancel()) ante clics rápidos.
 */
export class SpeechService {
  static #instance = null;

  /**
   * Obtiene la instancia compartida de SpeechService.
   * @param {Object} [options]
   * @returns {SpeechService}
   */
  static getInstance(options = {}) {
    if (!SpeechService.#instance) {
      SpeechService.#instance = new SpeechService(options);
    }
    return SpeechService.#instance;
  }

  /** Reinicia la instancia singleton (útil en tests). */
  static resetInstance() {
    if (SpeechService.#instance) {
      SpeechService.#instance.cancel();
      SpeechService.#instance = null;
    }
  }

  #synth;
  #UtteranceClass;
  #lang;
  #rate;
  #pitch;
  #volume;
  #syllablePauseMs;
  #stepFallbackMs;
  #enabled = true;
  #activeSessionId = 0;
  #timers = new Set();
  #activeCleanup = null;
  #cachedSpanishVoice = null;

  /**
   * @param {Object} [options]
   * @param {SpeechSynthesis} [options.synth]
   * @param {Function} [options.UtteranceClass]
   * @param {string} [options.lang='es-ES']
   * @param {number} [options.rate=0.75]
   * @param {number} [options.pitch=1.0]
   * @param {number} [options.volume=1.0]
   * @param {number} [options.syllablePauseMs=260]
   * @param {number} [options.stepFallbackMs=2600]
   */
  constructor(options = {}) {
    this.#synth = options.synth ?? (typeof window !== 'undefined' ? window.speechSynthesis : null) ?? null;
    this.#UtteranceClass = options.UtteranceClass
      ?? (typeof window !== 'undefined' ? window.SpeechSynthesisUtterance : null)
      ?? (typeof globalThis !== 'undefined' ? globalThis.SpeechSynthesisUtterance : null)
      ?? null;
    this.#lang = options.lang ?? 'es-ES';
    this.#rate = options.rate ?? 0.75;
    this.#pitch = options.pitch ?? 1.0;
    this.#volume = options.volume ?? 1.0;
    this.#syllablePauseMs = options.syllablePauseMs ?? 260;
    this.#stepFallbackMs = options.stepFallbackMs ?? 2600;

    this.#initVoicesListener();
  }

  #initVoicesListener() {
    if (!this.#synth) return;
    // Intentar precargar la voz en español si ya está disponible
    this.#cachedSpanishVoice = this.#findBestSpanishVoice();

    const onVoicesChanged = () => {
      this.#cachedSpanishVoice = this.#findBestSpanishVoice();
    };

    if (typeof this.#synth.addEventListener === 'function') {
      try {
        this.#synth.addEventListener('voiceschanged', onVoicesChanged);
      } catch {
        // Ignorar si el stub no soporta addEventListener
      }
    } else if ('onvoiceschanged' in this.#synth) {
      this.#synth.onvoiceschanged = onVoicesChanged;
    }
  }

  get rate() {
    return this.#rate;
  }

  setRate(rate) {
    if (typeof rate === 'number' && rate >= 0.3 && rate <= 2.0) {
      this.#rate = rate;
    }
  }

  get lang() {
    return this.#lang;
  }

  get isSupported() {
    return Boolean(this.#synth && typeof this.#synth.speak === 'function');
  }

  get enabled() {
    return this.#enabled;
  }

  setEnabled(enabled) {
    this.#enabled = Boolean(enabled);
    if (!this.#enabled) {
      this.cancel();
    }
  }

  get isSpeaking() {
    return this.#activeCleanup !== null || Boolean(this.#synth?.speaking);
  }

  /**
   * Selecciona la mejor voz en español disponible en el sistema/navegador
   * (priorizando voces naturales en es-AR, es-419, es-MX, es-ES o cualquier variante en español).
   * @returns {SpeechSynthesisVoice|null}
   */
  selectSpanishVoice() {
    const freshVoice = this.#findBestSpanishVoice();
    if (freshVoice) {
      this.#cachedSpanishVoice = freshVoice;
    }
    return this.#cachedSpanishVoice;
  }

  #findBestSpanishVoice() {
    if (!this.#synth || typeof this.#synth.getVoices !== 'function') return null;
    let voices = [];
    try {
      voices = this.#synth.getVoices() || [];
    } catch {
      return null;
    }
    if (voices.length === 0) return null;

    // Filtrar todas las voces que sean de idioma español por código BCP-47 o por nombre
    const spanishVoices = voices.filter((v) => {
      const lang = String(v.lang || '').toLowerCase().replace('_', '-');
      const name = String(v.name || '').toLowerCase();
      return lang.startsWith('es') || name.includes('spanish') || name.includes('español') || name.includes('espanol');
    });

    if (spanishVoices.length === 0) return null;

    // Puntuar voces para elegir la más clara y natural en español
    const scoreVoice = (v) => {
      const lang = String(v.lang || '').toLowerCase().replace('_', '-');
      const name = String(v.name || '').toLowerCase();
      let score = 0;

      if (lang === 'es-ar') score += 50;
      else if (lang === 'es-419' || lang === 'es-mx' || lang === 'es-uy' || lang === 'es-cl' || lang === 'es-co') score += 45;
      else if (lang === 'es-es') score += 40;
      else if (lang.startsWith('es-')) score += 35;
      else if (lang === 'es') score += 30;

      // Preferir voces neuronales / naturales / Google / Microsoft en español
      if (name.includes('natural') || name.includes('neural')) score += 25;
      if (name.includes('google') && (name.includes('español') || lang.startsWith('es'))) score += 20;
      if (name.includes('sabina') || name.includes('helena') || name.includes('elena') || name.includes('dalia') || name.includes('paloma') || name.includes('laura') || name.includes('pablo') || name.includes('raul') || name.includes('tomas')) {
        score += 15;
      }
      if (v.localService) score += 5;

      return score;
    };

    return [...spanishVoices].sort((a, b) => scoreVoice(b) - scoreVoice(a))[0] ?? spanishVoices[0];
  }

  /**
   * Cancela inmediatamente cualquier lectura en curso y limpia resaltados activos.
   */
  cancel() {
    this.#activeSessionId += 1;
    for (const timer of this.#timers) {
      clearTimeout(timer);
    }
    this.#timers.clear();

    if (this.#activeCleanup) {
      const cleanup = this.#activeCleanup;
      this.#activeCleanup = null;
      try {
        cleanup();
      } catch {
        // Ignorar errores en callbacks de limpieza
      }
    }

    if (this.#synth && typeof this.#synth.cancel === 'function') {
      try {
        this.#synth.cancel();
      } catch {
        // Ignorar errores de la API nativa
      }
    }
  }

  /**
   * Pronuncia un bloque o término según el modo elegido ('syllabic' por defecto o 'word').
   * @param {Object|string} blockOrText
   * @param {Object} [options]
   * @param {'syllabic'|'word'} [options.mode='syllabic']
   * @param {(index: number, syllable: string) => void} [options.onSyllable]
   * @param {(word: string) => void} [options.onCompleteWord]
   * @param {() => void} [options.onEnd]
   */
  speak(blockOrText, options = {}) {
    const mode = options.mode ?? 'syllabic';
    if (mode === 'word') {
      const word = typeof blockOrText === 'string'
        ? blockOrText
        : (blockOrText?.label || blockOrText?.name || '');
      return this.speakWord(word, options);
    }
    return this.speakSyllables(blockOrText, options);
  }

  /**
   * Modo 1: Lectura silábica pausada.
   * Pronuncia sílaba por sílaba usando fonética en español mientras resalta visualmente
   * cada una en la interfaz, y finalmente dice la palabra completa.
   * @param {Object|string} blockOrText
   * @param {Object} [callbacks]
   * @param {(index: number, syllable: string) => void} [callbacks.onSyllable]
   * @param {(word: string) => void} [callbacks.onCompleteWord]
   * @param {() => void} [callbacks.onEnd]
   */
  speakSyllables(blockOrText, callbacks = {}) {
    this.cancel();
    if (!this.#enabled) {
      callbacks.onEnd?.();
      return;
    }

    const inputObj = typeof blockOrText === 'string'
      ? { label: blockOrText, name: blockOrText }
      : (blockOrText || {});

    const fullWord = String(inputObj.label || inputObj.name || '').trim();
    const { syllables } = resolveBlockSyllables({
      label: inputObj.label,
      name: inputObj.name,
      syllables: inputObj.syllables,
      syllableText: inputObj.syllableText
    });

    if (!fullWord && syllables.length === 0) {
      callbacks.onEnd?.();
      return;
    }

    const sessionId = this.#activeSessionId;
    let finished = false;

    const finishSession = () => {
      if (finished) return;
      finished = true;
      this.#activeCleanup = null;
      callbacks.onEnd?.();
    };

    this.#activeCleanup = finishSession;

    // Secuencia de pasos: cada sílaba con fonética española + palabra completa al final
    const steps = syllables.map((syl, index) => ({
      type: 'syllable',
      index,
      text: formatSyllableForSpeech(syl),
      display: syl
    }));

    if (fullWord) {
      steps.push({
        type: 'word',
        index: -1,
        text: fullWord.toLowerCase(),
        display: fullWord
      });
    }

    const runStep = (stepIndex) => {
      if (this.#activeSessionId !== sessionId) return;
      if (stepIndex >= steps.length) {
        finishSession();
        return;
      }

      const step = steps[stepIndex];
      if (step.type === 'syllable') {
        callbacks.onSyllable?.(step.index, step.display);
      } else {
        callbacks.onCompleteWord?.(step.display);
      }

      this.#speakSingleUtterance(step.text, sessionId, () => {
        if (this.#activeSessionId !== sessionId) return;
        const pause = step.type === 'syllable' ? this.#syllablePauseMs : 140;
        this.#schedule(sessionId, () => runStep(stepIndex + 1), pause);
      });
    };

    runStep(0);
  }

  /**
   * Modo 2: Pronunciación directa de la palabra o frase completa.
   * @param {string} text
   * @param {Object} [callbacks]
   * @param {(word: string) => void} [callbacks.onCompleteWord]
   * @param {() => void} [callbacks.onEnd]
   */
  speakWord(text, callbacks = {}) {
    this.cancel();
    const clean = String(text ?? '').trim();
    if (!this.#enabled || !clean) {
      callbacks.onEnd?.();
      return;
    }

    const sessionId = this.#activeSessionId;
    let finished = false;
    const finishSession = () => {
      if (finished) return;
      finished = true;
      this.#activeCleanup = null;
      callbacks.onEnd?.();
    };

    this.#activeCleanup = finishSession;
    callbacks.onCompleteWord?.(clean);

    this.#speakSingleUtterance(clean, sessionId, () => {
      if (this.#activeSessionId !== sessionId) return;
      finishSession();
    });
  }

  #speakSingleUtterance(text, sessionId, onStepDone) {
    let stepCompleted = false;
    const completeOnce = () => {
      if (stepCompleted || this.#activeSessionId !== sessionId) return;
      stepCompleted = true;
      onStepDone();
    };

    if (this.isSupported) {
      try {
        const utterance = this.#createUtterance(text);
        utterance.onend = () => completeOnce();
        utterance.onerror = () => completeOnce();
        this.#synth.speak(utterance);
        // Respaldo amplio por si el navegador no emite onend
        this.#schedule(sessionId, completeOnce, this.#stepFallbackMs);
        return;
      } catch {
        // Si falla la creación de utterance, usar fallback temporizado
      }
    }

    this.#schedule(sessionId, completeOnce, Math.min(this.#stepFallbackMs, 350));
  }

  #createUtterance(text) {
    const utterance = this.#UtteranceClass
      ? new this.#UtteranceClass(text)
      : { text, lang: this.#lang, rate: this.#rate, pitch: this.#pitch, volume: this.#volume };

    const voice = this.selectSpanishVoice();
    if (voice) {
      utterance.voice = voice;
      utterance.lang = voice.lang ? String(voice.lang).replace('_', '-') : this.#lang;
    } else {
      utterance.lang = this.#lang;
    }
    utterance.rate = this.#rate;
    utterance.pitch = this.#pitch;
    utterance.volume = this.#volume;
    return utterance;
  }

  #schedule(sessionId, fn, delayMs) {
    const timer = setTimeout(() => {
      this.#timers.delete(timer);
      if (this.#activeSessionId === sessionId) {
        fn();
      }
    }, delayMs);
    this.#timers.add(timer);
  }
}
