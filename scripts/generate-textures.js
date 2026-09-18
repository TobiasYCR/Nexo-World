/**
 * Genera las texturas de bloque 16x16 en assets/textures/blocks/.
 * Uso: node scripts/generate-textures.js
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { BlockTextureFactory } from './lib/BlockTextureFactory.js';
import { PngEncoder } from './lib/PngEncoder.js';

const OUTPUT_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'assets', 'textures', 'blocks');

/** @returns {Map<string, Buffer>} nombre de archivo -> PNG */
export function generateBlockTextures() {
  const files = new Map();
  for (const [fileName, canvas] of BlockTextureFactory.createAll()) {
    files.set(fileName, PngEncoder.encode(canvas));
  }
  return files;
}

function main() {
  mkdirSync(OUTPUT_DIR, { recursive: true });
  for (const [fileName, png] of generateBlockTextures()) {
    writeFileSync(join(OUTPUT_DIR, fileName), png);
    console.log(`textures/blocks/${fileName} (${png.length} bytes)`);
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) main();
