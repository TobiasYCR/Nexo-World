import { GameConfig } from '../game/GameConfig.js';
import { ChunkMeshBuilder } from './ChunkMeshBuilder.js';

/**
 * Dibuja los bloques del mundo. Es la ÚNICA clase que sabe cómo se ve un bloque.
 *
 * Cada chunk se convierte en una malla por tipo de bloque, con solo las caras
 * que dan a un bloque no opaco (ChunkMeshBuilder). La malla queda en la placa
 * de video y se reconstruye únicamente cuando el chunk cambia (Chunk.dirty),
 * en lugar de recorrer el mundo y emitir un box() por bloque en cada frame.
 *
 * Contrato con World: recorre world.chunks y consulta vecinos con getBlockId;
 * World no sabe nada de dibujado. La interfaz pública no cambió:
 * render(), renderedBlocks, renderDistance y setRenderDistance().
 */
export class BlockRenderer {
  static MIN_RENDER_DISTANCE = 1;
  static #nextGeometryId = 0;

  #renderedBlocks = 0;
  #drawnChunks = 0;
  #visibleFaces = 0;
  #drawCalls = 0;
  #meshRebuilds = 0;
  #renderDistance;
  #builder;
  /** clave de chunk -> { chunk, meshes: [{blockId, geometry}], visibleBlocks, minX, minZ, maxX, maxZ } */
  #meshes = new Map();
  /** Reutilizado entre frames: blockId -> geometrías visibles de ese tipo. */
  #byType = new Map();

  constructor(p, blockRegistry, textureManager, config = GameConfig) {
    this.p = p;
    this.blockRegistry = blockRegistry;
    this.textures = textureManager;
    this.blockSize = config.world.BLOCK_SIZE;
    this.#builder = new ChunkMeshBuilder(blockRegistry, this.blockSize);
    this.setRenderDistance(config.rendering.RENDER_DISTANCE);
  }

  /** Bloques con al menos una cara visible en los chunks dibujados el último frame. */
  get renderedBlocks() {
    return this.#renderedBlocks;
  }

  /** Chunks dibujados el último frame. */
  get drawnChunks() {
    return this.#drawnChunks;
  }

  /** Caras dibujadas el último frame. */
  get visibleFaces() {
    return this.#visibleFaces;
  }

  /** Llamadas a model() del último frame: una por chunk y tipo de bloque. */
  get drawCalls() {
    return this.#drawCalls;
  }

  /** Chunks con malla que quedaron fuera de la distancia de render el último frame. */
  get culledChunks() {
    return this.#meshes.size - this.#drawnChunks;
  }

  /** Mallas de chunk armadas desde que arrancó el juego. */
  get meshRebuilds() {
    return this.#meshRebuilds;
  }

  /** Chunks con malla armada. */
  get meshedChunks() {
    return this.#meshes.size;
  }

  /** Radio de dibujado en bloques. */
  get renderDistance() {
    return this.#renderDistance;
  }

  /**
   * Ajustable en caliente (pantalla de Configuración): rige desde el próximo frame.
   * @param {number} blocks radio en bloques; se redondea y se acota a >= 1
   * @returns {number} el valor efectivo aplicado
   */
  setRenderDistance(blocks) {
    if (Number.isFinite(blocks)) {
      this.#renderDistance = Math.max(BlockRenderer.MIN_RENDER_DISTANCE, Math.round(blocks));
    }
    return this.#renderDistance;
  }

  /**
   * @param {import('../world/World.js').World} world
   * @param {{x:number,y:number,z:number}} viewerPosition posición en coordenadas de mundo
   */
  render(world, viewerPosition) {
    this.#syncMeshes(world);
    this.#draw(viewerPosition);
  }

  /** Libera las mallas de la placa de video (al descartar el renderer). */
  dispose() {
    for (const entry of this.#meshes.values()) this.#release(entry);
    this.#meshes.clear();
  }

  /**
   * Arma las mallas de los chunks nuevos o modificados y libera las de chunks
   * que ya no existen (por ejemplo, al cargar otra partida).
   */
  #syncMeshes(world) {
    const alive = new Set();
    for (const chunk of world.chunks) {
      alive.add(chunk.key);
      const cached = this.#meshes.get(chunk.key);
      if (cached && cached.chunk === chunk && !chunk.isDirty) continue;
      if (cached) this.#release(cached);
      this.#meshes.set(chunk.key, this.#buildEntry(world, chunk));
      chunk.markClean();
    }
    for (const [key, entry] of this.#meshes) {
      if (alive.has(key)) continue;
      this.#release(entry);
      this.#meshes.delete(key);
    }
  }

  #buildEntry(world, chunk) {
    const { groups, visibleBlocks, faceCount } = this.#builder.build(world, chunk);
    this.#meshRebuilds += 1;
    const meshes = [];
    for (const [blockId, group] of groups) {
      BlockRenderer.#nextGeometryId += 1;
      const gid = `nexo-chunk-${chunk.key}-${blockId}-${BlockRenderer.#nextGeometryId}`;
      meshes.push({ blockId, geometry: this.#toGeometry(group, gid) });
    }
    return {
      chunk,
      meshes,
      visibleBlocks,
      faceCount,
      minX: chunk.chunkX * chunk.sizeX,
      minZ: chunk.chunkZ * chunk.sizeZ,
      maxX: (chunk.chunkX + 1) * chunk.sizeX,
      maxZ: (chunk.chunkZ + 1) * chunk.sizeZ
    };
  }

  /**
   * Recorte por chunk: se dibuja si el punto más cercano del chunk está dentro
   * del radio. Después se agrupa por tipo para cambiar de material una sola vez
   * por tipo en todo el frame.
   */
  #draw(viewerPosition) {
    const viewerX = viewerPosition.x / this.blockSize;
    const viewerZ = viewerPosition.z / this.blockSize;
    const maxDistanceSq = this.#renderDistance * this.#renderDistance;

    for (const list of this.#byType.values()) list.length = 0;
    let rendered = 0;
    let drawn = 0;
    let faces = 0;
    let calls = 0;
    for (const entry of this.#meshes.values()) {
      const dx = Math.max(entry.minX - viewerX, 0, viewerX - entry.maxX);
      const dz = Math.max(entry.minZ - viewerZ, 0, viewerZ - entry.maxZ);
      if (dx * dx + dz * dz > maxDistanceSq) continue;
      for (const { blockId, geometry } of entry.meshes) {
        let list = this.#byType.get(blockId);
        if (!list) {
          list = [];
          this.#byType.set(blockId, list);
        }
        list.push(geometry);
      }
      rendered += entry.visibleBlocks;
      faces += entry.faceCount;
      calls += entry.meshes.length;
      drawn += 1;
    }
    this.#renderedBlocks = rendered;
    this.#drawnChunks = drawn;
    this.#visibleFaces = faces;
    this.#drawCalls = calls;

    const p = this.p;
    p.push();
    p.noStroke();
    for (const [blockId, geometries] of this.#byType) {
      if (geometries.length === 0) continue;
      p.push();
      this.#applyMaterial(this.blockRegistry.get(blockId));
      for (const geometry of geometries) p.model(geometry);
      p.pop();
    }
    p.pop();
  }

  /**
   * Convierte el grupo en p5.Geometry. En los tests (sin p5 real) usa un objeto
   * con la misma forma.
   */
  #toGeometry(group, gid) {
    const GeometryClass = this.p.constructor?.Geometry;
    const geometry = typeof GeometryClass === 'function'
      ? new GeometryClass(1, 1)
      : { vertices: [], vertexNormals: [], uvs: [], faces: [], edges: [], vertexColors: [], _edgesToVertices() {} };
    geometry.gid = gid;

    const { positions, normals, uvs, indices } = group;
    for (let index = 0; index < positions.length; index += 3) {
      geometry.vertices.push({ x: positions[index], y: positions[index + 1], z: positions[index + 2] });
      geometry.vertexNormals.push({ x: normals[index], y: normals[index + 1], z: normals[index + 2] });
    }
    for (const value of uvs) geometry.uvs.push(value);
    for (let index = 0; index < indices.length; index += 3) {
      geometry.faces.push([indices[index], indices[index + 1], indices[index + 2]]);
    }
    return geometry;
  }

  #release(entry) {
    for (const { geometry } of entry.meshes) this.p.freeGeometry?.(geometry);
  }

  #applyMaterial(blockType) {
    const texture = blockType.texture ? this.textures.get(blockType.texture) : null;
    if (texture) {
      this.p.texture(texture);
    } else {
      // fill es el color difuso en WEBGL: sin él la luz direccional lava el color a blanco.
      this.p.fill(...blockType.color);
      this.p.ambientMaterial(...blockType.color);
    }
  }
}
