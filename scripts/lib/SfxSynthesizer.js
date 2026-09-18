import { SeededRandom } from './SeededRandom.js';

/**
 * Síntesis de los SFX placeholder. Sonidos cortos (< 0,2 s) armados con una
 * sinusoide que cae de tono (golpe) y ruido filtrado (crujido).
 */
export class SfxSynthesizer {
  static SAMPLE_RATE = 22050;
  /** Rampa final para que el corte no produzca un clic audible. */
  static #FADE_OUT_SECONDS = 0.006;

  /** Colocar bloque: golpe sordo y corto. */
  static blockPlace() {
    const random = SeededRandom.fromString('block_place');
    return SfxSynthesizer.#render(0.1, (time) => {
      const frequency = 110 + 90 * Math.exp(-time / 0.02);
      const body = Math.sin(2 * Math.PI * frequency * time) * Math.exp(-time / 0.03);
      const click = time < 0.004 ? random.signed() * (1 - time / 0.004) * 0.5 : 0;
      return (body + click) * 0.7;
    });
  }

  /** Romper bloque: crujido de ruido con un golpe grave debajo. */
  static blockBreak() {
    const random = SeededRandom.fromString('block_break');
    let lowPassed = 0;
    return SfxSynthesizer.#render(0.18, (time) => {
      // Pasa bajos de un polo: saca el siseo agudo y deja un "crunch".
      lowPassed += (random.signed() - lowPassed) * 0.35;
      const crackle = random.next() < 0.03 ? random.signed() * 0.6 : 0;
      const noise = (lowPassed * 1.6 + crackle) * Math.exp(-time / 0.05);
      const thump = Math.sin(2 * Math.PI * 85 * time) * Math.exp(-time / 0.04) * 0.5;
      return (noise + thump) * 0.6;
    });
  }

  /** @returns {Map<string, Float32Array>} ruta relativa a assets/audio -> muestras */
  static createAll() {
    return new Map([
      ['sfx/block_place.wav', SfxSynthesizer.blockPlace()],
      ['sfx/block_break.wav', SfxSynthesizer.blockBreak()]
    ]);
  }

  static #render(durationSeconds, sampleAt) {
    const rate = SfxSynthesizer.SAMPLE_RATE;
    const samples = new Float32Array(Math.round(durationSeconds * rate));
    const fadeSamples = Math.round(SfxSynthesizer.#FADE_OUT_SECONDS * rate);
    for (let index = 0; index < samples.length; index += 1) {
      const remaining = samples.length - index;
      const fade = remaining < fadeSamples ? remaining / fadeSamples : 1;
      samples[index] = Math.max(-1, Math.min(1, sampleAt(index / rate) * fade));
    }
    return samples;
  }
}
