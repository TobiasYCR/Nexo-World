# Hoja de ruta

Estado al cierre del proyecto (noviembre de 2026).

## Hecho

| Área | Qué hay |
|---|---|
| Movimiento | Colisiones por eje, gravedad, salto, escalones y suelo estable |
| Interacción | Raycast, resaltado, rotura progresiva por dureza, colocación sin encerrarse, hotbar que junta lo roto |
| Presentación | Texturas, hotbar e inventario, menú, pausa, configuración, controles, sonidos de romper y colocar, mano y efectos |
| Mundo | Generación por semilla con biomas, cuevas, minerales y árboles; aparición fuera de los árboles |
| Modos | Supervivencia (vida, daño por caída) y creativo (bloques sin límite, sin daño, vuelo con F) |
| Partidas | Crear con nombre, semilla y modo; guardar y cargar con el plano en curso |
| Render | Mallas por chunk con solo las caras visibles, reconstruidas cuando el chunk cambia; recorte por distancia de a chunk |
| Cuentas | Registro, sesión, perfil y recuperación por código de administrador, en MySQL |
| Puntuaciones | Puntos, niveles y clasificación por modo, validados por el servidor |
| Modo educativo | Planos con guía 3D, sílabas y lectura en voz alta |
| Asistente | Chat de consultas sobre el juego y la partida, sin servicios externos |
| Diagnóstico | Panel F3 con rendimiento, jugador y mundo |

## Pendiente

- **Mundo grande:** carga y descarga de chunks según la posición del jugador y generación por chunk. Hoy el mundo es de tamaño fijo y se genera completo al empezar.
- **Render:** recorte por volumen de visión (frustum), además del recorte por distancia.
- **Sonido:** pasos.
- **Asistente, etapa 2:** modelo de lenguaje con proxy en el servidor. Ver `docs/CHATBOT.md`; necesita aprobación del equipo y una clave de API.
- **Cuentas:** recuperación por correo, si algún día el juego se publica con un servidor de correo.
- **Más adelante:** crafteo, entidades, ciclo de día y noche, estructuras generadas y multijugador.
