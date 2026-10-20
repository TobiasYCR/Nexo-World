# Investigación: persistencia de usuarios

Documento de la **issue #17 — Backend 1: investigación e implementación de base
de datos y persistencia de usuarios**.

---

## 1. Cómo persiste Nexo World hoy

Antes de elegir nada hay que mirar lo que ya existe. `src/persistence/`
guarda **partidas**, no cuentas:

| Clase | Rol |
|---|---|
| `SaveManager` | Guarda y carga partidas sobre `localStorage`. Nunca lanza: devuelve `SaveResult`. |
| `WorldSerializer` | Serializa los chunks del mundo. |
| `PlayerSerializer` | Serializa posición, salud e inventario del jugador. |
| `SaveResult` | Resultado con `{ok, reason, message}`: código estable para lógica, texto en español para la pantalla. |

Detalles que condicionan la decisión:

- **Todo vive en el navegador.** No hay servidor, ni build de backend, ni
  variables de entorno. El juego es estático: `vite build` produce archivos que
  se sirven tal cual.
- **El patrón de errores ya está definido.** Ninguna clase de persistencia
  lanza excepciones; devuelven un resultado. Cualquier sistema nuevo tiene que
  seguir esa forma o el código que lo consuma va a quedar inconsistente.
- **El almacenamiento se inyecta por constructor** (`new SaveManager(storage)`),
  lo que permite testear con un `MemoryStorage`. Es la convención a respetar.
- **`localStorage` puede no estar.** `SaveManager` maneja modo privado, cookies
  bloqueadas y cuota llena. Los mismos casos aplican a las cuentas.

---

## 2. Qué hay que guardar de cada usuario

El issue pide como mínimo identificador, nombre, datos de autenticación y
fechas de creación y actualización. Evaluando qué más corresponde:

| Campo | ¿Se incluye? | Por qué |
|---|---|---|
| `id` | Sí | Identificador estable. Las puntuaciones de Backend 2 y los guardados se asocian a esto, no al nombre: si alguien se renombra, no se le pierde el progreso. |
| `username` | Sí | Lo que el usuario eligió, con su capitalización. |
| `credential` | Sí | Objeto opaco con el hash, la sal, el algoritmo y las iteraciones. **Nunca la contraseña.** |
| `createdAt` / `updatedAt` | Sí | Pedidos por el issue. Sirven para auditoría y para ordenar listados. |
| Correo electrónico | **No** | No hay servidor que mande mails, así que no habilita nada (ni recuperar la cuenta, ni verificar). Guardar un dato personal que no se usa es exponerlo gratis. |
| Avatar, biografía, preferencias | **No** | Fuera del alcance del issue, y las preferencias ya viven en `SettingsStorage`. |
| Último inicio de sesión | **No** | Sería de Frontend 2, que es dueño del flujo de sesión. Agregarlo acá duplicaría su lógica. |

Decisión adicional: el nombre se guarda como lo escribió el usuario, pero la
**unicidad se evalúa sobre el nombre normalizado** (minúsculas, sin espacios en
los extremos). Sin esto, `Leandro` y `leandro` serían dos cuentas distintas y
cualquiera podría suplantar a otro con un cambio de mayúsculas.

---

## 3. Alternativas evaluadas

### 3.1 `localStorage`

Clave-valor sincrónico, ~5-10 MB por origen.

- **A favor:** ya se usa en el proyecto, cero dependencias, cero configuración, API trivial, testeable con un objeto en memoria.
- **En contra:** sincrónico (bloquea el hilo), solo strings, sin consultas ni índices, sin transacciones. Se borra si el usuario limpia los datos del navegador.
- **Costo:** $0. **Mantenimiento:** ninguno.

### 3.2 IndexedDB

Base de datos transaccional del navegador, cientos de MB.

- **A favor:** asincrónica, índices reales, transacciones, guarda objetos sin serializar a mano. Es la opción correcta si los datos crecen.
- **En contra:** API verbosa y basada en eventos; usarla con comodidad pide un envoltorio (propio o `idb`, una dependencia más). Mucha capacidad para lo que se necesita: un puñado de cuentas de pocos cientos de bytes.
- **Costo:** $0. **Mantenimiento:** bajo, pero más código propio.

### 3.3 Base de datos administrada (Firebase, Supabase, MongoDB Atlas)

- **A favor:** persistencia real del lado del servidor, datos compartidos entre dispositivos, autenticación **de verdad** (el servidor valida y el cliente no puede falsificarla), copias de respaldo.
- **En contra:** cambia la naturaleza del proyecto. Exige cuenta en un servicio, claves de API, reglas de seguridad, conexión a internet para jugar, y una dependencia grande en el bundle. El juego deja de ser estático. Además hay que gestionar datos personales de terceros, con lo que eso implica.
- **Costo:** capa gratuita suficiente hoy, pero con límites y riesgo de corte si el servicio cambia de política. **Mantenimiento:** alto (claves, reglas, actualizaciones del SDK, migraciones).

### 3.4 Backend propio (Node + SQLite/Postgres)

- **A favor:** control total, seguridad real, sin depender de terceros.
- **En contra:** hay que escribir, desplegar y mantener un servidor. Para un equipo de cuatro personas que está construyendo un motor de voxels, es un segundo proyecto entero.
- **Costo:** hosting. **Mantenimiento:** el más alto de todos.

### 3.5 Comparación

| | localStorage | IndexedDB | Administrada | Backend propio |
|---|---|---|---|---|
| Dependencias nuevas | 0 | 0 o 1 | 1 grande | proyecto aparte |
| Funciona sin internet | Sí | Sí | No | No |
| Seguridad real de credenciales | No | No | Sí | Sí |
| Datos entre dispositivos | No | No | Sí | Sí |
| Capacidad | ~5-10 MB | cientos de MB | ilimitada | ilimitada |
| Costo | $0 | $0 | gratis con límites | hosting |
| Encaja con el código actual | Total | Alta | Baja | Ninguna |

---

## 4. Decisión y justificación

**Se eligió `localStorage`, con la credencial derivada mediante PBKDF2-SHA-256
sobre Web Crypto.**

Las razones, en orden de peso:

1. **Es lo que el proyecto ya es.** Nexo World es un juego estático que corre
   entero en el navegador. Meter un servicio administrado no agrega una
   funcionalidad: cambia el proyecto, y esa es una decisión de equipo, no de un
   sector.
2. **El volumen no justifica otra cosa.** Una cuenta ocupa unos 300 bytes. Con
   10 MB de cuota caben miles. IndexedDB resolvería un problema de escala que
   no existe.
3. **Cero dependencias nuevas.** El issue pide evitarlas y `CONVENCIONES.md`
   también. PBKDF2 viene en Web Crypto; `bcrypt` o `argon2` obligarían a sumar
   un paquete o compilar WebAssembly.
4. **Encaja con el patrón existente.** El repositorio se construye igual que
   `SaveManager`: almacenamiento inyectado, nunca lanza, devuelve un resultado
   con código y mensaje.
5. **No cierra la puerta.** Toda la lógica de almacenamiento está detrás de
   `UserRepository`. Migrar a IndexedDB o a un servicio es reimplementar esa
   clase: `UserManager` y quien lo consuma no cambian.

### Por qué PBKDF2 y no un hash simple

`SHA-256` a secas se rompe con tablas precalculadas: la misma contraseña da
siempre el mismo hash. PBKDF2 agrega **sal** (dos cuentas con la misma
contraseña dan hashes distintos) y un **costo configurable** en iteraciones,
que encarece probar contraseñas por fuerza bruta.

Se usan **210.000 iteraciones**, la recomendación de OWASP para PBKDF2-SHA-256.
Medido en este equipo: **~42 ms por derivación**, imperceptible al iniciar
sesión y costoso a escala de millones de intentos.

La verificación usa la sal y las iteraciones **guardadas en cada registro**, no
las de la configuración actual. Así, si mañana se sube el costo, las cuentas
viejas siguen pudiendo entrar. Hay una prueba que lo cubre.

---

## 5. Modelo de datos

Dos tipos de clave, bajo un prefijo propio que no se cruza con el de las
partidas (`nexo-world:save:`):

```
nexo-world:user:<id>      una cuenta
nexo-world:users:index    { usernameKey -> id }
```

Las dos usan el mismo sobre, versionado por separado de su contenido:

```jsonc
{
  "format": "nexo-world-users",
  "dataVersion": 1,
  "payload": { /* la cuenta, o el índice */ }
}
```

Una cuenta:

```jsonc
{
  "id": "6c3ef466-533a-4a8d-bd8b-333a18675ac7",
  "username": "Leandro",
  "credential": {
    "algorithm": "PBKDF2-SHA-256",
    "iterations": 210000,
    "salt": "8FFebD+jGiuXiaIRequ/eg==",
    "hash": "fU4xpfjy..."
  },
  "createdAt": 1792495361278,
  "updatedAt": 1792495361278
}
```

El **índice** existe para resolver un nombre a un id sin recorrer todo el
almacenamiento, y para detectar nombres repetidos. Es un dato derivado: si se
daña, las cuentas siguen ahí.

---

## 6. Contratos públicos

El resto del juego usa **solo `UserManager`**. Nadie más toca el almacenamiento
ni las credenciales.

```js
import { UserManager } from './users/UserManager.js';

const users = new UserManager();

await users.register(username, password);                  // -> {ok, account}
await users.verifyCredentials(username, password);         // -> {ok, account}
await users.findByUsername(username);                      // -> {ok, account}
await users.findById(id);                                  // -> {ok, account}
await users.exists(username);                              // -> boolean
await users.listAccounts();                                // -> {ok, accounts}
await users.renameAccount(id, username);                   // -> {ok, account}
await users.changePassword(id, current, nueva);            // -> {ok, account}
await users.deleteAccount(id, password);                   // -> {ok}
users.isAvailable;                                         // -> boolean
```

`account` es siempre la **vista pública**: `{id, username, createdAt,
updatedAt}`. La credencial no sale nunca de `src/users/`.

### Dónde está el límite con cada sector

**Frontend 2 (inicio de sesión).** `verifyCredentials()` está acá porque la
credencial no sale de este módulo: nadie afuera puede comparar un hash que no
puede leer. Lo que **no** está acá, y es de Frontend 2: sesiones, tokens,
"usuario actual", pantallas de login y registro, y recordar quién entró.

**Backend 2 (puntuaciones y niveles).** Asocia sus datos al `id`, nunca al
nombre, que puede cambiar. `findById()` valida que la cuenta exista.

**Frontend 1.** Si necesita persistir conversaciones por usuario, usa el `id`
como clave en su propio espacio de nombres. Este módulo no guarda nada suyo.

---

## 7. Cómo se evita perder información

- **Prefijo propio.** Las cuentas no comparten ninguna clave con las partidas.
  Hay una prueba que registra, renombra y borra cuentas, y verifica que una
  partida guardada queda intacta.
- **Nada se migra automáticamente.** El sistema no lee, reescribe ni convierte
  guardados existentes. Las partidas de antes siguen cargando igual.
- **Escritura con rollback.** Registrar escribe primero la cuenta y después el
  índice. Si el índice falla (cuota llena), la cuenta recién escrita se borra:
  es mejor perder el registro que dejar una cuenta invisible, que ninguna
  búsqueda por nombre encontraría. Hay prueba.
- **Un registro dañado no arrastra al resto.** El índice filtra entradas
  inválidas en vez de rechazarse entero, y `listAccounts()` omite las cuentas
  ilegibles en lugar de fallar.
- **Versionado.** `dataVersion` permite detectar datos de una versión futura y
  rechazarlos con un motivo claro, en vez de malinterpretarlos.

---

## 8. Seguridad

Lo que se implementó:

- **Contraseñas nunca en texto plano.** PBKDF2 con sal de 16 bytes y 210.000
  iteraciones. Hay una prueba que vuelca todo el almacenamiento y verifica que
  la contraseña no aparece.
- **Comparación en tiempo constante.** Un `===` corta en el primer byte
  distinto, y esa diferencia de tiempo filtra cuántos bytes acertó quien
  prueba. La comparación recorre siempre todos los bytes.
- **Sin revelar qué cuentas existen.** Usuario inexistente y contraseña
  incorrecta devuelven el mismo motivo y el mismo mensaje. Hay prueba.
- **Validación de entrada.** Nombre entre 3 y 20 caracteres, solo letras,
  números, guion y guion bajo. Contraseña de 8 a 128 caracteres. El tope de la
  contraseña evita derivar PBKDF2 sobre una entrada enorme y colgar la pestaña.
- **Errores sin detalles internos.** `message` es para la pantalla y no
  menciona claves ni excepciones; `detail` lleva lo técnico y es para la
  consola. Hay prueba.
- **La credencial no sale del módulo.** `toPublicJSON()` es la única forma en la
  que una cuenta cruza el borde de `src/users/`.
- **Operaciones sensibles piden la contraseña.** Cambiarla y borrar la cuenta
  exigen la actual.

### Limitación importante, y hay que decirla

**Esto no es autenticación segura, y no puede serlo sin un servidor.**

Los datos están en `localStorage`, que el dueño del navegador puede leer y
**editar** con las herramientas de desarrollo. Quien tenga acceso a la máquina
puede reemplazar el hash de una cuenta por uno propio y entrar como ese
usuario. Ninguna cantidad de criptografía del lado del cliente lo evita: el
código que valida corre en la misma máquina que se quiere controlar.

Lo que el hash **sí** aporta, y no es poco: si alguien lee el almacenamiento,
no obtiene la contraseña en claro, que la persona probablemente reutilice en
otros sitios. Eso es una protección real para el usuario, aunque no proteja la
cuenta dentro del juego.

Conclusión práctica: este sistema sirve para **separar perfiles en una misma
máquina** (que cada uno tenga su nombre, sus puntuaciones y su progreso). No
sirve como barrera de seguridad, y no debería usarse para proteger nada valioso
ni para un modo multijugador competitivo. El día que el juego necesite eso,
hace falta un servidor, y la migración es reimplementar `UserRepository`
contra una API.

---

## 9. Pruebas

33 pruebas en `tests/users.test.js`, con las 220 existentes sin tocar
(253 en total, todas en verde). Cubren:

- Modelo completo e identificadores únicos.
- La credencial no aparece en la vista pública ni la contraseña en el almacenamiento.
- Sal efectiva: misma contraseña, hashes distintos.
- No se distingue usuario inexistente de contraseña incorrecta.
- Credencial manipulada rechazada.
- Validación de nombres y contraseñas, incluidos tipos no string.
- Unicidad insensible a mayúsculas y espacios.
- Consulta por nombre y por id, renombrar, cambiar contraseña, borrar.
- `createdAt` se conserva y `updatedAt` cambia.
- Almacenamiento ausente, Web Crypto ausente, cuota llena, JSON dañado,
  versión incompatible, índice dañado.
- Rollback si falla la escritura del índice.
- Las partidas guardadas quedan intactas y los prefijos no se cruzan.
- Compatibilidad hacia atrás del costo de derivación.

---

## 10. Fuera de alcance

Según el issue, y confirmado en la implementación: pantallas de login y
registro, diseño de perfiles, sistema de niveles, cálculo de puntuaciones,
interfaz del chatbot, funcionalidades sociales, pagos y multijugador.

Tampoco se implementó recuperación de contraseña: sin servidor de correo no
hay forma de verificar que quien la pide es el dueño de la cuenta, y una
"pregunta secreta" guardada al lado del hash no agrega seguridad.
