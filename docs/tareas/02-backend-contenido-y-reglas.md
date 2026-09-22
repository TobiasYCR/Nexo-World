# Tarea — Backend 2: Bloques nuevos, árboles y rotura progresiva

**Proyecto:** Nexo World
**Rol:** Backend 2 (contenido del mundo y reglas de juego)
**Rama sugerida:** `feat/world-content`
**Punto de partida:** commit `536bcfd` en `main`

---

## 1. Objetivo

Que el mundo tenga variedad y que romper y colocar se sienta como en Minecraft. Además, conectar en `Game` lo que ya existe y está suelto: audio, rueda del mouse, pausa real, guardado y caída al vacío.

---

## 2. Archivos que te pertenecen

```
src/blocks/
├── BlockType.js
└── BlockRegistry.js
src/world/
├── WorldGenerator.js, NoiseGenerator.js
└── TreeFeature.js         (nuevo)
src/player/
├── BlockInteraction.js
└── BlockBreaker.js        (nuevo)
src/game/
├── Game.js, GameState.js
└── GameEvents.js          (nuevo)
src/game/GameConfig.js     (secciones blocks, player y audio nueva)
src/utils/Constants.js     (BlockIds)
scripts/lib/BlockTextureFactory.js, scripts/generate-textures.js
assets/textures/blocks/
```

**No toques:** `src/rendering/`, `src/world/World.js`, `src/world/Chunk.js`, `src/persistence/`, `src/ui/`, `src/interface/`.

---

## 3. Antes de escribir código

- Leé `BlockRegistry`, `BlockInteraction`, `Game.#handleBlockInteractions()` y `AudioManager` (ya expone `preload()`, `unlock()` y `play()`).
- Corré `npm test` y verificá que esté en verde.
- Corré `node scripts/generate-textures.js` y confirmá que no genera diff: tus texturas nuevas tienen que mantener eso.
- Reproducí los problemas actuales: el juego corre detrás del menú, la rueda no cambia de slot y salir por el borde hace caer sin fin.

---

## 4. Alcance

### 4.1 Bloques nuevos
- Registrar `LOG`, `LEAVES`, `PLANKS`, `SAND`, `COBBLESTONE` y `GLASS`.
- `BlockType` suma:
  - `label`: nombre visible en español. La UI usa `label`, no `name`.
  - `textures: { top, side, bottom }` opcional; `texture` queda como default. Césped: arriba verde, costados con borde de tierra, abajo tierra.
  - `drops`: qué se obtiene al romper (piedra → piedra partida, hojas → nada).
- `GLASS` y `LEAVES` son transparentes: no tapan caras vecinas.
- Texturas 16×16 deterministas: `grass_top`, `grass_side`, `log_top`, `log_side`, `leaves`, `planks`, `cobblestone`, `glass` (con alfa). Actualizar `tests/assets.test.js`.

### 4.2 Generación
- Arena en columnas cuya superficie quede debajo de `SAND_LEVEL`.
- Árboles con `TreeFeature`: tronco de 4 a 6 bloques y copa de hojas; densidad y distancia mínima en `GameConfig`. Deterministas por semilla y sin cortarse en el borde del mundo.

### 4.3 Rotura progresiva (`BlockBreaker`)
- Mantener clic izquierdo rompe en `hardness × BREAK_TIME_PER_HARDNESS` segundos.
- Soltar o cambiar de bloque reinicia el progreso.
- Exponer `breakProgress` (0..1) y `breakingBlock`.

### 4.4 Eventos de juego (`GameEvents`)
- `on/emit` con `blockBroken`, `blockPlaced`, `breakProgress` y `playerLanded`.
- `Game` llama a `audio.preload()` en `start()` y reproduce los SFX desde esos eventos.
- Sección `GameConfig.audio` (`MASTER_VOLUME`, `SFX_VOLUME`, `MUSIC_VOLUME`, `AMBIENT_VOLUME`): `AudioManager` ya la lee.

### 4.5 Reglas sueltas
- **Pausa real:** la simulación no corre fuera de la partida. Exponer `game.pause()`, `game.resume()` e `isPaused`.
- **Rueda del mouse:** `hotbar.cycle(±1)` con `input.mouse.wheelDelta`.
- **Caída al vacío:** debajo de `VOID_Y`, reaparecer en la superficie del spawn.
- **Guardado:** `game.saveGame(slot)` y `game.loadGame(slot)` devuelven el `SaveResult` y resincronizan la cámara.

---

## 5. Reglas que no se negocian

- Nada de `if (blockId === ...)`: el comportamiento por tipo es una propiedad del `BlockType`.
- `Game` orquesta; la lógica de rotura vive en `BlockBreaker`.
- POO estricta: una responsabilidad por clase, un archivo por clase.

---

## 6. Definición de terminado

- `npm test` en verde, con tests nuevos: tiempo de rotura por `hardness` y reinicio, `drops`, árboles deterministas y dentro de límites, arena por umbral, respawn por vacío, simulación detenida en pausa, rueda cíclica, eventos emitidos.
- Regenerar texturas no produce diff.
- `npm run build` sin errores. Consola limpia.
- Commit con mensaje convencional (`feat: ...`).

**Testeo manual con `npm run dev`:**
1. Aparecen árboles y playas de arena.
2. Mantener clic sobre piedra tarda más que sobre tierra; soltar reinicia. Romper piedra da piedra partida.
3. Suenan romper y colocar.
4. Caer por el borde del mundo reaparece en el spawn.
5. Con el menú principal abierto, el jugador no se mueve ni cae.

---

## 7. Dependencias con el resto del equipo

- **Backend 1:** dibuja las texturas por cara con el atlas; hasta que llegue se ve `texture`. Acordar alturas del mundo de 128×128×48.
- **Frontend 1:** consume `breakProgress`, `breakingBlock` y los eventos.
- **Frontend 2:** consume `label`, `pause()`, `resume()`, `saveGame()` y `loadGame()`.

---

## 8. Fuera de alcance

Líquidos, cuevas, biomas múltiples, crafting, herramientas, entidades, ciclo día/noche.
