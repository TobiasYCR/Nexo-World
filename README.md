# Nexo World

Sandbox voxel 3D que corre en el navegador, pensado también como herramienta educativa. El jugador explora un mundo generado por semilla, rompe y coloca bloques y construye planos guiados. Mientras tanto aprende a leer los nombres de los bloques separados en sílabas y con lectura en voz alta.

Proyecto de la materia P.I.S.W.D. Equipo: Andrea Cubas, Tobias Caballero, Leandro Caballaro y Gonzalo Gómez.

---

## Qué tiene

- **Mundo:**
  - 96 × 96 bloques, generado por semilla, con cuatro biomas (llanura, bosque, desierto y colinas), cuevas, minerales y árboles.
  - Terreno chato a propósito, para poder construir en casi cualquier parte.
  - En el centro, donde aparece el jugador, hay una zona de construcción: una llanura de 25 × 25 totalmente plana, sin árboles ni cuevas.
  - El mismo mundo se repite con la misma semilla.
- **Modos de juego:**
  - **Supervivencia:** vida, daño por caída y bloques que se juntan al romper.
  - **Creativo:** bloques sin límite, sin daño y vuelo.
- **Partidas:**
  - Crear mundos con nombre, semilla y modo; guardarlos y cargarlos desde el navegador.
  - Se guardan el mundo, el jugador, la semilla, el modo y el plano en curso.
- **Cuentas** (servidor con MySQL):
  - Registro, inicio de sesión y perfil.
  - Recuperación de contraseña con un código que da un administrador.
- **Puntuaciones:**
  - Puntos por explorar, descubrir biomas, minar y construir; niveles.
  - Clasificación por modo, validada por el servidor.
- **Modo educativo:**
  - Planos de construcción (casa, torre y puente) con guía 3D en el mundo. Se apoyan en el suelo llano más cercano y piden los bloques por etapas: piso, columnas, paredes, ventanas y techo.
  - Nombres de bloques en sílabas y lectura en voz alta (Web Speech API).
- **Asistente de consultas:** chat que responde sobre el juego y la partida a partir de los datos del juego, sin servicios externos.
- **Render por mallas de chunk:** solo las caras visibles, caras iguales unidas (greedy meshing), recorte por distancia y por cono de visión.
- **Configuración:** sensibilidad, FOV, volumen, distancia de render, partículas, efectos, escala de la interfaz y optimizaciones; se guarda y se aplica al instante.

## Stack

| Tecnología | Uso |
|---|---|
| p5.js 1.11 (WEBGL) | Render 3D y ciclo principal |
| JavaScript ES (módulos nativos) | Una clase por archivo |
| Vite 7 | Servidor de desarrollo y build |
| Node.js + `node:http` | Servidor de cuentas y puntuaciones |
| MySQL 8 (`mysql2`) | Cuentas, sesiones, progreso y clasificación |
| `node:test` | Pruebas unitarias y de integración |

---

## Instalación y ejecución

Requiere **Node.js 20.12 o superior** y, para cuentas y puntuaciones, **MySQL 8**.

```bash
npm install
cp .env.example .env     # completar usuario y contraseña de MySQL
npm run server           # API de cuentas y puntuaciones en http://127.0.0.1:3001
npm run dev              # juego en http://localhost:5173 (otra terminal)
```

El servidor crea la base `nexo_world` y sus tablas si no existen. Vite reenvía `/api` al servidor.

Sin servidor el juego funciona, pero no hay cuentas ni clasificación; el progreso queda guardado en el navegador.

| Comando | Qué hace |
|---|---|
| `npm run dev` | Servidor de desarrollo |
| `npm run build` | Build de producción en `dist/` |
| `npm run preview` | Sirve el build |
| `npm run server` | API de cuentas y puntuaciones |
| `npm run admin -- reset-password <usuario o correo>` | Código de recuperación de contraseña (vence en 30 min, un solo uso) |
| `npm test` | Pruebas |
| `NEXO_TEST_MYSQL=1 MYSQL_PASSWORD=... npm test` | Pruebas también contra MySQL real (bases `nexo_world_test` y `nexo_world_test_cuentas`) |

### Recuperar una contraseña

1. El administrador corre `npm run admin -- reset-password tobias` en la máquina del servidor y le pasa el código (por ejemplo `62NV-W5XV`) a quien lo pidió.
2. En el juego: **INICIAR SESIÓN → ¿Olvidaste tu contraseña?** → usuario o correo, código y contraseña nueva.

---

## Controles

| Tecla | Acción |
|---|---|
| Clic en el juego | Capturar el mouse |
| Mouse | Mirar |
| `W` `A` `S` `D` | Moverse |
| `Espacio` | Saltar (volando: subir) |
| `Shift` | Correr (volando: bajar) |
| `F` | Volar, solo en creativo |
| Clic izquierdo mantenido | Romper |
| Clic derecho | Colocar |
| `1`–`9`, rueda | Elegir bloque de la hotbar |
| `E` | Inventario |
| `P` | Planos de construcción |
| `T` | Chat del asistente |
| `O` | Configuración |
| `F1` | Controles |
| `F3` | Panel de diagnóstico |
| `Esc` | Pausa / cerrar pantalla |

---

## Estructura

```
src/
├── main.js          Punto de entrada: sketch de p5, Game y puente con la interfaz
├── game/            Game (coordinador), configuración, eventos, reglas de modo
├── world/           Mundo, chunks, generador, biomas, cuevas, minerales, semilla, aparición
├── blocks/          Catálogo de bloques y sílabas
├── player/          Jugador, control, física, rotura y colocación, vida
├── camera/          Cámara en primera persona
├── physics/         AABB, colisiones y raycast
├── rendering/       Mallas por chunk, luces y texturas
├── viewmodel/       Mano, partículas, guía de planos y efectos
├── input/           Teclado y mouse
├── inventory/       Inventario y hotbar
├── persistence/     Guardado de partidas
├── progression/     Puntos, niveles y conexión con el servidor
├── education/       Planos y desafíos de construcción
├── chatbot/         Asistente de consultas
├── auth/, users/    Sesión y cuentas en el cliente
├── audio/           Sonidos y lectura en voz alta
├── ui/, interface/  HUD, pantallas y componentes
└── utils/           Constantes y utilidades
server/              API de cuentas y puntuaciones, persistencia MySQL, comando de administrador
tests/               Pruebas con node:test
docs/                Arquitectura, convenciones, progresión, chat y hoja de ruta
```

`Game` coordina: construye los sistemas, define el orden de actualización y no implementa reglas propias. La interfaz vive en el DOM sobre el canvas y se comunica con el juego por `IntentBus` y `GameUiBridge`. Todos los valores ajustables están en `src/game/GameConfig.js`.

## Documentación

- [`docs/ARQUITECTURA.md`](docs/ARQUITECTURA.md): capas, ciclo del juego y render.
- [`docs/CONVENCIONES.md`](docs/CONVENCIONES.md): reglas de código y commits.
- [`docs/PROGRESION.md`](docs/PROGRESION.md): puntos, niveles, cuentas, clasificación y API.
- [`docs/CHATBOT.md`](docs/CHATBOT.md): investigación y diseño del asistente.
- [`docs/ROADMAP.md`](docs/ROADMAP.md): qué está hecho y qué falta.
