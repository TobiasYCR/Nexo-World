import { AudioCategories } from '../utils/Constants.js';

/**
 * Música de ambiente generada en vivo con la Web Audio API: acordes suaves
 * que duran varios segundos y notas sueltas tipo campana encima, en do mayor
 * pentatónica para que nada choque. No usa archivos (no hay licencias ni
 * descargas) y nunca se repite igual.
 *
 * Sale por la categoría "music" del AudioManager: el volumen se regula con
 * setCategoryVolume('music', …) y también la afecta el volumen maestro.
 */
export class AmbientMusic {
  /** Acordes en notas MIDI: Cmaj7, Am7, Fmaj7, G6. */
  static PROGRESSION = Object.freeze([
    Object.freeze([48, 55, 64, 71]),
    Object.freeze([45, 52, 60, 67]),
    Object.freeze([41, 48, 57, 64]),
    Object.freeze([43, 50, 59, 64])
  ]);

  /** Do mayor pentatónica, en la octava de la melodía. */
  static MELODY_NOTES = Object.freeze([72, 74, 76, 79, 81, 84]);

  /** Segundos que se agenda por adelantado. */
  static LOOKAHEAD = 2.5;

  #enabled = true;
  #playing = false;
  #timer = null;
  #bus = null;
  #nextChordTime = 0;
  #chordIndex = 0;
  #scheduledChords = 0;

  /**
   * @param {import('./AudioManager.js').AudioManager} audio
   * @param {Object} [options]
   * @param {number} [options.chordSeconds]
   * @param {() => number} [options.random]
   * @param {{setInterval: Function, clearInterval: Function, setTimeout: Function}} [options.timers]
   */
  constructor(audio, { chordSeconds = 8, random = Math.random, timers = globalThis } = {}) {
    this.audio = audio;
    this.chordSeconds = chordSeconds;
    this.random = random;
    this.timers = timers;
  }

  get isPlaying() {
    return this.#playing;
  }

  get isEnabled() {
    return this.#enabled;
  }

  /** Cantidad de acordes agendados desde que arrancó (para pruebas y diagnóstico). */
  get scheduledChords() {
    return this.#scheduledChords;
  }

  setEnabled(enabled) {
    this.#enabled = Boolean(enabled);
    if (this.#enabled) this.start();
    else this.stop();
  }

  /**
   * Arranca si está habilitada y el audio ya se desbloqueó con un gesto.
   * @returns {boolean} true si quedó sonando
   */
  start() {
    if (!this.#enabled || this.#playing) return this.#playing;
    const context = this.audio?.context;
    const output = this.audio?.output?.(AudioCategories.MUSIC);
    if (!context || !output) return false;

    try {
      // Bus propio con un fundido de entrada y un filtro que redondea el sonido.
      this.#bus = context.createGain();
      this.#bus.gain.setValueAtTime(0, context.currentTime);
      this.#bus.gain.linearRampToValueAtTime(1, context.currentTime + 4);
      const filter = context.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 2200;
      this.#bus.connect(filter);
      filter.connect(output);
    } catch {
      this.#bus = null;
      return false;
    }

    this.#playing = true;
    this.#nextChordTime = context.currentTime + 0.2;
    this.#schedule();
    this.#timer = this.timers.setInterval(() => this.#schedule(), 1000);
    return true;
  }

  /** Fundido de salida y corte. */
  stop() {
    if (!this.#playing) return;
    this.#playing = false;
    this.timers.clearInterval(this.#timer);
    this.#timer = null;
    const context = this.audio?.context;
    const bus = this.#bus;
    this.#bus = null;
    if (!context || !bus) return;
    try {
      bus.gain.cancelScheduledValues(context.currentTime);
      bus.gain.setValueAtTime(bus.gain.value, context.currentTime);
      bus.gain.linearRampToValueAtTime(0, context.currentTime + 1.5);
      this.timers.setTimeout(() => bus.disconnect(), 1800);
    } catch {
      // Si el contexto ya se cerró no hay nada que apagar.
    }
  }

  #schedule() {
    const context = this.audio?.context;
    if (!this.#playing || !context) return;
    while (this.#nextChordTime < context.currentTime + AmbientMusic.LOOKAHEAD) {
      const chord = AmbientMusic.PROGRESSION[this.#chordIndex % AmbientMusic.PROGRESSION.length];
      this.#playChord(context, chord, this.#nextChordTime);
      this.#playMelody(context, this.#nextChordTime);
      this.#nextChordTime += this.chordSeconds;
      this.#chordIndex += 1;
      this.#scheduledChords += 1;
    }
  }

  /** Colchón: cada nota con entrada y salida lentas, solapada con el acorde siguiente. */
  #playChord(context, notes, start) {
    const end = start + this.chordSeconds + 2;
    for (const note of notes) {
      this.#voice(context, {
        frequency: AmbientMusic.frequency(note),
        type: 'triangle',
        start,
        end,
        peak: 0.035,
        attack: 2.5,
        release: 3
      });
    }
  }

  /** Dos a cuatro notas de campana sueltas por acorde, en momentos al azar. */
  #playMelody(context, chordStart) {
    const count = 2 + Math.floor(this.random() * 3);
    for (let index = 0; index < count; index += 1) {
      const note = AmbientMusic.MELODY_NOTES[Math.floor(this.random() * AmbientMusic.MELODY_NOTES.length)];
      const start = chordStart + 0.5 + this.random() * (this.chordSeconds - 1.5);
      this.#voice(context, {
        frequency: AmbientMusic.frequency(note),
        type: 'sine',
        start,
        end: start + 2.6,
        peak: 0.05,
        attack: 0.02,
        release: 2.5
      });
    }
  }

  #voice(context, { frequency, type, start, end, peak, attack, release }) {
    if (!this.#bus) return;
    const oscillator = context.createOscillator();
    oscillator.type = type;
    oscillator.frequency.value = frequency;
    const gain = context.createGain();
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(peak, start + attack);
    gain.gain.setValueAtTime(peak, Math.max(start + attack, end - release));
    gain.gain.linearRampToValueAtTime(0, end);
    oscillator.connect(gain);
    gain.connect(this.#bus);
    oscillator.onended = () => gain.disconnect();
    oscillator.start(start);
    oscillator.stop(end + 0.05);
  }

  /** Nota MIDI → Hz. */
  static frequency(note) {
    return 440 * 2 ** ((note - 69) / 12);
  }
}
