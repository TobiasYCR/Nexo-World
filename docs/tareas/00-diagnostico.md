# Diagnóstico — Estado de Nexo World en `536bcfd`

Base de las tareas de la siguiente etapa. Medido con `npm test`, `npm run build` y el juego real en Chromium.

## Funciona

| Chequeo | Resultado |
|---|---|
| `npm test` | 126/126 |
| `npm run build` | OK (aviso de bundle > 500 kB por p5, preexistente) |
| Consola del navegador | Limpia |
| Texturas | PNG 200, filtro NEAREST, fallback a color |
| Cámara | Escena derecha tras el fix con `frustum()` |
| Física | Suelo, salto y escalón |
| Romper / colocar | Funciona y suma a `game.hotbar` |
| Guardar / cargar | `SaveManager` con `localStorage` real, errores legibles |

## Problemas

### Integración
1. La hotbar visible es un mock de 9 bloques (`HUD.mount()`); la real (`game.hotbar`) nunca se muestra.
2. 14 de 17 bloques del inventario no existen en el `BlockRegistry`; `SET_HOTBAR_BLOCK` no tiene oyente.
3. `SETTINGS_CHANGED` no llega a `Game`: volumen, FOV y sensibilidad sin efecto. Distancia de render deshabilitada aunque el setter existe.
4. `Game` no usa `audio.preload()`/`play()` ni ofrece guardar/cargar.
5. El juego corre detrás del menú principal; la pausa depende de un `KeyboardEvent('Escape')` sintético.
6. La rueda del mouse no cambia de slot (`wheelDelta` y `Hotbar.cycle()` existen sin conectar).
7. Fuera del mapa todo es aire: caída infinita (y = -913 a los 3 s).
8. Nombres mezclados: "Grass/Dirt/Stone" en el registro, "Pasto/Tierra/Piedra" en la UI.

### Escala

| Mundo | Distancia | Bloques dibujados | CPU de culling por frame |
|---|---|---|---|
| 32×32 (actual) | 24 | 2.631 | 2,9 ms |
| 128×128 | 24 | 3.608 | 6,9 ms |
| 256×256 | 24 | 3.608 | 13,8 ms |
| 128×128 | 64 | 26.101 | 39 ms |

Un `box()` por bloque visible y culling sobre todo el mundo: sin mallas por chunk el mapa no puede crecer.

### Contenido
- Solo 3 bloques colocables; `wood.png` y `sand.png` sin tipos registrados.
- Misma textura en las 6 caras del césped.
- Rotura instantánea aunque `hardness` existe.
- Sin resaltado del bloque apuntado, mano, grietas ni partículas.

## Tareas

| Archivo | Rol |
|---|---|
| `01-backend-mundo-escalable.md` | Backend 1 |
| `02-backend-contenido-y-reglas.md` | Backend 2 |
| `03-frontend-mano-y-feedback.md` | Frontend 1 |
| `04-frontend-hud-conectado.md` | Frontend 2 |
