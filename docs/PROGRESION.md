# Progresión, puntuaciones y clasificación

Investigación, decisiones y contratos del sistema de puntuaciones de Nexo World (Backend 2, rama `feat/player-progression`).

## 1. Investigación

### 1.1 ¿Niveles en un sandbox?

| Pregunta | Conclusión |
|---|---|
| Qué función cumplen | En Minecraft la experiencia no mejora al personaje: es una moneda que se gasta en encantamientos y yunque, y lo único que exige un nivel es la mesa de encantamientos (nivel 30) y el yunque (39); en creativo se quita el límite del yunque. |
| Ventajas | Sensación de avance a largo plazo; incentivo a explorar y minar. |
| Desventajas | En un sandbox, un nivel que bloquea contenido choca con la libertad de construir; si no bloquea nada, es solo un número que repite la puntuación. |
| Obligatorios, opcionales o representativos | Solo tienen sentido si hay algo en qué gastarlos. Nexo World hoy no tiene crafteo, herramientas ni encantamientos. |
| Modo creativo | Nunca debería exigir niveles: separar la progresión por modo. |
| Actividades que darían experiencia | Las mismas que dan puntos (explorar, minar), por lo que hoy serían equivalentes sin justificación. |
| Impacto futuro | Si se agregan herramientas o crafteo, la experiencia puede volver como moneda (modelo Minecraft) sin tocar las puntuaciones. |

**Decisión: no implementar niveles en esta etapa.** No hay mecánicas que desbloquear y la experiencia sería una copia de la puntuación. La alternativa es la **puntuación desglosada por categoría** (exploración, biomas, minería y construcción), que da el mismo reconocimiento sin bloquear nada. Las puntuaciones funcionan solas; los niveles pueden sumarse después sin cambiar este modelo.

### Addendum: niveles representativos (issue #27)

La etapa siguiente incorpora niveles sin contradecir la decisión anterior: son
representativos, no desbloquean ni bloquean contenido y funcionan igual en
supervivencia y creativo (cada modo conserva sus propias estadísticas).

La experiencia está separada de los puntos para que cada actividad tenga un
valor propio:

| Actividad | XP | Justificación |
|---|---:|---|
| Celda de exploración nueva | 5 | Reconoce recorrer territorio, pero a una escala moderada. |
| Bioma nuevo | 40 | Es un descubrimiento menos frecuente y más significativo. |
| Mineral natural extraído | 12 | Valora la exploración subterránea sin depender del tipo de mineral. |
| Bloque construido en pie | 1 | Acompaña la construcción sin convertirla en la fuente principal de XP. |

El umbral del nivel 2 es `BASE_XP` (100 XP). Cada nivel siguiente suma un
umbral `ceil(BASE_XP × GROWTH^(nivel-2))`, con `GROWTH = 1.35`; así la curva
crece de forma progresiva. Se decidió un máximo representativo de nivel 50:
al alcanzarlo la barra queda completa, pero ninguna acción queda bloqueada.

La experiencia se recalcula desde `ProgressState` al entrar a un mundo; no se
guarda una copia de XP. Durante la sesión se conserva el mayor valor observado
para que quitar una construcción no baje el nivel. La carga y la reconciliación
con el servidor son silenciosas: `levelUp` solo se emite cuando una acción de
la partida cruza uno o más umbrales. El feedback es un conjunto pequeño de
partículas alrededor de la mano en primera persona y se puede apagar con
`GameConfig.levels.SHOW_LEVEL_UP_EFFECT`.

### 1.2 Actividades que otorgan puntos

Solo se usan mecánicas que ya existen en el juego.

| Actividad | ¿Puntúa? | Motivo |
|---|---|---|
| Explorar | Sí: cada celda de 8×8 columnas, la primera vez por mundo | Premia recorrer el mapa; no se repite. |
| Descubrir biomas | Sí: cada bioma, la primera vez por mundo | Hay cuatro biomas desde la etapa anterior. |
| Encontrar minerales | Sí: mineral **natural**, una vez por posición | Se verifica contra el mundo original (semilla). |
| Romper bloques comunes | No | Es infinito y no representa progreso. |
| Colocar bloques | Sí, como **saldo neto**: +1 al construir, −1 al quitar lo construido | No penaliza a quien construye; colocar y romper da cero. |
| Recolectar recursos | No, aparte | Duplicaría minería. |
| Objetivos y desafíos | No | No existen todavía. |

### 1.3 Clasificaciones

Prácticas relevadas en plataformas conocidas:

- **Una entrada por jugador y por tabla**, y una carga que conserva la mejor marca (`KeepBest` en Steam).
- **Escrituras de confianza:** en Steam, una tabla "Trusted" solo acepta puntuaciones escritas por el servidor.
- **Límites de puntuación** para descartar envíos claramente fraudulentos (Google Play Games).
- **Tablas por período y por modo**, separadas.

Decisiones para Nexo World:

| Tema | Decisión |
|---|---|
| Qué se guarda | Hechos de progreso por jugador, modo y mundo; la puntuación se recalcula a partir de ellos. |
| Orden | Puntuación descendente. |
| Empates | Primero quien alcanzó esa puntuación antes (`achievedAt`); si también coincide, el id de jugador. Cada jugador tiene una posición única. |
| Global y personal | La global son las primeras N posiciones; la personal es la posición y la mejor marca de un jugador. |
| Por modo | Sí: `survival` y `creative` tienen tablas separadas, así el creativo no da ventaja en supervivencia. |
| Por período | No en esta etapa (fuera de alcance). |

### 1.4 Integración con usuarios

Backend 1 todavía no terminó el sistema de cuentas, así que se usan **jugadores invitados**:

- `POST /api/players` crea un jugador con id (UUID) y un token secreto. El navegador guarda ambos.
- La base guarda solo el **hash SHA-256** del token.
- La tabla `players` tiene `account_id` (nulo, único), reservado para vincular la cuenta de Backend 1 cuando exista.
- Partidas existentes: el progreso se identifica por mundo, así que los guardados del mundo no cambian.

## 2. Modelo de datos

**Decisión: el progreso se registra por jugador, modo y mundo; la clasificación usa el mejor mundo de cada jugador por modo.** Así, empezar mundos nuevos para repetir exploración no acumula puntos en la tabla.

- **Clave de mundo:** `s<semilla>-v<versión del generador>-<ancho>x<alto>x<profundidad>`. Dos mundos con la misma clave son idénticos bloque a bloque.
- **Estado de progreso (`ProgressState`):** guarda hechos, nunca puntos.
  ```json
  { "version": 1, "explored": [0, 5], "biomes": [1, 3], "mined": { "12": [1834], "15": [402] }, "blocksBuilt": 12 }
  ```
- **Puntuación:** `ScoreRules.scoreOf(estadísticas)`, con valores en `GameConfig.progression.POINTS`.

| Concepto | Puntos |
|---|---|
| Celda de exploración | 5 |
| Bioma nuevo | 50 |
| Bloque construido en pie | 1 (tope de 2.000 bloques por mundo) |
| Carbón | 1 |
| Hierro | 2 |
| Oro | 5 |
| Diamante | 10 |

### Tablas MySQL (`server/persistence/schema.sql`)

| Tabla | Clave | Contenido |
|---|---|---|
| `players` | `id` | Nombre, hash del token, `account_id`, alta. |
| `progress` | `player_id, mode, world_key` | Revisión, puntuación, estadísticas y estado (JSON), última actualización. |
| `leaderboard` | `mode, player_id` | Mejor marca, cuándo se alcanzó y en qué mundo. Índice `(mode, best_score DESC, achieved_at, player_id)`. |

Los tiempos se guardan como milisegundos epoch (`BIGINT`) para que el desempate sea exacto.

## 3. Abusos y controles

| Abuso | Control |
|---|---|
| Colocar y romper el mismo bloque | Construir +1 y quitar lo construido −1: el saldo es cero. |
| Volver a minar un mineral reinstalado | Un mineral puntúa solo si en esa posición el generador había puesto ese mineral, una vez por posición. |
| Recompensas duplicadas por evento | El tracker se suscribe una sola vez y cada hecho es un conjunto. |
| Puntuación falsificada por el cliente | El servidor ignora cualquier puntaje y lo recalcula a partir de los hechos. |
| Hechos inventados | El servidor regenera el mundo con la misma semilla y rechaza celdas, biomas o minerales que no existen ahí. |
| Envíos viejos o de otra pestaña | La revisión tiene que crecer y el estado nuevo tiene que contener al guardado; si no, 409 y el cliente une ambos. |
| Puntos imposibles en poco tiempo | Máximo de 600 puntos por minuto, más un margen de 300 (configurable). |
| Escribir puntuaciones ajenas | Se exige el token del jugador. |

**Limitación:** el servidor no simula la partida. Un cliente modificado puede declarar hechos que el mundo permite sin haberlos hecho; el techo es el máximo natural del mundo y el ritmo permitido. La clasificación **no debe presentarse como resistente a trampas**.

## 4. Contratos

### 4.1 Contrato público para la interfaz (`game.progression`, `PlayerProgression`)

| Miembro | Devuelve |
|---|---|
| `score` | Puntuación local de este mundo. |
| `verifiedScore` | Última puntuación aceptada por el servidor, o `null`. |
| `rank` | Posición en la clasificación del modo, o `null`. |
| `stats` | `{ exploredCells, biomesDiscovered, oresMined, blocksBuilt }` |
| `breakdown` | `{ exploration, biomes, mining, building, total }` |
| `status` | `idle`, `syncing`, `synced`, `offline` o `rejected`. |
| `snapshot()` | Todo lo anterior, más modo, mundo y jugador, congelado. |
| `getLeaderboard(limit)` | Promesa de `{ ok, entries: [{ position, playerId, name, score, achievedAt }] }`. |
| `refreshStanding()` | Promesa de `{ ok, position, score }`. |

**Eventos en `game.events`** (para Frontend 1 y 2; la interfaz no calcula puntos):

| Evento | Datos |
|---|---|
| `scoreChanged` | `{ score, delta, reason, breakdown }`, con `reason` en `exploration`, `biome`, `ore`, `build` o `build-removed`. |
| `progressSynced` | `{ score, rank }` |
| `progressSyncFailed` | `{ reason, message }` |

### 4.2 API HTTP (`npm run server`)

| Método y ruta | Uso |
|---|---|
| `GET /api/health` | Estado del servidor. |
| `POST /api/players` `{ name }` | Crea un invitado → `{ playerId, token, name }`. |
| `GET /api/progress?mode=&world=` | Requiere token → `{ progress }` (`null` si no hay). |
| `PUT /api/progress` `{ mode, world, revision, state }` | Requiere token → `{ score, stats, revision, rank }`. |
| `GET /api/leaderboard?mode=&limit=` | Primeras posiciones (`limit` máximo 100). |
| `GET /api/leaderboard/players/:id?mode=` | Posición y mejor marca de un jugador (`position` es `null` si no tiene puntos). |

Errores: `{ error, message }`. Códigos: 400 pedido inválido, 401 token, 404 jugador inexistente, 409 revisión vieja (incluye `current`), 422 datos incoherentes, 429 ritmo excedido, 503 falla de la base.

### 4.3 Contrato de persistencia (para acordar con Backend 1)

`server/persistence/ProgressionRepository.js` define la interfaz:

- `createPlayer`
- `findPlayerById`
- `findPlayerByTokenHash`
- `getProgress`
- `saveProgress(progress, expectedRevision)`: escritura condicional más mejor marca, en una sola transacción.
- `topScores`
- `standingOf`

Las implementaciones son `MySqlProgressionRepository` e `InMemoryProgressionRepository` (tests). Si Backend 1 define otra persistencia, alcanza con implementar esta interfaz.

## 5. Tecnologías

| Pieza | Elección | Motivo |
|---|---|---|
| Base | MySQL 8 (probado también con MariaDB 10.11) | Pedido del equipo. |
| Driver | `mysql2` 3.24.5 | Única dependencia nueva; el navegador no puede hablar con MySQL. |
| Servidor | `node:http` | Sin frameworks: son seis rutas. |
| Desarrollo | Proxy de Vite `/api` → `127.0.0.1:3001` | El juego usa rutas relativas. |

## 6. Limitaciones y mejoras futuras

- Clasificación no resistente a trampas (ver sección 3).
- Sin cuentas: la identidad vive en el navegador; borrar los datos del sitio crea otro invitado.
- `POST /api/players` no tiene límite por IP: alguien podría crear muchos invitados. Conviene agregarlo al publicar el servidor.
- Si el servidor no está corriendo, el navegador registra un error de red al iniciar. El progreso se guarda localmente y se envía cuando el servidor vuelve.
- Mejoras posibles: vincular `account_id` con Backend 1, tablas por período, niveles como moneda cuando haya crafteo, y validación por servidor autoritativo si llega el multijugador.

## Fuentes

- [Steamworks: Leaderboards](https://partner.steamgames.com/doc/features/leaderboards)
- [Google Play Games Services: Leaderboards](https://developer.android.com/games/pgs/leaderboards)
- [Minecraft Wiki: Experience](https://minecraft.wiki/w/Experience)
