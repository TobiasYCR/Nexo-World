/** Codificador WAV PCM de 16 bits mono. Formato que decodeAudioData acepta en todos los navegadores. */
export class WavEncoder {
  /**
   * @param {Float32Array} samples valores en [-1, 1]
   * @param {number} sampleRate
   */
  static encode(samples, sampleRate) {
    const dataSize = samples.length * 2;
    const buffer = Buffer.alloc(44 + dataSize);

    buffer.write('RIFF', 0, 'ascii');
    buffer.writeUInt32LE(36 + dataSize, 4);
    buffer.write('WAVE', 8, 'ascii');
    buffer.write('fmt ', 12, 'ascii');
    buffer.writeUInt32LE(16, 16); // tamaño del bloque fmt
    buffer.writeUInt16LE(1, 20); // PCM
    buffer.writeUInt16LE(1, 22); // mono
    buffer.writeUInt32LE(sampleRate, 24);
    buffer.writeUInt32LE(sampleRate * 2, 28); // bytes por segundo
    buffer.writeUInt16LE(2, 32); // bytes por muestra
    buffer.writeUInt16LE(16, 34); // bits por muestra
    buffer.write('data', 36, 'ascii');
    buffer.writeUInt32LE(dataSize, 40);

    for (let index = 0; index < samples.length; index += 1) {
      const clamped = Math.max(-1, Math.min(1, samples[index]));
      buffer.writeInt16LE(Math.round(clamped * 32767), 44 + index * 2);
    }
    return buffer;
  }
}
