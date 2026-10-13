import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';
import { generateBlockTextures } from '../scripts/generate-textures.js';
import { generateSfx } from '../scripts/generate-sfx.js';
import { createDefaultBlockRegistry } from '../src/blocks/BlockRegistry.js';
import { AssetCatalog } from '../src/utils/AssetCatalog.js';
import { GameConfig } from '../src/game/GameConfig.js';

const TEXTURE_DIR = new URL('../assets/textures/blocks/', import.meta.url);
const AUDIO_DIR = new URL('../assets/audio/', import.meta.url);

/** Decodifica un PNG RGBA 8 bits sin filtros de fila (lo que produce PngEncoder). */
function decodePng(buffer) {
  const width = buffer.readUInt32BE(16);
  const height = buffer.readUInt32BE(20);
  const idatLength = buffer.readUInt32BE(33);
  const raw = inflateSync(buffer.subarray(41, 41 + idatLength));
  const pixels = [];
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const offset = y * (width * 4 + 1) + 1 + x * 4;
      pixels.push([raw[offset], raw[offset + 1], raw[offset + 2], raw[offset + 3]]);
    }
  }
  return { width, height, pixels };
}

function averageColor(pixels) {
  const sum = pixels.reduce((acc, [r, g, b]) => [acc[0] + r, acc[1] + g, acc[2] + b], [0, 0, 0]);
  return sum.map((channel) => channel / pixels.length);
}

test('las texturas generadas son deterministas', () => {
  const first = generateBlockTextures();
  const second = generateBlockTextures();
  for (const [name, png] of first) assert.ok(png.equals(second.get(name)), name);
});

test('se generan las texturas de bloques en PNG de 16x16', () => {
  const textures = generateBlockTextures();
  assert.deepEqual([...textures.keys()].sort(), [
    'bedrock.png',
    'coal_ore.png',
    'cobblestone.png',
    'diamond_ore.png',
    'dirt.png',
    'glass.png',
    'gold_ore.png',
    'grass_side.png',
    'grass_top.png',
    'iron_ore.png',
    'leaves.png',
    'log_side.png',
    'log_top.png',
    'planks.png',
    'sand.png',
    'sandstone.png',
    'stone.png'
  ]);
  for (const [name, png] of textures) {
    assert.equal(png.subarray(1, 4).toString('ascii'), 'PNG', name);
    const { width, height } = decodePng(png);
    assert.deepEqual([width, height], [16, 16], name);
  }
});

test('el vidrio generado tiene transparencia', () => {
  const glass = decodePng(generateBlockTextures().get('glass.png'));
  assert.ok(glass.pixels.some((pixel) => pixel[3] < 255));
});

test('los bloques opacos nuevos no tienen transparencia en su textura', () => {
  const textures = generateBlockTextures();
  for (const name of ['sandstone.png', 'bedrock.png', 'coal_ore.png', 'iron_ore.png', 'gold_ore.png', 'diamond_ore.png']) {
    const { pixels } = decodePng(textures.get(name));
    assert.ok(pixels.every((pixel) => pixel[3] === 255), name);
  }
});

test('cada textura de mineral conserva la piedra de base y suma su color propio', () => {
  const textures = generateBlockTextures();
  const stoneColors = new Set(decodePng(textures.get('stone.png')).pixels.map((rgb) => rgb.slice(0, 3).join()));
  for (const name of ['coal_ore.png', 'iron_ore.png', 'gold_ore.png', 'diamond_ore.png']) {
    const pixels = decodePng(textures.get(name)).pixels.map((rgb) => rgb.slice(0, 3).join());
    const fromStone = pixels.filter((rgb) => stoneColors.has(rgb)).length;
    assert.ok(fromStone > pixels.length * 0.4, `${name}: debería seguir leyéndose como piedra`);
    assert.ok(fromStone < pixels.length * 0.8, `${name}: el mineral debería verse`);
  }
});

test('las texturas se distinguen entre sí por color medio y no son planas', () => {
  const decoded = [...generateBlockTextures()].map(([name, png]) => [name, decodePng(png).pixels]);
  for (const [name, pixels] of decoded) {
    const distinct = new Set(pixels.map((rgb) => rgb.join())).size;
    assert.ok(distinct >= 3, `${name} tiene solo ${distinct} colores`);
  }
  for (let i = 0; i < decoded.length; i += 1) {
    for (let j = i + 1; j < decoded.length; j += 1) {
      const a = averageColor(decoded[i][1]);
      const b = averageColor(decoded[j][1]);
      const distance = Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
      assert.ok(distance > 25, `${decoded[i][0]} y ${decoded[j][0]} se parecen demasiado (${distance.toFixed(1)})`);
    }
  }
});

test('los PNG del repositorio coinciden con el generador', () => {
  for (const [name, png] of generateBlockTextures()) {
    const onDisk = new URL(name, TEXTURE_DIR);
    assert.ok(existsSync(onDisk), `falta ${name}: correr node scripts/generate-textures.js`);
    assert.ok(readFileSync(onDisk).equals(png), `${name} desactualizado: correr node scripts/generate-textures.js`);
  }
});

test('cada textura declarada en el BlockRegistry existe en disco', () => {
  for (const name of createDefaultBlockRegistry().textureNames()) {
    assert.ok(existsSync(new URL(name, TEXTURE_DIR)), name);
  }
});

test('los SFX son WAV PCM deterministas y coinciden con el repositorio', () => {
  const first = generateSfx();
  const second = generateSfx();
  for (const [path, wav] of first) {
    assert.ok(wav.equals(second.get(path)), path);
    assert.equal(wav.subarray(0, 4).toString('ascii'), 'RIFF');
    assert.equal(wav.subarray(8, 12).toString('ascii'), 'WAVE');
    const onDisk = new URL(path, AUDIO_DIR);
    assert.ok(existsSync(onDisk) && readFileSync(onDisk).equals(wav), `${path}: correr node scripts/generate-sfx.js`);
  }
});

test('el catálogo apunta a los SFX generados', () => {
  const catalog = new AssetCatalog(GameConfig.assets);
  const generated = new Set(generateSfx().keys());
  for (const soundId of catalog.soundIds()) {
    const url = catalog.soundUrl(soundId);
    assert.ok(url.startsWith('/audio/'), url);
    assert.ok(generated.has(url.slice('/audio/'.length)), url);
  }
});
