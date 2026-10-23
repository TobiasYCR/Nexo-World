# Investigación de Arquitectura: Autenticación, Gestión de Sesiones e Identidad de Usuario en Nexo World

**Proyecto:** Nexo World  
**Rol:** Frontend 2 (Investigación, autenticación, gestión de sesiones e interfaz de usuarios)  
**Rama:** `feat/user-authentication`  
**Fecha:** Octubre 2026  
**Autor:** Gomez Bustamante, Gonzalo  

---

## 1. Introducción y Contexto

Nexo World es un videojuego voxel 3D en JavaScript inspirado en Minecraft. En las etapas anteriores se implementó la interfaz gráfica del juego (HUD, Hotbar en tiempo real, inventario creativo con buscador/categorías, menú de pausa, configuración gráfica y selección/creación de mundos locales).

Para dar un paso adelante en la evolución del juego, se requiere dotar a los jugadores de una **identidad propia**:
- Posibilidad de registrar una cuenta e iniciar sesión de forma segura.
- Gestión de sesiones persistentes que mantengan la identidad al recargar el navegador.
- Visualización y edición del perfil de usuario.
- Recuperación de acceso ante olvido de credenciales.
- Capacidad de asociar progresivamente partidas guardadas, puntuaciones y clasificaciones a la cuenta.
- Preservar la accesibilidad inmediata del juego mediante un **Modo Invitado (Guest Mode)** que garantice compatibilidad con partidas locales previas sin forzar al jugador a registrarse si solo desea explorar.

Como responsable de **Frontend 2**, el objetivo es diseñar la arquitectura de cliente, las pantallas visuales y los servicios de sesión, respetando estrictamente la separación de responsabilidades con **Backend 1** (persistencia de usuarios, verificación segura de credenciales y autorización) y **Backend 2** (puntuaciones y niveles).

---

## 2. Comparación de Mecanismos de Autenticación

Se analizaron tres grandes paradigmas de autenticación aplicables a una aplicación web y videojuego en navegador:

### 2.1 Autenticación Tradicional (Credenciales: Usuario/Email + Contraseña)
- **Mecanismo:** El usuario ingresa credenciales (identificador único + contraseña). El frontend envía la solicitud al backend por canal seguro (HTTPS). Backend 1 valida el hash criptográfico (e.g. Argon2 o bcrypt) y emite un token de sesión firmado (JWT o Bearer Session Token).
- **Ventajas:**
  - Control 100% propio del sistema y de los datos de usuario sin depender de terceros.
  - No requiere registrar aplicaciones en plataformas externas ni pagar cuotas.
  - Interfaz pixel art nativa completamente integrada en los menús de Nexo World.
  - Flujo conocido y comprensible para todos los jugadores.
- **Desventajas:**
  - Requiere gestionar de forma segura el almacenamiento de contraseñas (responsabilidad de Backend 1) y los flujos de recuperación de contraseñas.
  - El usuario debe recordar una contraseña específica.

### 2.2 Autenticación mediante Proveedores Externos (OAuth 2.0 / OpenID Connect: Google, GitHub, Discord)
- **Mecanismo:** El usuario hace clic en "Continuar con Google/Discord", se abre una ventana emergente o redirección hacia el proveedor, se autoriza y el proveedor devuelve un código que el backend canjea por la identidad del usuario.
- **Ventajas:**
  - No se almacenan contraseñas en el backend.
  - Inicio de sesión con 1 clic si el usuario ya tiene cuenta activa.
  - Proveedor resuelve la verificación en dos pasos y recuperación de cuentas.
- **Desventajas:**
  - **Fricción en videojuegos:** Redirigir la página o abrir popups rompe la inmersión del canvas 3D y la experiencia de pantalla completa o pointer lock.
  - **Dependencia y disponibilidad:** Si el proveedor cae o cambia sus políticas de API, los jugadores no pueden ingresar.
  - **Privacidad y cumplimiento:** Exige compartir identificadores y cumplir normativas de privacidad de terceros.
  - **Costos y configuración:** Requiere mantener credenciales de API (Client ID/Secrets), dominios verificados y cuotas de uso.

### 2.3 Autenticación sin Contraseña (Passwordless: Magic Links / Códigos OTP)
- **Mecanismo:** El usuario introduce su correo y recibe un enlace temporal o código de 6 dígitos que expira en pocos minutos para acceder.
- **Ventajas:**
  - No hay contraseñas que recordar ni robar.
  - Muy alta seguridad contra ataques de fuerza bruta comunes.
- **Desventajas:**
  - Depende críticamente de un servicio de envío de correos transaccionales (SMTP/SendGrid/Resend) con costos por mensaje y latencia de entrega (el jugador debe esperar varios segundos o minutos fuera del juego para recibir el correo).
  - Rompe el ritmo de juego para un sandbox interactivo.

### 2.4 Matriz Comparativa

| Criterio | Tradicional (Credenciales + Token) | Proveedores Externos (OAuth 2.0) | Sin Contraseña (Magic Link / OTP) |
|---|---|---|---|
| **Seguridad** | Alta (con hash seguro y JWT/Bearer) | Muy Alta (gestionada por proveedor) | Alta |
| **Facilidad de uso** | Alta (directo en el menú del juego) | Media (ventanas emergentes/redirección) | Baja (requiere salir al email) |
| **Complejidad de frontend** | Moderada (formularios nativos limpios) | Alta (gestión de popups/redirecciones) | Media |
| **Costos de infraestructura** | Nulos / Mínimos (API propia) | Nulos en capas gratuitas, pero dependiente | Medios/Altos (costos por envío de email) |
| **Mantenimiento** | Totalmente autónomo y estable | Requiere actualizar SDKs y políticas externas | Requiere monitoreo de entregabilidad de correo |
| **Compatibilidad con arquitectura** | 100% compatible con GameUiBridge y ScreenManager | Compleja integración con canvas WebGL | Compleja |
| **Recuperación de cuentas** | Flujo estándar por código/token de reseteo | Delegada al proveedor | Intrínseca |
| **Privacidad del jugador** | Máxima (solo datos estrictos del juego) | Media (asocia identidad corporativa/social) | Alta |
| **Experiencia in-game** | Inmersiva, integrada en estética pixel art | Rota por ventanas externas | Rota por espera de email |

---

## 3. Justificación de la Alternativa Elegida

Se selecciona la **Autenticación Tradicional basada en Credenciales y Tokens de Sesión (JWT / Bearer)**, complementada de forma obligatoria con un **Modo Invitado (Guest Mode)**.

**Razones fundamentales:**
1. **Inmersión y control estético:** Toda la experiencia de registro y login se dibuja dentro del contenedor `#ui-root` usando los componentes pixel art existentes (`Button`, `nx-card`, `Toast`), sin redirigir al jugador fuera del juego.
2. **Independencia técnica:** No introduce dependencias de proveedores externos ni costos por volumen de usuarios o envíos de correo.
3. **Compatibilidad con la arquitectura modular:** Encaja naturalmente en el modelo de Frontend 2, donde un servicio desacoplado (`AuthService`) consume contratos HTTP claros expuestos por Backend 1.
4. **Preservación del Modo Invitado:** Los jugadores pueden ingresar a explorar el mundo inmediatamente con un solo clic. Si deciden registrarse más adelante, se les ofrece la posibilidad de vincular sus partidas locales a su nueva cuenta sin perder el progreso.

---

## 4. Análisis de Costos, Infraestructura y Mantenimiento

- **Costos de licencia y consumo:** $0 USD. No se requiere contratar Auth0, Firebase Auth ni AWS Cognito. Backend 1 implementa endpoints REST livianos que pueden correr en cualquier servidor Node.js/Bun o base de datos relacional/documental.
- **Mantenimiento:** El código de frontend reside íntegramente en `src/auth/` y `src/interface/screens/`, sin librerías externas pesadas. La lógica es testeable en Node usando dobles de transporte HTTP (`fetchMock` / dobles de prueba sin librerías de terceros).

---

## 5. Evaluación de Privacidad y Seguridad

Siguiendo las reglas de oro del proyecto:
1. **Frontend no verifica credenciales por sí solo ni posee base de datos:** La validación de seguridad de la contraseña ocurre exclusivamente en Backend 1. Frontend solo realiza validaciones de formato (campos no vacíos, longitud mínima, coincidencia de contraseñas) para mejorar la usabilidad.
2. **Nunca almacenar contraseñas ni secretos en el cliente:** Las contraseñas viajan directamente en el cuerpo de la petición HTTPS a Backend 1 y se descartan inmediatamente de la memoria. En el almacenamiento local (`sessionStorage`/`localStorage`) **únicamente se guarda el token de sesión opaco o JWT** y los metadatos públicos del perfil (nombre, id).
3. **Protección contra ataques XSS y manipulación:**
   - La construcción de la interfaz utiliza `document.createElement()` y asignación segura con `textContent`, evitando concatenaciones peligrosas en `innerHTML` con datos de usuario.
   - Las sesiones tienen fecha de expiración (`expiresAt`).
4. **Respuestas de error seguras:**
   - En login y recuperación de contraseña, los mensajes de error son genéricos para evitar enumeración de usuarios (ej. *"Credenciales incorrectas"* en vez de *"La contraseña para juan@mail.com es errónea"*).
   - Los errores no exponen trazas de servidor ni detalles internos de la base de datos.
5. **No loguear datos sensibles:** Ni tokens, ni contraseñas, ni códigos de recuperación se imprimen en `console.log`.

---

## 6. Decisión sobre el Modo Invitado (Guest Mode)

**Aprobado de forma unánime.**

### Principios del Modo Invitado:
- **No barrera de entrada:** Un usuario que entra por primera vez a Nexo World puede presionar *"Jugar como Invitado"* y comenzar una partida de inmediato sin crear cuenta.
- **Identificación clara en la UI:** En el menú principal se muestra una insignia que indica *"Invitado (Modo Local)"*, junto con un botón discreto para *"Crear Cuenta / Iniciar Sesión"*.
- **Partidas locales garantizadas:** Las partidas del invitado se guardan en el `localStorage` con el prefijo local estándar `nexo-world:save:<slotName>`.
- **Transición suave:** Cuando el invitado decide registrarse o iniciar sesión, sus partidas locales anteriores continúan existiendo y se le permite asociarlas a su cuenta sin sobrescribir ni borrar datos sin confirmación.

---

## 7. Diseño del Sistema de Sesiones

### 7.1 Estados de Sesión (`SessionState`)
```
                  [Carga de la App]
                          │
          ┌───────────────┴───────────────┐
          ▼                               ▼
    ¿Hay token en Storage?            Sin token
          │                               │
     [Validar Token]                      │
    ┌─────┴─────┐                         │
  Válido     Expirado                     ▼
    │           │                  [MODO INVITADO]
    ▼           ▼                         │
[AUTENTICADO] [SESIÓN EXPIRADA]           │
    │                   │                 │
    │ (Logout)          │ (Login exitoso) │ (Login exitoso)
    └───────────┬───────┴─────────────────┘
                ▼
        [AUTENTICADO]
```

### 7.2 Persistencia de Sesión
- **Estrategia:** Se utiliza `localStorage` para recordar la sesión activa entre recargas (o `sessionStorage` si el usuario desmarca la opción "Recordarme").
- **Estructura almacenada:**
  ```json
  {
    "token": "eyJhbGciOiJIUzI1NiIsIn...",
    "expiresAt": 1792454400000,
    "user": {
      "id": "usr_94a82b",
      "username": "AlexVoxel",
      "email": "alex@ejemplo.com",
      "createdAt": 1729420000000
    }
  }
  ```
- **Detección de expiración:** `SessionManager` comprueba `Date.now() > session.expiresAt` antes de realizar operaciones autenticadas. Si el token expiró, limpia la sesión y emite `IntentBus.Events.AUTH_SESSION_EXPIRED`.

---

## 8. Contratos Públicos Acordados con Backend 1

Frontend 2 se comunica con Backend 1 a través de la clase cliente `BackendAuthClient`, que implementa la siguiente especificación HTTP REST:

### 8.1 Registro de Usuario
- **Ruta:** `POST /api/auth/register`
- **Request Body:**
  ```json
  {
    "username": "AlexVoxel",
    "email": "alex@ejemplo.com",
    "password": "Password123!"
  }
  ```
- **Response Exitosa (201 Created):**
  ```json
  {
    "ok": true,
    "token": "token_string",
    "expiresAt": 1792454400000,
    "user": {
      "id": "usr_94a82b",
      "username": "AlexVoxel",
      "email": "alex@ejemplo.com",
      "createdAt": 1729420000000
    }
  }
  ```
- **Response Error (400 Bad Request / 409 Conflict):**
  ```json
  {
    "ok": false,
    "code": "USER_ALREADY_EXISTS",
    "message": "El nombre de usuario o correo ya está en uso."
  }
  ```

### 8.2 Inicio de Sesión
- **Ruta:** `POST /api/auth/login`
- **Request Body:**
  ```json
  {
    "identifier": "AlexVoxel",
    "password": "Password123!"
  }
  ```
- **Response Exitosa (200 OK):**
  Mismo formato que registro con `token`, `expiresAt` y datos de `user`.
- **Response Error (401 Unauthorized):**
  ```json
  {
    "ok": false,
    "code": "INVALID_CREDENTIALS",
    "message": "Credenciales inválidas. Verifica tu usuario y contraseña."
  }
  ```

### 8.3 Cierre de Sesión e Invalidación
- **Ruta:** `POST /api/auth/logout`
- **Headers:** `Authorization: Bearer <token>`
- **Response (200 OK):** `{ "ok": true }`

### 8.4 Verificación de Sesión Activa
- **Ruta:** `GET /api/auth/session`
- **Headers:** `Authorization: Bearer <token>`
- **Response (200 OK):**
  ```json
  {
    "ok": true,
    "user": {
      "id": "usr_94a82b",
      "username": "AlexVoxel",
      "email": "alex@ejemplo.com",
      "createdAt": 1729420000000
    }
  }
  ```

### 8.5 Actualización de Perfil
- **Ruta:** `PUT /api/user/profile`
- **Headers:** `Authorization: Bearer <token>`
- **Request Body:**
  ```json
  {
    "username": "AlexNuevoNombre",
    "currentPassword": "Password123!",
    "newPassword": "NuevaPassword456!"
  }
  ```
- **Response (200 OK):** Datos actualizados del usuario.

### 8.6 Recuperación de Acceso
- **Ruta:** `POST /api/auth/recover-password`
- **Request Body:** `{ "email": "alex@ejemplo.com" }`
- **Response (200 OK):**
  ```json
  {
    "ok": true,
    "message": "Si la cuenta existe, se ha enviado un código de recuperación."
  }
  ```

---

## 9. Contratos con Backend 2 (Puntuaciones y Niveles)

Frontend 2 consulta las estadísticas de cuenta mediante un adaptador desacoplado:
- `getPersonalScore(userId)`: Devuelve la puntuación total acumulada.
- `getPlayerLevel(userId)`: Devuelve nivel actual y experiencia.
- `getLeaderboardRank(userId)`: Devuelve puesto en la tabla global.
Si Backend 2 aún no expone estos datos en el entorno activo, la UI muestra de manera controlada `N/D` o una etiqueta sutil de *"Próximamente"*, sin inventar valores falsos.

---

## 10. Estrategia de Compatibilidad con Partidas Guardadas

Para garantizar que ningún jugador pierda sus partidas previas creadas antes del sistema de login:
1. **Clave de guardado:**
   - Modo Invitado / Partida Local: `nexo-world:save:<slotName>` (la clave clásica).
   - Modo Usuario Autenticado: `nexo-world:save:<userId>:<slotName>`.
2. **Aislamiento entre usuarios:** Al cambiar de cuenta o cerrar sesión, la lista de mundos solo muestra las partidas asociadas al `userId` activo o las partidas locales generales cuando se juega como invitado.
3. **Migración opcional:** Cuando un jugador invitado se registra o inicia sesión, `WorldSelectionView` detecta si hay partidas locales huérfanas y le ofrece la opción de vincularlas a su cuenta mediante confirmación explícita.
