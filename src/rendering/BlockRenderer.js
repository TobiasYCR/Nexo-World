import { GameConfig } from '../game/GameConfig.js';
import { ChunkMeshBuilder } from './ChunkMeshBuilder.js';
import { ViewFrustum } from './ViewFrustum.js';
import { BlockIds } from '../utils/Constants.js';

/**
 * Dibuja los bloques del mundo. Es la ÚNICA clase que sabe cómo se ve un bloque.
 *
 * Cada chunk se convierte en una malla por tipo de bloque, con solo las caras
 * que dan a un bloque no opaco (ChunkMeshBuilder). La malla queda en la placa
 * de video y se reconstruye únicamente cuando el chunk cambia (Chunk.dirty),
 * en lugar de recorrer el mundo y emitir un box() por bloque en cada frame.
 *
 * Las mallas se arman solo para los chunks dentro de la distancia de render
 * (unas pocas por frame, las más cercanas primero) y se liberan cuando quedan
 * lejos. Además de la distancia, se descartan los chunks que quedan fuera del
 * cono de visión (frustum culling) y las caras vecinas iguales se unen en
 * rectángulos (greedy meshing). Las dos cosas se pueden apagar desde Configuración.
 *
 * Contrato con World: recorre world.chunks y consulta vecinos con getBlockId;
 * World no sabe nada de dibujado.
 */
export class BlockRenderer {
  static MIN_RENDER_DISTANCE = 1;
  static #nextGeometryId = 0;

  #renderedBlocks = 0;
  #drawnChunks = 0;
  #visibleFaces = 0;
  #drawCalls = 0;
  #meshRebuilds = 0;
  #culledChunks = 0;
  #renderDistance;
  #builder;
  #frustum = new ViewFrustum();
  #frustumCulling = true;
  #greedyMeshing = true;
  #buildsPerFrame;
  #buildBudgetMs;
  #releaseMargin;
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
    this.#buildsPerFrame = config.rendering.MESH_BUILDS_PER_FRAME ?? 8;
    this.#buildBudgetMs = config.rendering.MESH_BUILD_BUDGET_MS ?? Infinity;
    this.#releaseMargin = config.rendering.MESH_RELEASE_MARGIN ?? 16;
    this.#frustumCulling = config.rendering.FRUSTUM_CULLING ?? true;
    this.#greedyMeshing = config.rendering.GREEDY_MESHING ?? true;
    this.cameraConfig = config.camera;
    this.setRenderDistance(config.rendering.RENDER_DISTANCE);
  }

  get frustumCulling() {
    return this.#frustumCulling;
  }

  setFrustumCulling(enabled) {
    this.#frustumCulling = Boolean(enabled);
  }

  get greedyMeshing() {
    return this.#greedyMeshing;
  }

  /** Cambiar el modo rehace todas las mallas en los frames siguientes. */
  setGreedyMeshing(enabled) {
    const next = Boolean(enabled);
    if (next === this.#greedyMeshing) return;
    this.#greedyMeshing = next;
    this.dispose();
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

  /** Chunks del mundo que no se dibujaron el último frame (lejos o fuera de la vista). */
  get culledChunks() {
    return this.#culledChunks;
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
   * @param {object|null} [camera] FirstPersonCamera; sin ella no hay frustum culling
   */
  render(world, viewerPosition, camera = null) {
    this.#syncMeshes(world, viewerPosition);
    this.#draw(world, viewerPosition, camera);
  }

  /** Libera las mallas de la placa de video (al descartar el renderer). */
  dispose() {
    for (const entry of this.#meshes.values()) this.#release(entry);
    this.#meshes.clear();
  }

  /**
   * Arma las mallas que faltan o están viejas dentro de la distancia de render
   * (de la más cercana a la más lejana, hasta MESH_BUILDS_PER_FRAME por frame y
   * mientras no se pase MESH_BUILD_BUDGET_MS: armar ocho de golpe trababa el
   * juego al caminar; siempre se arma al menos una, así un bloque colocado se
   * ve en el mismo frame)
   * y libera las de chunks lejanos o que ya no existen.
   */
  #syncMeshes(world, viewerPosition) {
    const viewerX = viewerPosition.x / this.blockSize;
    const viewerZ = viewerPosition.z / this.blockSize;
    const keep = this.#renderDistance + this.#releaseMargin;
    const alive = new Set();
    const pending = [];

    for (const chunk of world.chunks) {
      alive.add(chunk.key);
      const distance = BlockRenderer.#distanceToChunk(chunk, viewerX, viewerZ);
      const cached = this.#meshes.get(chunk.key);
      const stale = cached && (cached.chunk !== chunk || chunk.isDirty);
      if (distance > keep) {
        // Lejos: se libera; si cambió, queda sucio y se rehace al acercarse.
        if (cached) {
          this.#release(cached);
          this.#meshes.delete(chunk.key);
        }
        continue;
      }
      if (stale && distance > this.#renderDistance) {
        this.#release(cached);
        this.#meshes.delete(chunk.key);
        continue;
      }
      if ((!cached || stale) && distance <= this.#renderDistance) pending.push({ chunk, distance });
    }

    pending.sort((first, second) => first.distance - second.distance);
    const startedAt = performance.now();
    for (const { chunk } of pending.slice(0, this.#buildsPerFrame)) {
      const cached = this.#meshes.get(chunk.key);
      if (cached) this.#release(cached);
      this.#meshes.set(chunk.key, this.#buildEntry(world, chunk));
      chunk.markClean();
      if (performance.now() - startedAt >= this.#buildBudgetMs) break;
    }

    for (const [key, entry] of this.#meshes) {
      if (alive.has(key)) continue;
      this.#release(entry);
      this.#meshes.delete(key);
    }
  }

  /** Distancia horizontal, en bloques, del punto al borde más cercano del chunk. */
  static #distanceToChunk(chunk, viewerX, viewerZ) {
    const minX = chunk.chunkX * chunk.sizeX;
    const minZ = chunk.chunkZ * chunk.sizeZ;
    const dx = Math.max(minX - viewerX, 0, viewerX - (minX + chunk.sizeX));
    const dz = Math.max(minZ - viewerZ, 0, viewerZ - (minZ + chunk.sizeZ));
    return Math.hypot(dx, dz);
  }

  #buildEntry(world, chunk) {
    const { groups, visibleBlocks, faceCount } = this.#builder.build(world, chunk, { greedy: this.#greedyMeshing });
    this.#meshRebuilds += 1;
    const meshes = [];
    for (const [blockId, group] of groups) {
      const blockType = this.blockRegistry.get(blockId);
      const isMulti = blockId === BlockIds.LOG && blockType.textures && (
        blockType.textures.top !== blockType.textures.side ||
        blockType.textures.bottom !== blockType.textures.side
      );

      if (!isMulti || group.faceCount === 0) {
        BlockRenderer.#nextGeometryId += 1;
        const gid = `nexo-chunk-${chunk.key}-${blockId}-${BlockRenderer.#nextGeometryId}`;
        meshes.push({ blockId, textureName: blockType.texture, geometry: this.#toGeometry(group, gid) });
      } else {
        const subGroups = BlockRenderer.#splitGroupByTexture(group, blockType);
        for (const [textureName, subGroup] of subGroups) {
          if (subGroup.positions.length === 0) continue;
          BlockRenderer.#nextGeometryId += 1;
          const gid = `nexo-chunk-${chunk.key}-${blockId}-${textureName}-${BlockRenderer.#nextGeometryId}`;
          meshes.push({ blockId, textureName, geometry: this.#toGeometry(subGroup, gid) });
        }
      }
    }
    return {
      chunk,
      meshes,
      visibleBlocks,
      faceCount,
      minX: chunk.chunkX * chunk.sizeX,
      minZ: chunk.chunkZ * chunk.sizeZ,
      maxX: (chunk.chunkX + 1) * chunk.sizeX,
      maxZ: (chunk.chunkZ + 1) * chunk.sizeZ,
      height: chunk.height
    };
  }

  static #splitGroupByTexture(group, blockType) {
    const topTex = blockType.textures?.top ?? blockType.texture;
    const bottomTex = blockType.textures?.bottom ?? blockType.texture;
    const sideTex = blockType.textures?.side ?? blockType.texture;

    const subGroups = new Map();
    const getSubGroup = (tex) => {
      let sub = subGroups.get(tex);
      if (!sub) {
        sub = { positions: [], normals: [], uvs: [], indices: [] };
        subGroups.set(tex, sub);
      }
      return sub;
    };

    const quadCount = group.faceCount;
    for (let q = 0; q < quadCount; q += 1) {
      const ny = group.normals[q * 12 + 1];
      let texName = sideTex;
      if (ny > 0) {
        texName = topTex;
      } else if (ny < 0) {
        texName = bottomTex;
      }

      const sub = getSubGroup(texName);
      const first = sub.positions.length / 3;

      for (let i = 0; i < 12; i += 1) {
        sub.positions.push(group.positions[q * 12 + i]);
        sub.normals.push(group.normals[q * 12 + i]);
      }
      for (let i = 0; i < 8; i += 1) {
        sub.uvs.push(group.uvs[q * 8 + i]);
      }
      sub.indices.push(first, first + 1, first + 2, first + 2, first + 1, first + 3);
    }

    return subGroups;
  }

  /**
   * Recorte por chunk: se dibuja si el punto más cercano del chunk está dentro
   * del radio y, con frustum culling, si su caja toca el cono de visión.
   * Después se agrupa por tipo para cambiar de material una sola vez por tipo
   * en todo el frame.
   */
  #draw(world, viewerPosition, camera) {
    const viewerX = viewerPosition.x / this.blockSize;
    const viewerZ = viewerPosition.z / this.blockSize;
    const maxDistanceSq = this.#renderDistance * this.#renderDistance;
    const frustum = this.#frustumCulling && camera ? this.#updateFrustum(camera) : null;
    const size = this.blockSize;

    for (const list of this.#byType.values()) list.length = 0;
    let rendered = 0;
    let drawn = 0;
    let faces = 0;
    let calls = 0;
    for (const entry of this.#meshes.values()) {
      const dx = Math.max(entry.minX - viewerX, 0, viewerX - entry.maxX);
      const dz = Math.max(entry.minZ - viewerZ, 0, viewerZ - entry.maxZ);
      if (dx * dx + dz * dz > maxDistanceSq) continue;
      if (frustum && !frustum.intersectsBox(
        entry.minX * size, 0, entry.minZ * size,
        entry.maxX * size, entry.height * size, entry.maxZ * size,
        size
      )) continue;
      for (const { blockId, textureName, geometry } of entry.meshes) {
        const key = textureName ? `${blockId}:${textureName}` : String(blockId);
        let list = this.#byType.get(key);
        if (!list) {
          list = [];
          this.#byType.set(key, list);
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
    this.#culledChunks = Math.max(0, world.chunkCount - drawn);

    const p = this.p;
    p.push();
    p.noStroke();
    // Las caras unidas usan coordenadas de textura mayores a 1: la textura se repite.
    if (this.#greedyMeshing && p.REPEAT !== undefined) p.textureWrap?.(p.REPEAT);
    for (const [key, geometries] of this.#byType) {
      if (geometries.length === 0) continue;
      const colon = key.indexOf(':');
      const blockId = Number(colon >= 0 ? key.slice(0, colon) : key);
      const textureName = colon >= 0 ? key.slice(colon + 1) : null;
      p.push();
      this.#applyMaterial(this.blockRegistry.get(blockId), textureName);
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

  #updateFrustum(camera) {
    const p = this.p;
    const aspect = p.width > 0 && p.height > 0 ? p.width / p.height : 16 / 9;
    return this.#frustum.update(
      camera.position,
      camera.lookDirection,
      camera.right,
      camera.fov ?? this.cameraConfig?.FOV_DEGREES ?? 70,
      aspect,
      this.cameraConfig?.NEAR_PLANE ?? 1,
      this.cameraConfig?.FAR_PLANE ?? 4000
    );
  }

  #release(entry) {
    for (const { geometry } of entry.meshes) this.p.freeGeometry?.(geometry);
  }

  #applyMaterial(blockType, textureName = null) {
    const effectiveTextureName = textureName || blockType.texture;
    const texture = effectiveTextureName ? this.textures.get(effectiveTextureName) : null;
    if (texture) {
      this.p.texture(texture);
    } else {
      // fill es el color difuso en WEBGL: sin él la luz direccional lava el color a blanco.
      this.p.fill(...blockType.color);
      this.p.ambientMaterial(...blockType.color);
    }
  }
}
