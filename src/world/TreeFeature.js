import { BlockIds } from '../utils/Constants.js';
import { GameConfig } from '../game/GameConfig.js';

/** Genera un arbol compacto de tronco vertical y copa redondeada. */
export class TreeFeature {
  static CANOPY_RADIUS = 2;

  constructor(config = GameConfig.world) {
    this.config = config;
  }

  canPlace(world, x, surfaceY, z, trunkHeight) {
    const radius = TreeFeature.CANOPY_RADIUS;
    return (
      x > radius &&
      z > radius &&
      x < world.width - radius - 1 &&
      z < world.depth - radius - 1 &&
      surfaceY >= 1 &&
      surfaceY + trunkHeight + radius < world.height
    );
  }

  place(world, x, surfaceY, z, trunkHeight) {
    if (!this.canPlace(world, x, surfaceY, z, trunkHeight)) return false;

    for (let y = surfaceY; y < surfaceY + trunkHeight; y += 1) {
      world.setBlockId(x, y, z, BlockIds.LOG);
    }

    const topY = surfaceY + trunkHeight;
    const radius = TreeFeature.CANOPY_RADIUS;
    for (let dx = -radius; dx <= radius; dx += 1) {
      for (let dz = -radius; dz <= radius; dz += 1) {
        for (let dy = -1; dy <= radius; dy += 1) {
          const distance = Math.abs(dx) + Math.abs(dz) + Math.max(0, dy - 1);
          if (distance > 3) continue;
          const leafX = x + dx;
          const leafY = topY + dy;
          const leafZ = z + dz;
          if (leafX === x && leafZ === z && leafY < topY + 1) continue;
          world.setBlockId(leafX, leafY, leafZ, BlockIds.LEAVES);
        }
      }
    }
    return true;
  }
}
