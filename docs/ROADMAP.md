# Hoja de ruta

Orden sugerido de trabajo y reparto para un equipo de cuatro. Cada bloque toca módulos distintos, de modo que se pueda avanzar en paralelo con pocos conflictos.

## Etapa 1 — Movimiento real

**Módulos:** `physics/`, `player/`

- Resolución de colisiones por eje en `CollisionSystem` (mover en X, resolver; luego Y; luego Z).
- Conectar la resolución a `PlayerPhysics` y activar `gravityEnabled`.
- Gravedad, salto y detección de suelo estable.
- Tests de penetración y de caída sobre terreno irregular.

## Etapa 2 — Interacción con bloques

**Módulos:** `physics/Raycast`, `world/`, `inventory/`

- Usar `Raycast` desde la cámara para resaltar el bloque apuntado.
- Romper con clic izquierdo, colocar con clic derecho usando `RaycastHit.adjacentPosition`.
- Impedir colocar un bloque dentro del jugador.
- Alimentar la hotbar con lo que se rompe.

## Etapa 3 — Presentación

**Módulos:** `rendering/`, `ui/`, `audio/`

- Texturas de bloque en `assets/textures/blocks/` (`grass.png`, `dirt.png`, `stone.png`, `wood.png`, `sand.png`).
- Hotbar visible con el slot seleccionado.
- Sonidos de pasos, romper y colocar bloques.
- Menú principal y pantalla de pausa.

## Etapa 4 — Persistencia y mundo grande

**Módulos:** `persistence/`, `world/`

- Guardado y carga con `SaveManager` sobre `localStorage`.
- Carga y descarga de chunks según la posición del jugador.
- Generación por chunk en lugar de generación total al inicio.
- Semilla configurable desde el menú.

## Etapa 5 — Optimización

**Módulos:** `rendering/`

- Reemplazar el `box()` por bloque por mallas por chunk, reconstruidas solo cuando el chunk está `dirty`.
- Descartar caras internas al construir la malla.
- Recorte por volumen de visión.

Esta etapa se hace **al final** y queda contenida en `BlockRenderer`: si el resto del código respetó los contratos, `World`, `Player` y `UI` no cambian.

## Más adelante

Crafting, entidades, ciclo día/noche, biomas, cuevas, estructuras generadas, y —solo si el proyecto lo justifica— un backend en Node.js para partidas compartidas.
