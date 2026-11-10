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
  #heldBlockId = null;

  /**
   * @param {Object} options
   * @param {{get(name:string): any}|null} [options.textureManager] texturas de los
   *   bloques: la guía usa la del bloque esperado, así un tablón y un tronco se
   *   distinguen a simple vista y no solo por un color parecido
   */
  constructor({ p = null, blockRegistry, textureManager = null, blockSize = GameConfig.world.BLOCK_SIZE, config = GameConfig.education } = {}) {
    this.p = p;
    this.blockRegistry = blockRegistry;
    this.textureManager = textureManager;
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

  /**
   * Bloque que el jugador tiene en la mano. Las celdas del plano que esperan
   * ese bloque se iluminan y se marcan con borde; las demás se atenúan. Así se
   * ve de un vistazo dónde va lo que se está por colocar.
   * @param {number|null} blockId
   */
  setHeldBlock(blockId) {
    this.#heldBlockId = Number.isInteger(blockId) ? blockId : null;
  }

  get heldBlockId() {
    return this.#heldBlockId;
  }

  draw(p = this.p, _camera) {
    if (!this.visible || !this.#snapshot || !p?.push) return;

    const config = this.config;
    const held = this.#heldBlockId;
    const holdingPlanBlock = held !== null &&
      this.#groups.some((group) => group.status === 'missing' && group.blockId === held);
    const pulse = 0.75 + Math.sin(this.#elapsed * config.NEXT_BLOCK_PULSE_SPEED) * 0.25;

    p.push();
    for (const group of this.#groups) {
      if (group.status === 'wrong') {
        const [r, g, b, a] = config.WRONG_BLOCK_COLOR;
        this.#paint(p, null, [r, g, b], a, null);
        p.stroke?.(r, g, b, 255);
        p.strokeWeight?.(config.HIGHLIGHT_STROKE_WEIGHT);
        // Una celda incorrecta puede estar rodeada por otras celdas del plano.
        // Dibujar una caja evita mallas vacías y deja el rojo fuera del bloque real.
        for (const block of group.blocks) {
          p.push();
          p.translate?.((block.x + 0.5) * this.blockSize, (block.y + 0.5) * this.blockSize, (block.z + 0.5) * this.blockSize);
          p.box?.(this.blockSize * 1.02);
          p.pop();
        }
        continue;
      }

      const base = this.blockRegistry.get(group.blockId).color;
      const matches = holdingPlanBlock && group.blockId === held;
      if (matches) {
        // Más claro, con brillo propio (no depende de la luz) y borde por bloque.
        const light = base.map((channel) => Math.round(channel + (255 - channel) * 0.25));
        this.#paint(p, group.blockId, light, Math.round(config.HELD_OPACITY * 255 * pulse), light.map((channel) => channel * 0.35));
        const [sr, sg, sb] = config.HIGHLIGHT_STROKE_COLOR;
        p.stroke?.(sr, sg, sb, Math.round(255 * pulse));
        p.strokeWeight?.(config.HIGHLIGHT_STROKE_WEIGHT);
      } else {
        const opacity = holdingPlanBlock ? config.DIM_OPACITY : config.GHOST_OPACITY;
        this.#paint(p, group.blockId, base, Math.round(opacity * 255), null);
        p.noStroke?.();
      }
      p.model?.(group.geometry);
    }
    this.#drawNextOutline(p, pulse);
    p.pop();
  }

  /** Textura del bloque con transparencia; sin textura, su color. */
  #paint(p, blockId, [r, g, b], alpha, emissive) {
    const type = blockId === null ? null : this.blockRegistry.get(blockId);
    const texture = type?.texture ? this.textureManager?.get?.(type.texture) : null;
    if (texture && typeof p.texture === 'function') {
      p.tint?.(255, 255, 255, alpha);
      p.texture(texture);
    } else {
      // En p5 1.x noTint() deja _tint en null, pero el shader WebGL
      // espera un vector RGBA incluso al dibujar sin textura.
      p.tint?.(255, 255, 255, 255);
      p.fill?.(r, g, b, alpha);
      p.ambientMaterial?.(r, g, b, alpha);
    }
    if (emissive) p.emissiveMaterial?.(...emissive);
    else p.emissiveMaterial?.(0, 0, 0);
  }

  /** Marco grueso y titilante alrededor del próximo bloque que pide el plano. */
  #drawNextOutline(p, pulse) {
    const position = this.#snapshot.nextBlock?.position;
    if (!position || typeof p.box !== 'function') return;
    const size = this.blockSize;
    const [r, g, b] = this.config.NEXT_BLOCK_OUTLINE_COLOR;
    p.push();
    p.translate?.((position.x + 0.5) * size, (position.y + 0.5) * size, (position.z + 0.5) * size);
    p.noFill?.();
    p.stroke?.(r, g, b, Math.round(255 * pulse));
    p.strokeWeight?.(this.config.NEXT_BLOCK_OUTLINE_WEIGHT);
    p.box(size * 1.04);
    p.pop();
  }

  dispose() {
    for (const group of this.#groups) if (group.geometry) this.p?.freeGeometry?.(group.geometry);
    this.#groups = [];
    this.#snapshot = null;
    this.#signature = '';
  }

  #rebuild() {
    for (const group of this.#groups) if (group.geometry) this.p?.freeGeometry?.(group.geometry);
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
          blocks: [],
          positionKeys: new Set(),
          positions: [],
          normals: [],
          uvs: [],
          indices: [],
          edges: []
        };
        grouped.set(key, group);
      }
      if (block.status === 'wrong') group.blocks.push(block);
      else this.#pushBlock(group, block, occupied);
    }

    for (const group of grouped.values()) {
      if (group.status !== 'wrong' && group.positions.length === 0) continue;
      this.#groups.push({
        ...group,
        geometry: group.status === 'wrong' ? null : this.#toGeometry(group)
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
        // Igual que las mallas del mundo: textura derecha en las cuatro paredes.
        const bits = [corner & 1, (corner >> 1) & 1, (corner >> 2) & 1];
        if (face.dy !== 0) group.uvs.push(bits[0], bits[2]);
        else group.uvs.push(bits[face.dx !== 0 ? 2 : 0], 1 - bits[1]);
      }
      group.indices.push(first, first + 1, first + 2, first + 2, first + 1, first + 3);
      // Contorno del cuadrado, sin la diagonal de los triángulos.
      group.edges.push([first, first + 1], [first + 1, first + 3], [first + 3, first + 2], [first + 2, first]);
    }
  }

  #toGeometry(group) {
    const GeometryClass = this.p?.constructor?.Geometry;
    const geometry = typeof GeometryClass === 'function'
      ? new GeometryClass(1, 1)
      : { vertices: [], vertexNormals: [], uvs: [], faces: [], edges: [], vertexColors: [], _edgesToVertices() {} };
    geometry.gid = `nexo-blueprint-${this.#buildCount}-${group.status}-${group.blockId}`;
    // Los bordes de p5 copian los vértices: tienen que ser p5.Vector, no objetos sueltos.
    const vector = typeof this.p?.createVector === 'function'
      ? (x, y, z) => this.p.createVector(x, y, z)
      : (x, y, z) => ({ x, y, z });
    for (let index = 0; index < group.positions.length; index += 3) {
      geometry.vertices.push(vector(group.positions[index], group.positions[index + 1], group.positions[index + 2]));
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
    geometry.edges = group.edges.map((edge) => [...edge]);
    geometry._edgesToVertices?.();
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
