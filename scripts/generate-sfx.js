/**
 * Genera los SFX placeholder en assets/audio/sfx/.
 * Uso: node scripts/generate-sfx.js
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { SfxSynthesizer } from './lib/SfxSynthesizer.js';
import { WavEncoder } from './lib/WavEncoder.js';

const AUDIO_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'assets', 'audio');

/** @returns {Map<string, Buffer>} ruta relativa a assets/audio -> WAV */
export function generateSfx() {
  const files = new Map();
  for (const [relativePath, samples] of SfxSynthesizer.createAll()) {
    files.set(relativePath, WavEncoder.encode(samples, SfxSynthesizer.SAMPLE_RATE));
  }
  return files;
}

function main() {
  for (const [relativePath, wav] of generateSfx()) {
    const target = join(AUDIO_DIR, relativePath);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, wav);
    console.log(`audio/${relativePath} (${wav.length} bytes)`);
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) main();
