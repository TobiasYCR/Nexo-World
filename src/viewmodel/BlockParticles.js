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
    return { active: false, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, life: 0, maxLife: 0, color: [255, 255, 255] };
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
  spawn(position, color) {
    const { MIN_COUNT, MAX_COUNT, INITIAL_SPEED, LIFETIME_SECONDS } = this.config;
    const count = MIN_COUNT + Math.floor(Math.random() * (MAX_COUNT - MIN_COUNT + 1));

    for (let index = 0; index < count; index += 1) {
      const particle = this.#nextSlot();
      const yaw = Math.random() * Math.PI * 2;
      const pitch = Math.random() * Math.PI * 0.5;
      const speed = INITIAL_SPEED * (0.5 + Math.random() * 0.5);

      particle.active = true;
      particle.x = position.x;
      particle.y = position.y;
      particle.z = position.z;
      particle.vx = Math.cos(yaw) * Math.cos(pitch) * speed;
      particle.vy = Math.sin(pitch) * speed;
      particle.vz = Math.sin(yaw) * Math.cos(pitch) * speed;
      particle.life = LIFETIME_SECONDS;
      particle.maxLife = LIFETIME_SECONDS;
      particle.color = color;
    }
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
      p.fill(particle.color[0], particle.color[1], particle.color[2], alpha);
      p.ambientMaterial(particle.color[0], particle.color[1], particle.color[2]);
      p.box(this.config.SIZE);
      p.pop();
    }

    p.pop();
  }
}
