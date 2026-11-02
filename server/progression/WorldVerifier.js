import { World } from '../../src/world/World.js';
import { WorldGenerator } from '../../src/world/WorldGenerator.js';
import { NaturalTerrain } from '../../src/world/NaturalTerrain.js';
import { createDefaultBlockRegistry } from '../../src/blocks/BlockRegistry.js';
import { GameConfig } from '../../src/game/GameConfig.js';
import { WorldKey } from '../../src/progression/WorldKey.js';

/**
 * Regenera en el servidor el mundo que identifica una clave, con el mismo
 * código que usa el juego. Como la generación es determinista, obtiene el
 * mismo NaturalTerrain que el cliente y puede verificar lo que éste informa.
 * Guarda los últimos mundos usados (generar uno de 128x128x48 lleva ~60 ms).
 */
export class WorldVerifier {
  #cache = new Map();

  /**
   * @param {{maxWidth:number, maxHeight:number, maxDepth:number, cacheSize:number}} limits
   * @param {object} [gameConfig] GameConfig compartido con el cliente
   */
  constructor(limits, gameConfig = GameConfig) {
    this.limits = limits;
    this.gameConfig = gameConfig;
  }

  /** @returns {NaturalTerrain|null} null si la clave no es válida o no es de esta versión del generador */
  terrainFor(worldKey) {
    if (this.#cache.has(worldKey)) {
      const terrain = this.#cache.get(worldKey);
      // Reinsertar mueve la clave al final: el Map queda ordenado por uso reciente.
      this.#cache.delete(worldKey);
      this.#cache.set(worldKey, terrain);
      return terrain;
    }

    const parsed = WorldKey.parse(worldKey);
    if (!parsed || !this.#isSupported(parsed)) return null;

    const config = {
      ...this.gameConfig,
      world: { ...this.gameConfig.world, WORLD_WIDTH: parsed.width, WORLD_HEIGHT: parsed.height, WORLD_DEPTH: parsed.depth }
    };
    const world = new World(createDefaultBlockRegistry(), config);
    const generator = new WorldGenerator(config, { seed: parsed.seed });
    generator.generate(world);
    const terrain = NaturalTerrain.fromGeneration(world, generator);

    this.#cache.set(worldKey, terrain);
    while (this.#cache.size > this.limits.cacheSize) this.#cache.delete(this.#cache.keys().next().value);
    return terrain;
  }

  #isSupported({ version, width, height, depth }) {
    return (
      version === WorldGenerator.VERSION &&
      width > 0 && height > 0 && depth > 0 &&
      width <= this.limits.maxWidth && height <= this.limits.maxHeight && depth <= this.limits.maxDepth
    );
  }
}
