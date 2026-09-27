import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CrackTextureFactory } from '../scripts/lib/CrackTextureFactory.js';
import { generateCrackTextures } from '../scripts/generate-cracks.js';

test('createAll genera 10 etapas nombradas crack_0.png a crack_9.png', () => {
  const files = CrackTextureFactory.createAll();
  assert.equal(files.size, 10);
  for (let stage = 0; stage < 10; stage += 1) assert.ok(files.has(`crack_${stage}.png`));
});

test('cada lienzo es 16x16', () => {
  const canvas = CrackTextureFactory.stage(0);
  assert.equal(canvas.width, 16);
  assert.equal(canvas.height, 16);
});

test('las etapas más altas tienen más píxeles opacos que las bajas', () => {
  function opaquePixelCount(canvas) {
    let count = 0;
    canvas.forEach((x, y) => {
      const offset = (y * canvas.width + x) * 4;
      if (canvas.pixels[offset + 3] > 0) count += 1;
    });
    return count;
  }

  const early = opaquePixelCount(CrackTextureFactory.stage(0));
  const late = opaquePixelCount(CrackTextureFactory.stage(9));
  assert.ok(late > early, `etapa 9 (${late} píxeles) debería tener más grieta que la etapa 0 (${early})`);
});

test('generateCrackTextures() es determinista: mismos bytes en corridas distintas', () => {
  const first = generateCrackTextures();
  const second = generateCrackTextures();

  assert.equal(first.size, second.size);
  for (const [fileName, png] of first) {
    assert.ok(second.has(fileName));
    assert.ok(png.equals(second.get(fileName)), `${fileName} debería ser byte a byte igual entre corridas`);
  }
});
