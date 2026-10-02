/**
 * Genera las texturas de grieta 16x16 en assets/textures/effects/.
 * Uso: node scripts/generate-cracks.js
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { CrackTextureFactory } from './lib/CrackTextureFactory.js';
import { PngEncoder } from './lib/PngEncoder.js';

const OUTPUT_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'assets', 'textures', 'effects');

/** @returns {Map<string, Buffer>} nombre de archivo -> PNG */
export function generateCrackTextures() {
  const files = new Map();
  for (const [fileName, canvas] of CrackTextureFactory.createAll()) {
    files.set(fileName, PngEncoder.encode(canvas));
  }
  return files;
}

function main() {
  mkdirSync(OUTPUT_DIR, { recursive: true });
  for (const [fileName, png] of generateCrackTextures()) {
    writeFileSync(join(OUTPUT_DIR, fileName), png);
    console.log(`textures/effects/${fileName} (${png.length} bytes)`);
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) main();
