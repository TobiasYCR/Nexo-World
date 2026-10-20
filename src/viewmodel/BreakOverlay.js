import { GameConfig } from '../game/GameConfig.js';
import { MathUtils } from '../utils/MathUtils.js';

/**
 * Grieta sobre el bloque que se está rompiendo. Solo lee breakingBlock y
 * breakProgress que le pasan por update(): no decide cuándo algo se rompe.
 *
 * Carga sus propias texturas (crack_0.png … crack_9.png) porque son ajenas
 * al catálogo de bloques que maneja TextureManager. Sigue el mismo contrato
 * de fallos que TextureManager: una textura ausente nunca revienta el frame,
 * se cae a un oscurecimiento progresivo por etapa.
 */
export class BreakOverlay {
  #textures = new Map();
  #requested = new Set();

  constructor(p, config = GameConfig.viewmodel.breakOverlay, blockSize = GameConfig.world.BLOCK_SIZE) {
    this.p = p;
    this.config = config;
    this.blockSize = blockSize;
    this.breakingBlock = null;
    this.stage = -1;
  }

  /**
   * @param {{x:number,y:number,z:number}|null} breakingBlock
   * @param {number} breakProgress progreso de rotura en [0, 1)
   */
  update(breakingBlock, breakProgress) {
    if (!BreakOverlay.#sameBlock(this.breakingBlock, breakingBlock)) this.stage = -1;
    this.breakingBlock = breakingBlock;

    if (!breakingBlock) {
      this.stage = -1;
      return;
    }

    const clamped = MathUtils.clamp01(breakProgress);
    this.stage = MathUtils.clamp(Math.floor(clamped * this.config.STAGE_COUNT), 0, this.config.STAGE_COUNT - 1);
    this.#ensureLoaded(this.stage);
  }

  static #sameBlock(first, second) {
    return first === second || (
      first !== null && second !== null &&
      first.x === second.x && first.y === second.y && first.z === second.z
    );
  }

  draw(p, _camera) {
    if (!this.breakingBlock || this.stage < 0) return;

    const size = this.blockSize;
    const half = size / 2;
    const expanded = size * (1 + this.config.EXPANSION);
    const { x, y, z } = this.breakingBlock;
    const texture = this.#textures.get(this.stage) ?? null;

    p.push();
    p.noStroke();
    p.translate(x * size + half, y * size + half, z * size + half);

    if (texture) {
      p.texture(texture);
    } else {
      // Sin la textura todavía: oscurecimiento translúcido creciente por etapa,
      // igual de visible como señal de progreso aunque no se vea la grieta en sí.
      const alpha = Math.min(255, (this.stage + 1) * this.config.FALLBACK_ALPHA_PER_STAGE);
      p.fill(0, 0, 0, alpha);
    }
    p.box(expanded);
    p.pop();
  }

  #ensureLoaded(stage) {
    if (this.#requested.has(stage)) return;
    this.#requested.add(stage);

    const url = `${this.config.TEXTURE_BASE_PATH}crack_${stage}.png`;
    try {
      this.p.loadImage(
        url,
        (image) => this.#textures.set(stage, image),
        () => {
          // Se queda sin textura para esta etapa: draw() usa el respaldo oscurecido.
        }
      );
    } catch {
      // Entorno sin loadImage (tests): draw() ya maneja el caso sin textura.
    }
  }
}
