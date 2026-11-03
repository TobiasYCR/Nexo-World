import { GameConfig } from '../game/GameConfig.js';

const FACES = Object.freeze([
  { dx: -1, dy: 0, dz: 0, corners: [0, 4, 2, 6] },
  { dx: 1, dy: 0, dz: 0, corners: [1, 3, 5, 7] },
  { dx: 0, dy: -1, dz: 0, corners: [0, 1, 4, 5] },
  { dx: 0, dy: 1, dz: 0, corners: [2, 6, 3, 7] },
  { dx: 0, dy: 0, dz: -1, corners: [0, 2, 1, 3] },
  { dx: 0, dy: 0, dz: 1, corners: [4, 5, 6, 7] }
]);

/**
 * Overlay cacheado de un plano. Rehace sus geometrías solo cuando recibe un
 * snapshot diferente; el pulso del próximo bloque se calcula al dibujar y no
 * genera objetos ni mallas nuevas por frame.
 */
export class BlueprintGhost {
  #snapshot = null;
  #signature = '';
  #groups = [];
  #elapsed = 0;
  #buildCount = 0;

  constructor({ p = null, blockRegistry, blockSize = GameConfig.world.BLOCK_SIZE, config = GameConfig.education } = {}) {
    this.p = p;
    this.blockRegistry = blockRegistry;
    this.blockSize = blockSize;
    this.config = config;
    this.visible = config.SHOW_BLUEPRINT_GHOST;
  }

  update(snapshot) {
    this.#snapshot = snapshot ?? null;
    const signature = BlueprintGhost.#signatureOf(snapshot);
    if (signature === this.#signature) return false;
    this.#signature = signature;
    this.#rebuild();
    return true;
  }

  clear() {
    return this.update(null);
  }

  advance(deltaTime) {
    this.#elapsed += Math.max(0, deltaTime);
  }

  setVisible(visible) {
    this.visible = Boolean(visible);
  }

  get buildCount() {
    return this.#buildCount;
  }

  get geometryCount() {
    return this.#groups.length;
  }

  draw(p = this.p, _camera) {
    if (!this.visible || !this.#snapshot || !p?.push) return;

    const nextPosition = this.#snapshot.nextBlock?.position;
    p.push();
    p.noStroke?.();
    for (const group of this.#groups) {
      const isNext = group.status === 'missing' && nextPosition && group.positionKeys.has(BlueprintGhost.#positionKey(nextPosition));
      const pulse = isNext
        ? 0.72 + Math.sin(this.#elapsed * this.config.NEXT_BLOCK_PULSE_SPEED) * 0.2
        : 1;
      const color = group.status === 'wrong'
        ? this.config.WRONG_BLOCK_COLOR
        : [...this.blockRegistry.get(group.blockId).color, Math.round(this.config.GHOST_OPACITY * 255 * pulse)];
      const alpha = color[3] ?? 255;
      p.fill?.(color[0], color[1], color[2], alpha);
      p.ambientMaterial?.(color[0], color[1], color[2], alpha);
      if (typeof p.model === 'function') {
        p.model(group.geometry);
      }
    }
    p.pop();
  }

  dispose() {
    for (const group of this.#groups) this.p?.freeGeometry?.(group.geometry);
    this.#groups = [];
    this.#snapshot = null;
    this.#signature = '';
  }

  #rebuild() {
    for (const group of this.#groups) this.p?.freeGeometry?.(group.geometry);
    this.#groups = [];
    this.#buildCount += 1;
    if (!this.#snapshot) return;

    const blocks = this.#snapshot.blocks ?? [];
    const occupied = new Set(blocks.map((block) => BlueprintGhost.#positionKey(block)));
    const grouped = new Map();
    for (const block of blocks) {
      if (block.status === 'correct') continue;
      const key = `${block.status}:${block.expectedBlockId}`;
      let group = grouped.get(key);
      if (!group) {
        group = {
          blockId: block.expectedBlockId,
          status: block.status,
          positionKeys: new Set(),
          positions: [],
          normals: [],
          uvs: [],
          indices: []
        };
        grouped.set(key, group);
      }
      this.#pushBlock(group, block, occupied);
    }

    for (const group of grouped.values()) {
      this.#groups.push({
        ...group,
        geometry: this.#toGeometry(group)
      });
    }
  }

  #pushBlock(group, block, occupied) {
    const { x, y, z } = block;
    group.positionKeys.add(BlueprintGhost.#positionKey(block));
    for (const face of FACES) {
      if (occupied.has(`${x + face.dx},${y + face.dy},${z + face.dz}`)) continue;
      const first = group.positions.length / 3;
      for (let index = 0; index < 4; index += 1) {
        const corner = face.corners[index];
        group.positions.push(
          (x + (corner & 1)) * this.blockSize,
          (y + ((corner >> 1) & 1)) * this.blockSize,
          (z + ((corner >> 2) & 1)) * this.blockSize
        );
        group.normals.push(face.dx, face.dy, face.dz);
        group.uvs.push(index & 1, (index & 2) / 2);
      }
      group.indices.push(first, first + 1, first + 2, first + 2, first + 1, first + 3);
    }
  }

  #toGeometry(group) {
    const GeometryClass = this.p?.constructor?.Geometry;
    const geometry = typeof GeometryClass === 'function'
      ? new GeometryClass(1, 1)
      : { vertices: [], vertexNormals: [], uvs: [], faces: [], edges: [], vertexColors: [], _edgesToVertices() {} };
    geometry.gid = `nexo-blueprint-${this.#buildCount}-${group.status}-${group.blockId}`;
    for (let index = 0; index < group.positions.length; index += 3) {
      geometry.vertices.push({
        x: group.positions[index],
        y: group.positions[index + 1],
        z: group.positions[index + 2]
      });
      geometry.vertexNormals.push({
        x: group.normals[index],
        y: group.normals[index + 1],
        z: group.normals[index + 2]
      });
    }
    for (const value of group.uvs) geometry.uvs.push(value);
    for (let index = 0; index < group.indices.length; index += 3) {
      geometry.faces.push([group.indices[index], group.indices[index + 1], group.indices[index + 2]]);
    }
    return geometry;
  }

  static #positionKey(block) {
    return `${block.x},${block.y},${block.z}`;
  }

  static #signatureOf(snapshot) {
    if (!snapshot) return 'empty';
    return [
      snapshot.blueprintId,
      ...(snapshot.blocks ?? []).map((block) => [
        block.x,
        block.y,
        block.z,
        block.expectedBlockId,
        block.status
      ].join(':'))
    ].join('|');
  }
}
