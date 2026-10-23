import { GameConfig } from '../game/GameConfig.js';
import { MathUtils } from '../utils/MathUtils.js';

/** Partículas ambientales con pool fijo y sin conocimiento de la generación. */
export class AmbientParticles {
  #pool;
  #active = 0;
  #spawnAccumulator = 0;
  #kind = null;

  constructor(config = GameConfig.viewmodel.ambientParticles, { world = null, blockSize = GameConfig.world.BLOCK_SIZE, random = Math.random } = {}) {
    this.config = config;
    this.world = world;
    this.blockSize = blockSize;
    this.random = random;
    this.#pool = Array.from({ length: config.MAX_PARTICLES }, () => AmbientParticles.#emptyParticle());
  }

  get activeCount() { return this.#active; }
  get poolSize() { return this.#pool.length; }

  update(deltaTime, { playerPosition = null, biome = null, enabled = true, paused = false } = {}) {
    if (paused || !enabled || !this.config.ENABLED || !playerPosition || !biome) return;

    const kind = AmbientParticles.#kindOf(biome);
    if (this.#kind !== null && this.#kind !== kind) this.reset();
    this.#kind = kind;
    const density = this.#density(kind);
    const target = Math.round(this.config.MAX_PARTICLES * density);
    const safeDelta = Math.max(0, deltaTime);
    this.#spawnAccumulator += safeDelta * this.config.SPAWN_RATE;

    for (const particle of this.#pool) {
      if (!particle.active) continue;
      particle.life -= safeDelta;
      particle.x += particle.vx * safeDelta;
      particle.y += particle.vy * safeDelta;
      particle.z += particle.vz * safeDelta;
      if (particle.life <= 0 || this.#tooFar(particle, playerPosition)) {
        particle.active = false;
        this.#active -= 1;
      }
    }

    while (this.#active < target && this.#spawnAccumulator >= 1) {
      this.#spawnAccumulator -= 1;
      if (!this.#spawn(playerPosition, kind)) break;
    }
  }

  draw(p, _camera) {
    if (this.#active === 0) return;
    p.push();
    p.noStroke?.();
    for (const particle of this.#pool) {
      if (!particle.active) continue;
      const alpha = Math.round(170 * MathUtils.clamp01(particle.life / particle.maxLife));
      p.push();
      p.translate(particle.x, particle.y, particle.z);
      p.fill?.(particle.color[0], particle.color[1], particle.color[2], alpha);
      p.ambientMaterial?.(particle.color[0], particle.color[1], particle.color[2]);
      p.box?.(this.config.SIZE);
      p.pop();
    }
    p.pop();
  }

  reset() {
    for (const particle of this.#pool) particle.active = false;
    this.#active = 0;
    this.#spawnAccumulator = 0;
    this.#kind = null;
  }

  #spawn(playerPosition, kind) {
    const particle = this.#pool.find((candidate) => !candidate.active);
    if (!particle) return false;

    const distance = this.config.DISTANCE;
    const x = playerPosition.x + (this.random() * 2 - 1) * distance;
    const z = playerPosition.z + (this.random() * 2 - 1) * distance;
    const horizontalDistance = Math.hypot(x - playerPosition.x, z - playerPosition.z);
    if (horizontalDistance > distance) return true;

    const nearGround = kind === 'desert';
    particle.active = true;
    particle.x = x;
    particle.z = z;
    particle.y = nearGround
      ? playerPosition.y + this.random() * this.blockSize * 1.5
      : playerPosition.y - this.blockSize * 0.5 + this.random() * this.blockSize * 2.5;
    if (this.#isSolid(x, particle.y, z)) return true;
    particle.vx = kind === 'desert' ? 5 + this.random() * 10 : (this.random() - 0.5) * 3;
    particle.vy = kind === 'forest' ? 3 + this.random() * 4 : (this.random() - 0.5) * 2;
    particle.vz = kind === 'desert' ? (this.random() - 0.5) * 3 : (this.random() - 0.5) * 2;
    particle.life = this.config.PARTICLE_LIFETIME * (0.75 + this.random() * 0.5);
    particle.maxLife = particle.life;
    particle.color = this.config.COLORS[kind] ?? this.config.COLORS.plains;
    this.#active += 1;
    return true;
  }

  #isSolid(x, y, z) {
    if (!this.world) return false;
    const block = this.world.worldToBlock(x, y, z);
    return this.world.isSolid(block.x, block.y, block.z);
  }

  #tooFar(particle, playerPosition) {
    return Math.hypot(particle.x - playerPosition.x, particle.z - playerPosition.z) > this.config.DISTANCE * 1.25;
  }

  #density(kind) {
    return MathUtils.clamp01(this.config[`DENSITY_${kind.toUpperCase()}`] ?? 0);
  }

  static #kindOf(biome) {
    const text = String(biome?.name ?? biome?.label ?? biome ?? 'plains').toLowerCase();
    if (text.includes('forest') || text.includes('bosque')) return 'forest';
    if (text.includes('desert') || text.includes('desierto')) return 'desert';
    if (text.includes('mountain') || text.includes('monta')) return 'mountains';
    return 'plains';
  }

  static #emptyParticle() {
    return {
      active: false,
      x: 0,
      y: 0,
      z: 0,
      vx: 0,
      vy: 0,
      vz: 0,
      life: 0,
      maxLife: 0,
      color: [255, 255, 255]
    };
  }
}
