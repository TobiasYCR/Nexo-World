# Tarea — Frontend 2: HUD y menús conectados al juego real

**Proyecto:** Nexo World
**Rol:** Frontend 2 (integración de interfaz con el motor)
**Rama sugerida:** `feat/hud-integration`
**Punto de partida:** commit `536bcfd` en `main`

---

## 1. Objetivo

Que la interfaz muestre y controle el juego de verdad. Hoy la hotbar visible es un mock de 9 bloques inventados, 14 de los 17 bloques del inventario no existen en el registro, la configuración no llega al juego y la pausa depende de un `KeyboardEvent('Escape')` sintético.

---

## 2. Archivos que te pertenecen

```
src/ui/
├── HUD.js, HotbarView.js, DebugOverlay.js, PauseScreen.js, MenuScreen.js
├── GameUiBridge.js        (nuevo)
└── Toast.js               (nuevo)
src/interface/
├── screens/
├── components/
└── models/SettingsModel.js
src/inventory/             Hotbar.js, Inventory.js, InventorySlot.js
src/camera/FirstPersonCamera.js   (solo setters de FOV y sensibilidad)
src/main.js                (una línea: crear el GameUiBridge)
src/styles.css, src/interface/interface.css
```

**No toques:** `src/rendering/`, `src/world/`, `src/player/`, `src/game/`, `src/audio/`, `src/persistence/`, `src/blocks/`.

---

## 3. Antes de escribir código

- Leé `HUD`, `IntentBus`, `ScreenManager`, `Game` y `Hotbar`. Ubicá los mocks: `HUD.mount()` (hotbar) y `EXTENDED_BLOCK_CATALOG` (inventario).
- Corré `npm test` y verificá que esté en verde.
- Reproducí en el navegador: romper un bloque no cambia la hotbar; elegir un bloque del inventario no hace nada; cambiar volumen o FOV no tiene efecto.
- Confirmá con Backend 2 los nombres de `pause()`, `resume()`, `saveGame()`, `loadGame()` y `label` antes de consumirlos.

---

## 4. Alcance

### 4.1 `GameUiBridge`
- Único punto que conoce a la vez a `Game` y al `IntentBus`: traduce intenciones en llamadas al juego y estado del juego en actualizaciones de UI.
- Reemplaza el `Escape` sintético de `HUD` por `game.pause()` / `game.resume()`.

### 4.2 Hotbar real
- `HotbarView` se alimenta de `game.hotbar`; solo toca el DOM si cambió (firma `id:count` por slot).
- Íconos con la textura real (`AssetCatalog.textureUrl()`, `image-rendering: pixelated`) y color de respaldo.
- Nombre con `BlockType.label` (mientras no exista, `name`). Eliminar los datos mock.

### 4.3 Inventario (modo creativo)
- Solo `blockRegistry.placeableTypes()`. Eliminar `EXTENDED_BLOCK_CATALOG`.
- Elegir un bloque pone una pila completa en el slot activo (agregar `Hotbar.setSlot(index, blockType, count)`).

### 4.4 Configuración aplicada
- Sensibilidad: `camera.setSensitivityMultiplier()`. FOV: `camera.setFov()`. Unificar default (UI 75 vs `GameConfig` 70).
- Volumen: `game.audio.setMasterVolume(valor / 100)`.
- Distancia de render: habilitar el slider y quitar la nota "Pendiente Backend 2"; chunks → `game.renderer.setRenderDistance(chunks × SIZE_X)`.
- Aplicar los valores guardados al iniciar la partida.

### 4.5 Pausa, guardado y avisos
- Pausa con botones **Guardar** y **Cargar** (`game.saveGame()` / `game.loadGame()`).
- `Toast` con `SaveResult.message` para éxito o error. Sin `alert()`.
- Menú principal: **Continuar** habilitado solo si `saveManager.exists(slot)`.

### 4.6 Panel F3
- Sumar chunks dibujados, bloque apuntado y slot seleccionado.

---

## 5. Reglas que no se negocian

- La UI no modifica el mundo directamente: siempre pasa por métodos de `Game`.
- Navegable con teclado, manteniendo los roles ARIA actuales.
- Ningún `setTimeout` para sincronizar estado de juego (sí para foco de UI).

---

## 6. Definición de terminado

- `npm test` en verde, con tests nuevos: hotbar sin escrituras al DOM si no cambió, inventario solo con bloques registrados, cada ajuste llegando a su sistema (con dobles de `Game`), mensajes de guardar/cargar, pausa sin eventos de teclado sintéticos.
- `npm run build` sin errores. Consola limpia.
- Commit con mensaje convencional (`feat: ...`).

**Testeo manual con `npm run dev`:**
1. Romper un bloque suma uno a su slot en pantalla; colocar resta.
2. En el inventario (E), elegir Piedra la pone en el slot activo con 64.
3. FOV, sensibilidad, volumen y distancia de render se notan al instante y persisten al recargar.
4. Escape pausa y reanuda; con el menú abierto el jugador no se mueve.
5. Guardar, cambiar el mundo y Cargar vuelve al estado guardado con aviso. Corromper la entrada en `localStorage` muestra un error legible sin romper la partida.

---

## 7. Dependencias con el resto del equipo

- **Backend 2:** `label`, `pause()`, `resume()`, `isPaused`, `saveGame()`, `loadGame()`.
- **Backend 1:** `setRenderDistance()` (ya existe) y `renderedChunks`.
- **Frontend 1:** ambos leen `hotbar.selectedIndex`; no cambiar su semántica.

---

## 8. Fuera de alcance

Arrastrar y soltar entre slots, inventario de supervivencia, crafting, remapeo de controles, internacionalización.
