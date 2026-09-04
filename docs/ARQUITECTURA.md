# Arquitectura de Nexo World

Documento de referencia para quien trabaje sobre el código. Complementa el README con el detalle de cada módulo y las reglas que sostienen la estructura.

## Principios

1. **Una responsabilidad principal por clase.** Si una clase necesita dos frases con "y" para describirse, hay que partirla.
2. **El flujo de dependencias no vuelve.** `utils` no depende de nada; `blocks` y `world` no dependen de `rendering`; `rendering` sí depende de `world`. No hay ciclos.
3. **p5 está contenido.** Solo `main.js`, `rendering/*` y `camera/FirstPersonCamera` reciben la instancia de p5. El resto del motor es JavaScript puro y se puede testear en Node.
4. **Sin patrones preventivos.** No hay fábricas, observadores ni inyectores salvo donde resuelven un problema concreto. `BlockRegistry` existe porque elimina condicionales por id; `GameState` porque evita banderas sueltas.

## Módulos

### `game/`

| Clase | Responsabilidad |
|---|---|
| `Game` | Construye los sistemas, define el orden de actualización y reparte trabajo. Es el único lugar donde se ve el juego completo. |
| `GameState` | Estado actual (`loading` / `running` / `paused`) con notificación de cambios. |
| `GameConfig` | Objeto congelado con todos los valores ajustables. Fuente única de verdad. |

`Game` no debe crecer con lógica: cuando aparece una regla nueva, va en el sistema que le corresponde y `Game` solo la invoca.

### `world/`

| Clase | Responsabilidad |
|---|---|
| `World` | Almacena y consulta bloques en coordenadas globales. Resuelve el chunk que contiene cada coordenada. |
| `Chunk` | Porción del mundo con su propio `Uint8Array`. Trabaja en coordenadas locales. |
| `WorldGenerator` | Traduce ruido en capas de terreno y las escribe en un `World`. |
| `NoiseGenerator` | Ruido de valor fractal con semilla, determinista e independiente de p5. |

El mundo ya está dividido en chunks aunque no haya carga dinámica. Eso evita migrar la representación de datos más adelante.

### `blocks/`

| Clase | Responsabilidad |
|---|---|
| `BlockType` | Definición inmutable de una clase de bloque: id, nombre, solidez, textura, color, dureza. |
| `BlockRegistry` | Catálogo de tipos. Único lugar donde se declaran propiedades por tipo. |
| `Block` | Bloque concreto del mundo: posición más tipo. Se usa cuando hace falta contexto (raycast, interacción). |

El mundo guarda ids (`Uint8Array`) por eficiencia; `Block` es el objeto que viaja entre sistemas.

### `player/`, `camera/`

`Player` es estado. `PlayerController` traduce entrada en intención de movimiento y rotación de cámara. `PlayerPhysics` integra esa intención en el tiempo. `FirstPersonCamera` mantiene posición y orientación y las aplica al sketch: es el único punto donde se llama a `p.camera()` y `p.perspective()`.

La posición del jugador es la de los **pies**, centrada en el eje horizontal. Los ojos se calculan con `EYE_HEIGHT`.

### `physics/`

`AABB` es la primitiva. `CollisionSystem` traduce una caja a los bloques sólidos que la rodean y responde si hay colisión o suelo. `Raycast` implementa recorrido de voxeles (DDA) y devuelve el bloque golpeado, la cara y la posición adyacente donde iría un bloque nuevo.

La resolución de penetración por eje es el trabajo pendiente principal de este módulo.

### `rendering/`

`Renderer` orquesta el frame: fondo, cámara, luces, geometría. `BlockRenderer` es la única clase que sabe cómo se ve un bloque. `LightingManager` aísla la iluminación. `TextureManager` centraliza rutas y carga de texturas.

`BlockRenderer` consume `World.forEachSolidBlock()`. Ese es el contrato completo: cualquier implementación futura (mallas fusionadas, instancing) puede reemplazarlo sin que `World` cambie.

### `input/`

`KeyboardInput` y `MouseInput` capturan estado crudo. `InputManager` lo traduce a acciones lógicas usando el mapa de `GameConfig`. Ningún sistema pregunta por teclas: pregunta por acciones.

Las entradas "recién presionadas" duran un frame. `Game.update()` llama a `input.endFrame()` al final, después de que todos los sistemas leyeron.

### `ui/`

La interfaz vive en el DOM, dentro de `#ui-root`, superpuesta al canvas y con `pointer-events: none` para no robarle el mouse al juego. Esto evita dibujar texto en WEBGL y deja el camino abierto a montar React sobre el mismo contenedor sin tocar el motor.

`HUD` solo muestra datos que recibe; nunca consulta el mundo.

### `persistence/`

`WorldSerializer` define el formato (versionado desde el inicio). `SaveManager` encapsula el medio de almacenamiento. Separarlos permite cambiar de `localStorage` a IndexedDB o a un backend sin tocar el formato.

## Sistemas de coordenadas

- **Coordenadas de bloque**: enteros de la grilla. Las usan `World`, `Chunk`, `WorldGenerator` y `Raycast`.
- **Coordenadas de mundo**: unidades continuas, iguales a coordenadas de bloque multiplicadas por `BLOCK_SIZE`. Las usan `Player`, `FirstPersonCamera` y `AABB`.

La conversión pasa siempre por `World.worldToBlock()` y `World.blockToWorld()`. Convertir a mano en otro lado es un error.

En p5 WEBGL el eje Y crece hacia arriba y el eje Z hacia el observador; por eso el vector de avance con guiñada 0 es `(0, 0, -1)`.

## Rendimiento

Esta versión dibuja un `box()` por bloque visible. Se aplican dos recortes baratos:

- distancia horizontal contra `RENDER_DISTANCE`;
- descarte de bloques rodeados por seis bloques opacos.

Deliberadamente **no** hay mallas fusionadas, instancing, shaders propios, oclusión avanzada, Web Workers ni LOD. El objetivo es que el código sea legible mientras el equipo se familiariza; la optimización entra después, contenida en `BlockRenderer`.

## Testing

`npm test` corre `node:test` sin dependencias externas. `tests/support/domStub.js` provee dobles mínimos de DOM y de p5 que permiten ejercer el ciclo completo de `Game` en Node: verifica el cableado entre sistemas, que un frame no lance excepciones y que el renderizador emita geometría. No reemplaza la verificación visual en el navegador.

## Espacio para un backend

No hay servidor ni se necesita: el juego es enteramente cliente. Si más adelante hacen falta partidas compartidas o guardado en la nube, el punto de entrada natural es `SaveManager` (persistencia remota) y una capa nueva de red junto a `Game`, sin tocar los sistemas existentes.
