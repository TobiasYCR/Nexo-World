# Nexo World

Nexo World es un sandbox voxel 3D que corre en el navegador: un mundo hecho de bloques que el jugador puede explorar, modificar y guardar. Este repositorio contiene la **arquitectura base y un prototipo mínimo funcional**; el juego completo se construye sobre esta estructura.

El objetivo de esta etapa no es tener un juego jugable, sino dejar un esqueleto limpio, modular y orientado a objetos sobre el que un equipo pueda trabajar en paralelo sin pisarse.

---

## Stack tecnológico

| Tecnología | Rol |
|---|---|
| **p5.js 1.11 (WEBGL)** | Núcleo gráfico y ciclo principal. Todo el render 3D pasa por acá. |
| **JavaScript ES6+ (módulos nativos)** | Lenguaje del proyecto. Una clase por archivo, `import`/`export`. |
| **Vite 7** | Servidor de desarrollo y empaquetado. Cero configuración extra. |
| **HTML5 / CSS3** | Documento base y capa de interfaz superpuesta al canvas. |
| **Web APIs del navegador** | Pointer Lock (vista en primera persona), Web Audio (sonido), `localStorage` (guardado). |
| **`node:test`** | Tests unitarios y de integración, sin dependencias adicionales. |

### Qué no se usó, y por qué

- **React**: la interfaz actual son dos elementos (mira y panel de depuración). Un framework de UI agregaría build, estado y ciclo de vida sin resolver ningún problema real todavía. La interfaz ya vive en el DOM, separada del canvas, así que migrar a React más adelante es sumar componentes sobre `#ui-root` sin tocar el motor.
- **TypeScript**: para un equipo de cuatro personas arrancando, el costo de configuración y la fricción de tipos en código que todavía va a cambiar mucho supera el beneficio. Las clases están documentadas y los contratos son chicos y explícitos.
- **p5.sound**: `AudioManager` usa la Web Audio API directamente. Es menos código, menos peso y cubre de sobra lo que el juego necesita.

---

## Instalación

Requiere **Node.js 20 o superior**.

```bash
npm install
```

## Ejecución

```bash
npm run dev      # servidor de desarrollo en http://localhost:5173
npm run build    # build de producción en dist/
npm run preview  # sirve el build de producción
npm test         # tests unitarios y de integración
npm run benchmark:viewmodel # coste de CPU del viewmodel con 64 partículas
npm run server   # API de puntuaciones en http://127.0.0.1:3001 (requiere MySQL y .env)
```

### Servidor de puntuaciones

Requiere MySQL 8. Copiar `.env.example` como `.env`, completar usuario y contraseña de MySQL y, en otra terminal, ejecutar `npm run server`: crea la base `nexo_world` y sus tablas si no existen. Con `npm run dev` corriendo, Vite reenvía `/api` al servidor. Sin servidor, el juego funciona igual y guarda el progreso localmente. Detalle en [`docs/PROGRESION.md`](docs/PROGRESION.md).

El benchmark instrumenta las llamadas de dibujo para medir el coste JavaScript; no mide el trabajo de la GPU.

Al abrir el juego se ve una superficie de bloques generada por ruido. Los controles disponibles en esta etapa:

| Entrada | Acción |
|---|---|
| Clic en el canvas | Captura el mouse (Pointer Lock) |
| Mouse | Mirar alrededor |
| `W` `A` `S` `D` | Desplazarse |
| `Espacio` | Ascender |
| `Shift` izq. | Correr |
| `1`–`9` | Seleccionar slot de la hotbar |
| Rueda del mouse | Cambiar slot de la hotbar |
| Clic izquierdo mantenido | Romper el bloque apuntado |
| Clic derecho | Colocar el bloque seleccionado |
| `F3` | Mostrar/ocultar el panel de depuración |
| `Esc` | Pausar |

---

## Estructura del proyecto

```
nexo-world/
├── src/
│   ├── main.js              Punto de entrada: crea el sketch de p5 y el Game
│   ├── styles.css           Estilos del documento y de la capa de interfaz
│   ├── game/                Coordinación general
│   ├── world/               Datos y generación del mundo
│   ├── blocks/              Catálogo y definición de tipos de bloque
│   ├── player/              Estado, control y movimiento del jugador
│   ├── camera/              Cámara en primera persona
│   ├── physics/             AABB, colisiones y raycast
│   ├── rendering/           Pipeline de dibujado
│   ├── input/               Captura de teclado y mouse
│   ├── inventory/           Inventario y hotbar
│   ├── audio/               Reproducción de sonido
│   ├── ui/                  Interfaz durante la partida
│   ├── persistence/         Guardado y serialización
│   └── utils/               Constantes y utilidades sin dependencias
├── assets/                  Texturas, audio, modelos y fuentes
├── docs/                    Arquitectura, convenciones y hoja de ruta
├── tests/                   Tests con node:test
├── index.html
├── vite.config.js
└── package.json
```

> Vite publica el contenido de `assets/` en la raíz del servidor. Por eso las rutas de assets no llevan el prefijo `assets/`, y están centralizadas en `GameConfig.assets`.

---

## Arquitectura

### Coordinación

`Game` es un **coordinador**: construye los sistemas, define el orden de actualización y les pasa lo que necesitan. No implementa reglas de mundo, física ni dibujado.

```
Game
├── World ──────── WorldGenerator → NoiseGenerator
│                  Chunk
│                  BlockRegistry → BlockType, Block
├── Player ─────── PlayerController (input → intención)
│                  PlayerPhysics   (intención → movimiento)
├── FirstPersonCamera
├── Renderer ───── BlockRenderer, LightingManager, TextureManager
├── CollisionSystem, Raycast
├── InputManager ─ KeyboardInput, MouseInput
├── Hotbar ─────── Inventory → InventorySlot
├── AudioManager
├── HUD ────────── Crosshair, DebugOverlay
└── SaveManager ── WorldSerializer
```

### Game loop

p5 controla el ciclo. `draw()` es únicamente el disparador:

```js
p.draw = () => {
  const deltaTimeSeconds = p.deltaTime / 1000;
  game.update(deltaTimeSeconds);
  game.render();
};
```

`Game.update(deltaTime)` corre la lógica en un orden fijo: acciones globales → control del jugador → física → sincronización de cámara → inventario → interfaz → cierre del frame de entrada. `Game.render()` delega todo en `Renderer`. No hay lógica de juego dentro de `draw()`, y el tiempo se expresa siempre en segundos para que el comportamiento no dependa de los FPS.

### Separación de responsabilidades

- **World** almacena y consulta bloques en coordenadas globales, resolviendo internamente a qué `Chunk` pertenecen. No sabe nada de cómo se dibujan. Su único contrato hacia el render es `forEachSolidBlock()`.
- **Rendering** es el único conjunto de clases que conoce p5. `BlockRenderer` decide cómo se ve un bloque; reemplazarlo por mallas fusionadas o instancing no requiere tocar `World`.
- **Player** guarda estado. `PlayerController` traduce entrada en intención y `PlayerPhysics` la integra en el tiempo. Ninguna de las tres conoce a las otras dos por fuera de `Player`.
- **Input** detecta entradas y las expone como acciones lógicas; no contiene reglas del juego. Reasignar controles es editar el mapa de `GameConfig.input.KEY_BINDINGS`.
- **Physics** trabaja con cajas alineadas a los ejes (AABB) y consulta al mundo por bloques sólidos. Es independiente del render.
- **UI** vive en el DOM sobre el canvas, recibe datos ya calculados y nunca consulta el mundo por su cuenta.

### Configuración

Todos los valores ajustables están en `src/game/GameConfig.js`: `BLOCK_SIZE`, `WORLD_WIDTH`, `WORLD_HEIGHT`, `WORLD_DEPTH`, `PLAYER_SPEED`, `GRAVITY`, `JUMP_FORCE`, `RENDER_DISTANCE`, `MOUSE_SENSITIVITY`, entre otros. `src/utils/Constants.js` guarda lo que no es configurable (ids de bloque, acciones, caras). No hay magic numbers dispersos por el código.

---

## Cómo extender el proyecto

### Agregar un tipo de bloque

Una sola entrada en `src/blocks/BlockRegistry.js`, más su id en `Constants.js`:

```js
// src/utils/Constants.js
export const BlockIds = Object.freeze({ AIR: 0, GRASS: 1, DIRT: 2, STONE: 3, WOOD: 4 });

// src/blocks/BlockRegistry.js → DEFAULT_BLOCK_DEFINITIONS
{ id: BlockIds.WOOD, name: 'Wood', solid: true, texture: 'wood.png', color: [143, 119, 72], hardness: 2 }
```

No hace falta tocar el renderizador, el mundo ni la física: todos consultan el registro. **Nunca** encadenar condicionales sobre ids de bloque; si hace falta un comportamiento nuevo, se agrega como propiedad del `BlockType`.

### Agregar una textura

1. Guardar el PNG (16×16 o 32×32) en `assets/textures/blocks/`.
2. Declarar su nombre de archivo en el campo `texture` del `BlockType`.

`TextureManager` precarga automáticamente todo lo que declare el registro (`registry.textureNames()`) y `BlockRenderer` la aplica. Si el archivo falta, el bloque se dibuja con su color de respaldo y el juego no se rompe.

### Agregar un control

Sumar la acción en `Constants.InputActions` y su tecla en `GameConfig.input.KEY_BINDINGS`. El sistema que la necesite consulta `input.isActionDown(...)` o `input.wasActionJustPressed(...)`.

---

## Convenciones

- Una clase por archivo; el nombre del archivo coincide con el de la clase.
- Módulos ES nativos con extensión explícita en los imports (`./World.js`).
- Miembros privados con `#`; lo público es el contrato de la clase.
- Comentarios solo para decisiones de arquitectura, comportamiento no evidente o restricciones. Nada de comentarios triviales.
- Nombres descriptivos en inglés para el código, documentación en español.
- Tiempo siempre en segundos; ángulos siempre en radianes.
- Dos sistemas de coordenadas: **bloque** (enteros de la grilla) y **mundo** (unidades continuas). La conversión pasa por `World.worldToBlock()` y `World.blockToWorld()`.

Más detalle en [`docs/ARQUITECTURA.md`](docs/ARQUITECTURA.md) y [`docs/CONVENCIONES.md`](docs/CONVENCIONES.md).

---

## Estado actual

**Funciona:**

- Arranque con servidor local y canvas WEBGL a pantalla completa.
- Generación de terreno por ruido con capas de césped, tierra y piedra.
- Render 3D de los bloques visibles, con recorte por distancia y descarte de bloques totalmente enterrados.
- Cámara en primera persona con Pointer Lock, movimiento libre y aparición sobre la superficie.
- Panel de depuración con FPS, posición X/Y/Z, bloques dibujados y estado del juego.
- Pausa, alternado del panel y selección de hotbar con `1`–`9` o la rueda.
- Viewmodel con bloque/mano, resaltado del bloque apuntado, progreso de grietas y partículas al romper.
- Suite automatizada con tests unitarios y de integración del ciclo completo sin navegador.

**Preparado parcialmente:** la resolución completa de colisiones y la física con gravedad/salto, el sistema de chunks dinámico y el inventario completo siguen pendientes. La interacción de bloques, el raycast, las texturas, el audio y el guardado ya tienen implementación.

**No implementado todavía:** movimiento con colisiones, generación procedural avanzada (cuevas, biomas, estructuras), crafting, guardado real, multijugador, entidades, combate y supervivencia.

---

## Próximos pasos

1. Completar `CollisionSystem` con resolución por eje y conectarlo a `PlayerPhysics`.
2. Activar la gravedad y el salto.
3. Completar el movimiento con colisiones y seguir ampliando la interacción con bloques.
4. Sumar las texturas de bloque y validar el pipeline de `TextureManager`.
5. Interfaz de hotbar visible e inventario completo.
6. Guardado y carga con `SaveManager`.
7. Carga y descarga dinámica de chunks alrededor del jugador.
8. Optimización del render: reemplazar el `box()` por bloque de `BlockRenderer` por mallas fusionadas.

La hoja de ruta detallada, con el reparto sugerido para un equipo de cuatro, está en [`docs/ROADMAP.md`](docs/ROADMAP.md).
