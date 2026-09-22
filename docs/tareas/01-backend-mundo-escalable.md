# Tarea — Backend 1: Mundo escalable con mallas por chunk

**Proyecto:** Nexo World
**Rol:** Backend 1 (render por chunk, tamaño del mundo y guardado)
**Rama sugerida:** `feat/chunk-meshes`
**Punto de partida:** commit `536bcfd` en `main`

---

## 1. Objetivo

Que el mapa pueda crecer a 128×128×48 sin que el juego se arrastre. Hoy cada bloque visible es un `box()` (unos 2.600 draw calls con el mundo de 32×32) y el culling recorre todos los bloques sólidos cada frame: con 128×128 y distancia 64, solo el culling cuesta 39 ms por frame.

---

## 2. Archivos que te pertenecen

```
src/rendering/
├── BlockRenderer.js, Renderer.js
├── ChunkMesh.js           (nuevo)
├── ChunkMeshBuilder.js    (nuevo)
└── TextureAtlas.js        (nuevo)
src/world/
├── World.js
└── Chunk.js
src/persistence/
└── WorldSerializer.js
src/game/GameConfig.js     (solo secciones world, chunk y rendering)
```

**No toques:** `src/blocks/`, `src/world/WorldGenerator.js`, `src/player/`, `src/game/Game.js`, `src/ui/`, `src/interface/`, `src/audio/`, `scripts/`.

---

## 3. Antes de escribir código

- Leé `BlockRenderer`, `World.forEachSolidBlock()`, `World.setBlockId()` (ya marca `dirty` a los chunks vecinos en el borde) y `Chunk.markClean()`, que hoy nadie llama.
- Corré `npm test` y verificá que esté en verde antes de empezar.
- Revisá `p.buildGeometry()` y `p.freeGeometry()` en la documentación de p5 1.11: son la base de la malla por chunk.
- Anotá los FPS actuales con F3 para compararlos al final.

---

## 4. Alcance

### 4.1 `TextureAtlas`
- Combinar en tiempo de carga las texturas de bloque en un único `p5.Graphics` (celdas de 16×16) con filtro `NEAREST`.
- Resolver UV por nombre de textura, con margen por celda para que no se tomen píxeles de la vecina.
- Tomar `textures.top/side/bottom` cuando la Tarea Backend 2 los declare; mientras tanto, `texture`.

### 4.2 `ChunkMeshBuilder` y `ChunkMesh`
- Una malla por chunk con `p.buildGeometry()`, emitiendo **solo caras visibles**: una cara se emite si el vecino no es opaco (`BlockRegistry.isOpaque`), también a través del borde del chunk.
- Normales por cara para que `LightingManager` siga funcionando.
- Reconstruir solo chunks `isDirty` y llamar a `markClean()`. Tope `MAX_CHUNK_REBUILDS_PER_FRAME` en `GameConfig`.
- Liberar la geometría vieja con `freeGeometry()`.

### 4.3 `BlockRenderer`
- Culling por chunk (distancia del centro del chunk al jugador).
- Mantener el contrato: `render(world, viewer)`, `renderedBlocks`, `renderDistance`, `setRenderDistance()`. Sumar `renderedChunks`.
- Nuevo punto de extensión `renderer.addOverlay({ draw(p, camera) })`, dibujado después del mundo (lo usa Frontend 1).

### 4.4 Mundo más grande
- `GameConfig.world`: 128×128, altura 48. Alturas de terreno coordinadas con Backend 2 (dueño del generador).
- Exponer `World.chunkAtChunkCoords(cx, cz)` para el builder.

### 4.5 Guardado compacto
- Formato v3: RLE por chunk antes de base64 (el mundo crudo pasa a ~786 kB).
- Seguir leyendo v2 y rechazar versiones desconocidas con `incompatible-version`.

---

## 5. Reglas que no se negocian

- `World` sigue sin saber cómo se dibuja nada.
- POO estricta: una responsabilidad por clase, un archivo por clase.
- Todo valor ajustable en `GameConfig`.

---

## 6. Definición de terminado

- `npm test` en verde, con tests nuevos: 6 caras para un bloque aislado, 10 para dos pegados, caras en borde de chunk, reconstrucción solo de chunks sucios, RLE ida y vuelta, lectura de v2.
- `npm run build` sin errores. Consola limpia.
- Mundo 128×128 con distancia 64: ≥ 50 FPS (anotar equipo y valor en el PR).
- Commit con mensaje convencional (`feat: ...`).

**Testeo manual con `npm run dev`:**
1. F3 muestra chunks y bloques dibujados; al caminar el conteo cambia de a un chunk.
2. Romper un bloque en el borde de un chunk no deja agujeros en el vecino.
3. Texturas nítidas, sin bordes de colores ajenos.
4. Guardar, recargar, cargar: el mundo vuelve igual y la entrada en `localStorage` pesa bastante menos de 1 MB.

---

## 7. Dependencias con el resto del equipo

- **Backend 2:** declara bloques nuevos y texturas por cara; el atlas los toma del `BlockRegistry`.
- **Frontend 1:** usa `renderer.addOverlay()`.
- **Frontend 2:** usa `setRenderDistance()` y `renderedChunks` (exponer `renderDistanceChunks` si simplifica).

---

## 8. Fuera de alcance

Greedy meshing, carga/descarga dinámica de chunks, mundo infinito, LOD, occlusion culling, Web Workers, shaders propios.
