import { GameConfig } from '../game/GameConfig.js';

/**
 * Cuadraditos que saltan al romper un bloque. Pool fijo de MAX_PARTICLES,
 * preasignado en el constructor: spawn() y update() nunca hacen `new` por
 * partícula, solo reescriben slots existentes, para no ensuciar el frame
 * con asignaciones.
 *
 * Si el pool está lleno cuando hace falta una partícula nueva, se recicla la
 * más vieja: #cursor avanza en anillo por orden de creación (round-robin),
 * así que el slot que se pisa es siempre el que se escribió hace más tiempo.
 */
export class BlockParticles {
  #pool;
  #cursor = 0;

  constructor(config = GameConfig.viewmodel.particles) {
    this.config = config;
    this.#pool = Array.from({ length: config.MAX_PARTICLES }, () => BlockParticles.#emptyParticle());
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
      color: [255, 255, 255],
      size: 2.5,
      rotationX: 0,
      rotationY: 0,
      rotationZ: 0,
      rotationSpeed: 0,
      bounce: 0,
      alphaMultiplier: 1
    };
  }

  /** Partículas vivas en este momento. Expuesto sobre todo para tests. */
  get activeCount() {
    let count = 0;
    for (const particle of this.#pool) if (particle.active) count += 1;
    return count;
  }

  get poolSize() {
    return this.#pool.length;
  }

  /** Copias superficiales de las partículas activas, para inspección (tests, debug). */
  get activeParticles() {
    return this.#pool.filter((particle) => particle.active).map((particle) => ({ ...particle }));
  }

  /**
   * Genera entre MIN_COUNT y MAX_COUNT partículas en una posición, con el
   * color del bloque roto.
   * @param {{x:number,y:number,z:number}} position posición de mundo (centro del bloque)
   * @param {number[]} color RGB del bloque (textura o color de respaldo)
   */
  spawn(position, color, options = {}) {
    const minCount = options.minCount ?? this.config.MIN_COUNT;
    const maxCount = options.maxCount ?? this.config.MAX_COUNT;
    const lifetime = options.lifetime ?? this.config.LIFETIME_SECONDS;
    const initialSpeed = options.initialSpeed ?? this.config.INITIAL_SPEED;
    const count = minCount + Math.floor(Math.random() * (maxCount - minCount + 1));
    const face = options.face ?? null;
    const mode = options.mode ?? 'break';

    for (let index = 0; index < count; index += 1) {
      const particle = this.#nextSlot();
      const yaw = Math.random() * Math.PI * 2;
      const pitch = Math.random() * Math.PI * 0.5;
      const speed = initialSpeed * (0.5 + Math.random() * 0.5);

      particle.active = true;
      particle.x = position.x;
      particle.y = position.y;
      particle.z = position.z;
      particle.vx = Math.cos(yaw) * Math.cos(pitch) * speed + (face?.x ?? 0) * speed * 0.45;
      particle.vy = Math.sin(pitch) * speed + (face?.y ?? 0) * speed * 0.45;
      particle.vz = Math.sin(yaw) * Math.cos(pitch) * speed + (face?.z ?? 0) * speed * 0.45;
      particle.life = lifetime;
      particle.maxLife = lifetime;
      particle.color = color;
      particle.size = this.config.SIZE * (0.75 + Math.random() * 0.5);
      particle.rotationX = Math.random() * Math.PI;
      particle.rotationY = Math.random() * Math.PI;
      particle.rotationZ = Math.random() * Math.PI;
      particle.rotationSpeed = (Math.random() - 0.5) * (this.config.ROTATION_SPEED ?? 4);
      particle.bounce = mode === 'place' ? (this.config.PLACEMENT_BOUNCE ?? 0.25) : 0;
      particle.alphaMultiplier = color?.length > 3 ? color[3] / 255 : (options.alpha ?? 1);
    }
  }

  spawnPlacement(position, color, face = null, alpha = 1) {
    this.spawn(position, color, {
      mode: 'place',
      face,
      minCount: this.config.PLACED_MIN_COUNT ?? this.config.MIN_COUNT,
      maxCount: this.config.PLACED_MAX_COUNT ?? this.config.MAX_COUNT,
      lifetime: this.config.PLACED_LIFETIME ?? this.config.LIFETIME_SECONDS,
      initialSpeed: this.config.PLACED_INITIAL_SPEED ?? this.config.INITIAL_SPEED * 0.55,
      alpha
    });
  }

  reset() {
    for (const particle of this.#pool) particle.active = false;
    this.#cursor = 0;
  }

  /** Slot libre si hay uno; si el pool está lleno, el próximo en el anillo. */
  #nextSlot() {
    const free = this.#pool.find((particle) => !particle.active);
    if (free) return free;

    const slot = this.#pool[this.#cursor];
    this.#cursor = (this.#cursor + 1) % this.#pool.length;
    return slot;
  }

  update(deltaTime) {
    for (const particle of this.#pool) {
      if (!particle.active) continue;

      particle.life -= deltaTime;
      if (particle.life <= 0) {
        particle.active = false;
        continue;
      }

      particle.vy += this.config.GRAVITY * deltaTime;
      particle.x += particle.vx * deltaTime;
      particle.y += particle.vy * deltaTime;
      particle.z += particle.vz * deltaTime;
      particle.rotationX += particle.rotationSpeed * deltaTime;
      particle.rotationY += particle.rotationSpeed * 0.73 * deltaTime;
      particle.rotationZ += particle.rotationSpeed * 0.51 * deltaTime;
      if (particle.bounce > 0 && particle.y < 0) {
        particle.y = 0;
        particle.vy = Math.abs(particle.vy) * particle.bounce;
      }
    }
  }

  draw(p, _camera) {
    p.push();
    p.noStroke();

    for (const particle of this.#pool) {
      if (!particle.active) continue;

      const alpha = Math.round(255 * (particle.life / particle.maxLife));
      p.push();
      p.translate(particle.x, particle.y, particle.z);
      p.rotateX?.(particle.rotationX);
      p.rotateY?.(particle.rotationY);
      p.rotateZ?.(particle.rotationZ);
      p.fill(particle.color[0], particle.color[1], particle.color[2], alpha * particle.alphaMultiplier);
      p.ambientMaterial(particle.color[0], particle.color[1], particle.color[2]);
      p.box(particle.size);
      p.pop();
    }

    p.pop();
  }
}
