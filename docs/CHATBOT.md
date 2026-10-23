# Chat bot de consultas — investigación y propuesta

**Proyecto:** Nexo World · **Responsable:** Leandro Caballaro · **Rol:** Backend 1 (IA)
**Rama:** `research/chatbot` · **Estado:** investigación, nada integrado al juego

> Esta etapa **no integra nada**. El documento compara alternativas y propone una;
> la decisión la toma el equipo. Hay una prueba de concepto ejecutable en
> [`poc-chatbot/`](poc-chatbot/), fuera del código del juego.

---

## Resumen para el equipo

Lo que hay que decidir es si el bot **sabe** o **razona**, y de eso se desprende
todo lo demás.

La investigación da un resultado que no esperaba: **la mayoría de las preguntas
de un jugador ya tienen la respuesta escrita en el código del juego**. Los
controles están en `GameConfig.input.KEY_BINDINGS`, la dureza y los drops de
cada bloque en `BlockRegistry`, las profundidades de los minerales en
`GameConfig.ores`, la vida y el daño por caída en `GameConfig.survival`. No hay
que redactar un manual: hay que leer la configuración.

Eso cambia la comparación. Un bot de reglas que consulta esa configuración no es
la opción "pobre": es la única que **no se desactualiza**, porque si alguien
remapea una tecla la respuesta cambia sola. Lo verifiqué: remapeé el salto de
`Space` a `J` y el bot pasó a contestar "J" sin tocar una línea suya.

**Propuesta: dos etapas.** Primero un bot de reglas sobre los datos del juego
—sin costo, sin servidor, sin claves, funciona offline— que ya contesta 30 de
30 preguntas de prueba. Después, y solo si el equipo quiere respuestas abiertas,
un LLM detrás de un proxy mínimo, que **necesita trabajo de servidor de Tobias**
porque una clave de API no puede vivir en el cliente.

| | Etapa 1 (ahora) | Etapa 2 (si se aprueba) |
|---|---|---|
| Qué es | reglas sobre `GameConfig` + `BlockRegistry` | LLM (Claude Haiku 5.5) vía proxy |
| Costo | **US$0** | ~US$1,35 por cada 10.000 preguntas |
| Servidor | no hace falta | **sí, un proxy** |
| Offline | sí | no |
| Privacidad | los datos no salen del navegador | la pregunta sale a un tercero |
| Inventa | no (contesta o deriva) | puede, hay que acotarlo |

---

## 1. Qué preguntaría un jugador

### 1.1 Las preguntas

Partí de lo que el juego hoy tiene (bloques, biomas, cuevas, minerales,
supervivencia básica, guardado) y de lo que la gente le pregunta a un sandbox
de voxels. Salieron cinco familias:

| Familia | Ejemplos | Dónde está la respuesta |
|---|---|---|
| **Controles** | *¿cómo me muevo? ¿cuál es la tecla para saltar?* | `GameConfig.input.KEY_BINDINGS` |
| **Bloques** | *¿qué dureza tiene la piedra? ¿qué suelta si rompo hojas? ¿se puede romper el bedrock?* | `BlockRegistry` (`hardness`, `drops`, `breakable`, `transparent`) |
| **Minerales** | *¿a qué profundidad hay diamantes?* | `GameConfig.ores` |
| **Supervivencia** | *¿cuánta vida tengo? ¿desde qué altura me lastimo?* | `GameConfig.survival` |
| **Mundo** | *¿qué tamaño tiene el mundo? ¿cómo se guarda la partida?* | `GameConfig.world`, `.chunk`, `SaveManager` |
| **Estado actual** | *¿dónde estoy? ¿cuánta vida me queda?* | instancias vivas de `Player` y `World` |

### 1.2 Qué debería contestar y qué no

**Sí:** las seis familias de arriba. Son datos del juego, verificables y
estables entre partidas (salvo el estado actual, que es por partida).

**No, y conviene que lo diga en vez de improvisar:**

- **Mecánicas que el juego no tiene.** Encantamientos, Nether, crafteo,
  multijugador, mobs. Es el riesgo más concreto y lo medí (§4.1).
- **Fechas, hoja de ruta, decisiones del equipo.** No las sabe y cambian.
- **Credenciales, contraseñas, claves.** Ni las tiene ni debe hablar de ellas.
- **Cómo hacer trampa o romper el juego.**
- **Soporte comercial** (reembolsos, cuentas). No aplica a un proyecto educativo.

### 1.3 De dónde sale la información

Tres orígenes posibles, y la elección define la arquitectura:

1. **La configuración y los registros del juego, leídos en vivo.** Siempre
   actualizado por construcción. Cubre controles, bloques, minerales,
   supervivencia y mundo.
2. **El estado de la partida** (`Player`, `World`). Único origen posible para
   "¿dónde estoy?". Ningún LLM puede responderlo sin que se le pase el estado.
3. **Un texto escrito a mano** (manual, FAQ, documento para RAG). Es el único
   que cubre el *por qué* y las explicaciones largas — y el único que **se
   desactualiza en silencio**.

> Esto es lo central del documento: cuanto más se apoye el bot en (1) y (2),
> menos mantenimiento pide y menos miente. El (3) es inevitable para
> explicaciones, pero conviene que sea lo más chico posible.

---

## 2. Alternativas

De la más simple a la más completa. Ninguna estaba elegida de antemano; el
orden es de complejidad, no de preferencia.

### A. FAQ estática con buscador

Una lista de preguntas y respuestas en un `.json`, con un buscador por palabra
clave. No es un bot: es un `Ctrl+F` con estilo.

- **A favor:** trivial de hacer, cero costo, offline, nadie se confunde sobre lo que hace.
- **En contra:** no entiende reformulaciones ("¿cómo salto?" vs "tecla de salto"); hay que escribir y mantener cada respuesta a mano; se desactualiza.

### B. Bot de reglas con similitud de texto

Normalización, tokenizado, *stemming* y métricas de similitud (Levenshtein,
coseno, n-gramas) para mapear la pregunta a una intención, con respuestas
preescritas.

- **A favor:** entiende reformulaciones y tolera errores de tipeo; offline; sin costo; predecible y auditable.
- **En contra:** las respuestas siguen escritas a mano; cada tema nuevo es una entrada nueva; no explica nada que no esté cargado.
- **Nota:** ya existe implementado y medido, ver §6.

### C. Bot de reglas sobre los datos del juego  ← *propuesta etapa 1*

Igual que B, pero las respuestas **se derivan de `GameConfig` y
`BlockRegistry`** en vez de escribirse. Puede además leer `Player` y `World`
para el estado actual.

- **A favor:** todo lo de B, y además **no se desactualiza**: cambiás una tecla y la respuesta cambia. Es la única alternativa que contesta "¿dónde estoy?". Cada respuesta puede citar su fuente, así que es auditable.
- **En contra:** no explica el *por qué* ni razona; cada familia de preguntas pide una regla; sigue necesitando una lista de lo que el juego *no* tiene.

### D. LLM vía API con el manual en el prompt

Se manda un manual del juego en el *system prompt* y la pregunta del jugador a
un modelo alojado (Claude, u otro).

- **A favor:** entiende cualquier formulación; explica y razona; conversa; poquísimo código.
- **En contra:** **exige un servidor** (§5.2); cuesta por pregunta; no funciona offline; la pregunta sale a un tercero; puede inventar; el manual se escribe y mantiene a mano.

### E. LLM vía API con recuperación (RAG)

Igual que D, pero en vez de mandar el manual completo se recupera el fragmento
relevante de los documentos del repo (`ARQUITECTURA.md`, este documento, el
código) y se manda solo eso.

- **A favor:** todo lo de D, con respuestas mejor fundadas y la posibilidad de citar el fragmento; escala a mucha más documentación.
- **En contra:** todo lo de D, más la infraestructura de indexado. Para un proyecto de este tamaño (el repo entero son ~180 archivos) **el manual completo entra en el prompt y RAG no resuelve ningún problema que hoy exista**.

### F. LLM corriendo en el navegador

Pesos del modelo descargados al cliente y ejecutados con WebGPU.

- **A favor:** sin costo por pregunta, sin servidor, sin claves, offline después de la primera descarga y con privacidad total.
- **En contra:** descarga inicial de cientos de MB a GB; requiere WebGPU y una GPU decente; compite por memoria y GPU **con el propio juego**, que ya usa WEBGL; los modelos que corren en el navegador son mucho más chicos y de peor calidad.
- ⚠️ **Sin verificar.** No pude acceder a las fuentes de esta opción desde el entorno donde trabajé (§8). Las cifras concretas —tamaños, soporte de navegadores— **hay que confirmarlas antes de considerarla en serio**. Las menciono para que la comparación esté completa, no como opción fundamentada.

---

## 3. Comparación según los criterios

Criterios del punto 2.3 del issue. `—` es que no aplica.

| Criterio | A · FAQ | B · Reglas | C · Reglas+datos | D · LLM API | E · LLM+RAG | F · LLM local |
|---|---|---|---|---|---|---|
| **Calidad de respuesta** | baja | media | media-alta en su dominio | alta | alta | baja-media |
| **Cubre reformulaciones** | no | sí | sí | sí | sí | sí |
| **Explica el *por qué*** | solo si está escrito | solo si está escrito | no | **sí** | **sí** | sí |
| **Contesta el estado de la partida** | no | no | **sí** | solo si se le pasa | solo si se le pasa | solo si se le pasa |
| **Costo** | US$0 | US$0 | **US$0** | ~US$1,35/10k preg. (Haiku 5.5) | igual + indexado | US$0 (descarga grande) |
| **Latencia** | instantánea | instantánea | **instantánea (<1 ms)** | cientos de ms a segundos | ídem + recuperación | segundos, según GPU |
| **Funciona offline** | **sí** | **sí** | **sí** | no | no | sí, tras descargar |
| **Privacidad** | **total** | **total** | **total** | la pregunta sale a un tercero | ídem | **total** |
| **Requiere servidor** | **no** | **no** | **no** | **sí (proxy)** | **sí (proxy + índice)** | no |
| **Mantenimiento** | alto (todo a mano) | alto (todo a mano) | **bajo** | medio (manual + proxy) | alto (manual + índice + proxy) | medio |
| **Se actualiza con el juego** | no, a mano | no, a mano | **automático** | no, a mano | no, a mano | no, a mano |
| **Puede inventar** | no | no | no | **sí** | sí, menos | **sí, más** |

### Costo de la opción LLM, con números

Precios verificados el 23/10/2026 en la documentación de Anthropic (§8).
Escenario: manual de 4.000 tokens en el *system prompt* **con caché de prompt**,
200 tokens nuevos por pregunta y 150 de respuesta.

| Modelo | Por pregunta | Sesión de 20 preguntas | 10.000 preguntas |
|---|---|---|---|
| **Claude Haiku 5.5** | US$0,000135 (0,014 ¢) | US$0,0027 | **US$1,35** |
| Claude Sonnet 5.5 | US$0,0023 (0,23 ¢) | US$0,046 | US$23,00 |
| Claude Opus 5.5 | US$0,0046 (0,46 ¢) | US$0,092 | US$46,00 |

Tres cosas que importan de esta tabla:

- **El costo no es el obstáculo.** US$1,35 por 10.000 preguntas con Haiku 5.5 es
  despreciable para un proyecto de facultad. Quien diga "un LLM es carísimo" no
  miró los precios del modelo chico.
- **La caché de prompt es lo que lo hace barato.** Sin ella, los 4.000 tokens del
  manual se pagan completos en cada pregunta. Las lecturas de caché cuestan 0,05×
  el precio de entrada en Opus 5.5 y Sonnet 5.5.
- **El obstáculo real es el servidor**, no la plata (§5.2).

---

## 4. Riesgos

### 4.1 Respuestas incorrectas o inventadas — *medido*

El riesgo principal, y no es teórico. Lo encontré en mi propia prueba de
concepto, que es un bot de reglas sin nada de IA:

> **Pregunta:** *¿qué encantamientos puedo poner en la pica de diamante?*
> **Respuesta:** *"Mineral de diamante aparece entre las alturas Y=1 y Y=9, en
> vetas de 2 a 4 bloques."*

El bot reconoció "diamante", ignoró el resto de la pregunta y contestó un dato
correcto sobre **otra** pregunta, con total seguridad. Nexo World no tiene
encantamientos.

Lo mismo, pero peor, le pasa a un LLM: Nexo World se parece a Minecraft, así que
un modelo al que le preguntan por encantamientos **completa con lo que sabe de
Minecraft** y suena convincente. El jugador no tiene forma de distinguirlo.

**Mitigación, en orden de efectividad:**

1. **Lista explícita de lo que el juego NO tiene.** Es lo que arregló el caso de
   arriba: con `encantamiento` en la lista, el bot deriva. Pasó de 1 invento a
   0. Es la mitigación más barata y la más efectiva.
2. **Derivar es un acierto, no una falla.** Hay que medirlo como tal, y mi
   runner lo hace: *"no sabía y lo dijo"* cuenta como correcta.
3. **Respuestas derivadas de datos, no escritas.** Si el dato sale de
   `GameConfig`, no puede estar desactualizado.
4. **Citar la fuente.** La PoC devuelve de dónde sacó cada dato
   (`GameConfig.input.KEY_BINDINGS`). Con un LLM esto es mucho más difícil.
5. Con LLM: instrucción explícita de responder "no sé", temperatura baja y
   evaluación contra las preguntas de prueba antes de cada cambio de prompt.

### 4.2 Contenido inapropiado

Con reglas, imposible: el bot solo puede devolver texto que está en su código.

Con un LLM, hay que considerarlo. Los modelos traen filtros, pero el riesgo no
es cero y el público de un juego puede incluir menores. Mitigación: instrucción
de sistema acotando el dominio, y no reenviar la respuesta del modelo sin pasar
por el filtro de dominio del cliente.

### 4.3 Uso abusivo

Solo aplica a las opciones con servidor (D, E). Un endpoint abierto que llama a
un LLM pago es una factura esperando a que alguien la encuentre.

Mitigación: límite de pedidos por IP y por sesión en el proxy, tope de tokens
por pedido, y un presupuesto máximo mensual configurado en la consola del
proveedor. Esto es trabajo de servidor, de Tobias (§7).

### 4.4 Exposición de credenciales — *decisivo*

**Una clave de API no puede estar en el código del cliente.** Nexo World es un
sitio estático: todo lo que llega al navegador es público, incluidas las
variables de entorno que Vite inyecta en el build. Una clave ahí es una clave
publicada, y cualquiera puede gastarla.

Esto no es un riesgo a mitigar: es una **restricción de arquitectura**. Las
opciones D y E exigen un proxy en el servidor que guarde la clave y reciba los
pedidos del cliente. No hay atajo.

Las opciones A, B, C y F no tienen claves, así que no tienen este riesgo.

### 4.5 Dependencia de servicios externos

Con D o E, si el proveedor se cae, cambia precios, deprecia el modelo o corta
la capa gratuita, el bot deja de funcionar o empieza a costar distinto. Y el
juego deja de funcionar sin internet, cuando hoy funciona offline.

Mitigación: que el bot de reglas quede **adelante** y conteste lo que puede sin
salir a la red; el LLM solo para lo que las reglas no cubren. Así una caída
degrada el servicio en vez de romperlo.

---

## 5. Integración con la arquitectura actual

### 5.1 Dónde viviría

Siguiendo `CONVENCIONES.md` (una clase por archivo, dependencias por
constructor, config en `GameConfig`):

```
src/chatbot/
  ChatBot.js          orquesta los pasos y decide qué contesta
  GameKnowledge.js    consulta GameConfig, BlockRegistry, Player y World
  IntentMatcher.js    mapea la pregunta a un tema (similitud de texto)
  AbsentMechanics.js  la lista de lo que el juego no tiene
  LlmClient.js        (solo etapa 2) habla con el proxy, nunca con la API
```

El bot **recibe** `World`, `Player`, `BlockRegistry` y `GameConfig` por
constructor. No los busca ni los importa por su cuenta, igual que el resto del
proyecto. Así `World` sigue sin saber que existe un chat bot, que es la regla
que el proyecto viene respetando con el renderizado.

### 5.2 Qué necesitaría del servidor

**Etapa 1: nada.** Es lo que la hace viable ya.

**Etapa 2: un proxy, y es el único trabajo de servidor que hace falta.** Un
endpoint que:

1. recibe la pregunta del cliente,
2. le agrega el *system prompt* del juego,
3. llama a la API con la clave, **que vive solo en el servidor**,
4. aplica límite de pedidos y tope de tokens,
5. devuelve la respuesta.

Sin esto, la etapa 2 no se puede hacer de forma segura. Es una conversación con
Tobias antes de prometerle nada al equipo (§7).

### 5.3 Cómo lo mostraría la interfaz

Esto es de Gonzalo (Frontend 2) y no lo defino acá. Lo que la investigación
deja como requisitos para esa etapa:

- El chat es **DOM sobre el canvas**, como el resto de la UI. No se dibuja en p5.
- Mientras el chat tiene el foco, **el teclado no debe mover al jugador**. `main`
  ya resolvió esto para los menús en el PR #21 (`UiStateManager`), así que el
  patrón existe.
- La respuesta puede tardar (etapa 2): hace falta un estado "escribiendo".
- Conviene mostrar la **fuente** del dato cuando la haya: es lo que vuelve
  auditable la respuesta y distingue un dato del juego de una opinión del modelo.

---

## 6. Prueba de concepto

Está en [`poc-chatbot/`](poc-chatbot/), **fuera de `src/`** porque el issue
prohíbe integrar nada todavía. No la toca el build (Vite parte de `index.html`)
ni las pruebas (`npm test` corre `tests/*.test.js`).

```bash
node docs/poc-chatbot/probar.js            # resumen
node docs/poc-chatbot/probar.js --detalle  # cada respuesta y su fuente
```

### Qué demuestra

**Resultado: 30 de 30 preguntas de prueba correctas, 0 inventos.**

```
contestadas bien:     23
derivadas bien:        7   (no sabía y lo dijo)
inventadas:            0
```

Pero el número no es lo importante. Lo importante es **cómo** las contesta:
`consultor.js` no tiene un solo dato escrito a mano. Todo sale de `GameConfig` y
`BlockRegistry` en vivo. Lo verifiqué remapeando el salto de `Space` a `J` en una
config de prueba:

```
config actual   -> "Te movés con W para avanzar, A para ir a la izquierda, ...
                    Para saltar, Space."
salto remapeado -> "Para saltar, J."
```

El bot no se tocó. **Ese es el argumento de toda la propuesta**: un manual
escrito a mano habría seguido diciendo "Space" y nadie se habría enterado.

### Un segundo hallazgo, por accidente

Escribiendo la PoC cometí exactamente el error que este documento critica. Para
contestar *"¿desde qué altura me hago daño al caer?"* hay que convertir el
umbral (que está en velocidad de impacto) a bloques, y **escribí la gravedad a
mano: 980**, el valor terrestre en cm/s². La respuesta daba *0,9 bloques*.

Nexo World usa `GRAVITY: -260`. El valor correcto son **3,5 bloques**, que es
justo lo que dice el comentario de `GameConfig.survival`. Al leer la gravedad de
la configuración en vez de escribirla, la respuesta pasó a coincidir sola.

Es un caso chico pero ilustra el riesgo mejor que cualquier argumento: un dato
escrito a mano estaba mal y sonaba perfectamente razonable. En un manual dentro
de un *system prompt* nadie lo habría notado.

### Antecedente

Hay un bot de reglas completo, con el motor de similitud de la alternativa B,
en [`github.com/LeandroCaballaro/chatbot`](https://github.com/LeandroCaballaro/chatbot).
Dos versiones del mismo bot —una desde cero sin dependencias y otra con
librerías (nlp.js, mathjs, Fuse.js)— comparadas contra la misma batería de 41
preguntas: **41/41 las dos**, 80 y 56 pruebas respectivamente. Sirve como
evidencia de que la alternativa B/C es realizable y de cuánto código pide.

De esa comparación sale un dato útil para esta decisión: la versión con
librerías usó la mitad del código propio (1.513 líneas contra 2.901), a cambio
de 81 paquetes y 64 MB de dependencias.

---

## 7. Propuesta recomendada

**Etapa 1 — bot de reglas sobre los datos del juego (alternativa C).** Ahora.

*Ventajas:* costo cero, sin servidor, sin claves, offline, privacidad total,
latencia nula, no se desactualiza, auditable, y es la única que contesta sobre
la partida en curso. Ya demostrada con 30/30.

*Desventajas:* no explica el *por qué* ni razona; cada familia de preguntas pide
una regla; hace falta mantener la lista de mecánicas ausentes.

*Qué haría falta:* las cinco clases de §5.1 sin `LlmClient`, la UI de Gonzalo, y
las preguntas de prueba como suite automática. Estimo que el motor es
comparable al de `src/users/` (unas 600 líneas con pruebas).

**Etapa 2 — LLM acotado detrás de un proxy (alternativa D), solo si el equipo lo
quiere.**

*Ventajas:* contesta cualquier formulación, explica, conversa.

*Desventajas:* exige servidor, cuesta (poco), rompe el offline, la pregunta sale
a un tercero y puede inventar.

*Qué haría falta:* **el proxy de Tobias** (§5.2), el *system prompt* del juego,
límites de uso y presupuesto, y correr las preguntas de prueba contra el modelo
antes de exponerlo. Con Haiku 5.5 y caché de prompt, ~US$1,35 por cada 10.000
preguntas.

**Cómo conviven.** Las reglas adelante, el LLM atrás: las reglas contestan lo
que saben (que es la mayoría, y gratis) y solo lo que no cubren va al modelo.
Eso baja el costo, mantiene el juego usable sin internet y acota lo que el LLM
puede inventar, porque los datos duros nunca pasan por él.

### Lo que NO recomiendo, y por qué

- **RAG (E):** el repo entero entra en un prompt. Agrega infraestructura sin
  resolver un problema que hoy exista. Tiene sentido si la documentación crece
  mucho.
- **LLM local (F):** competiría por GPU y memoria con el propio juego, que ya
  usa WEBGL. Además mis datos sobre esta opción están sin verificar (§8).
- **FAQ estática (A):** no entiende reformulaciones y todo se mantiene a mano.
  La C cuesta parecido y da bastante más.

---

## 8. Fuentes

**Consultadas y verificadas:**

- Precios de modelos, caché de prompt y descuento por lotes — documentación de
  Anthropic, `platform.claude.com/docs/en/about-claude/pricing`
  (consultado 23/10/2026). De ahí salen las cifras de §3: Haiku 5.5 US$0,10/US$0,50
  por millón de tokens de entrada/salida, Sonnet 5.5 US$2/US$10, Opus 5.5
  US$4/US$20; lecturas de caché a 0,05× el precio de entrada en Opus 5.5 y
  Sonnet 5.5; API de lotes con 50 % de descuento.
- Documentación de la API de Anthropic sobre caché de prompt y modelos —
  `platform.claude.com/docs/en/build-with-claude/prompt-caching` y
  `platform.claude.com/docs/en/about-claude/models/overview`.

**Fuentes primarias, el propio repositorio:**

- `src/game/GameConfig.js` — controles, mundo, minerales, supervivencia, inventario.
- `src/blocks/BlockRegistry.js` y `src/blocks/BlockType.js` — propiedades de bloques.
- `src/persistence/SaveManager.js` — guardado en `localStorage`.
- `docs/ARQUITECTURA.md` y `docs/CONVENCIONES.md` — restricciones de diseño de §5.1.
- `package.json`, `vite.config.js` — el juego es un sitio estático, base de §4.4.

**Mediciones propias:**

- `docs/poc-chatbot/` — 30/30 preguntas, 0 inventos; el caso de invento de §4.1,
  la verificación del remapeo de teclas y el error de la gravedad escrita a mano
  de §6.
- `github.com/LeandroCaballaro/chatbot` — bot de reglas en dos versiones, 41/41.

**No pude verificar:**

- **LLM en el navegador (alternativa F).** El entorno donde trabajé solo permite
  salida a `platform.claude.com`; los sitios de WebLLM y la documentación de
  WebGPU quedaron inaccesibles. Las afirmaciones de §2.F son cualitativas y
  **están sin fundamentar**. Si el equipo quiere considerar esa opción, hay que
  investigarla con acceso a esas fuentes.
- **Precios de otros proveedores de LLM.** Por lo mismo. La comparación de costo
  de §3 cubre un proveedor; si el equipo quiere comparar proveedores, falta ese
  relevamiento.

---

## 9. Preguntas de prueba

Las 30 preguntas están en [`poc-chatbot/preguntas.js`](poc-chatbot/preguntas.js),
ejecutables. Sirven para medir **cualquier** alternativa con la misma vara.

Cada una declara de dónde debería salir la respuesta y qué se espera:
`responde`, `deriva` (debería decir que no sabe) o `rechaza`.

| Categoría | Preguntas | Qué mide |
|---|---|---|
| Controles | 6 | lee `KEY_BINDINGS` o repite un manual |
| Bloques | 6 | lee `BlockRegistry` |
| Minerales | 3 | lee `GameConfig.ores` |
| Supervivencia | 2 | lee `GameConfig.survival` |
| Mundo | 3 | lee `GameConfig.world` y `.chunk` |
| Fuera de alcance | 3 | deriva en vez de improvisar |
| **Adversarias** | **7** | **si inventa, y si resiste inyección de instrucciones** |

Las siete adversarias son las que importan. Cinco preguntan por mecánicas que
Nexo World no tiene (Ender Dragon, Nether, encantamientos, multijugador,
domesticar un lobo): **un bot que las contesta está inventando**, casi seguro
copiando de Minecraft. Las otras dos intentan que el bot ignore sus
instrucciones o revele una clave.

**Cómo puntuar, y esto es importante:** "no sé" **cuenta como respuesta
correcta** cuando la pregunta no tenía respuesta. La métrica a minimizar no es
"preguntas sin contestar", es **inventos**.

---

## 10. Fuera de alcance

Según el issue, y respetado: no se integró el bot al juego, no se definió la
interfaz del chat, y no se tocó el servidor ni la base de datos.

`npm test` y `npm run build` siguen funcionando sin cambios: lo nuevo son dos
documentos y una carpeta en `docs/` que ni el build ni las pruebas levantan.

---

## 11. Qué necesito del equipo

- **Decisión:** ¿se aprueba la etapa 1? Es la que no depende de nadie más.
- **Tobias:** ¿hay intención de tener un servidor? Sin proxy no hay etapa 2, y
  conviene saberlo antes de diseñar pensando en él.
- **Gonzalo:** si la etapa 1 avanza, hablar de la UI del chat y del foco del
  teclado, que `UiStateManager` ya resuelve para los menús.
- **Todos:** revisar las preguntas de prueba. Si falta una que un jugador haría,
  agregarla ahora sale gratis; después es deuda.
