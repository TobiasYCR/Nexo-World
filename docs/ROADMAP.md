# Hoja de ruta

Estado al cierre del proyecto (noviembre de 2026).

## Hecho

| Área | Qué hay |
|---|---|
| Movimiento | Colisiones por eje, gravedad, salto, escalones y suelo estable |
| Interacción | Raycast, resaltado, rotura progresiva por dureza, colocación sin encerrarse, hotbar que junta lo roto |
| Presentación | Texturas, hotbar e inventario, menú, pausa, configuración (todos los ajustes aplicados), controles, sonidos de romper, colocar y pasos, mano y efectos |
| Mundo | 96 × 96 por semilla, chato, con biomas, cuevas chicas, minerales y árboles; zona de construcción llana en el centro |
| Modos | Supervivencia (vida, daño por caída) y creativo (bloques sin límite, sin daño, vuelo con F) |
| Partidas | Crear con nombre, semilla y modo; guardar y cargar con el plano en curso |
| Render | Mallas por chunk con solo las caras visibles y caras iguales unidas (greedy meshing), armadas por cercanía y liberadas al alejarse; recorte por distancia y por cono de visión |
| Cuentas | Registro, sesión, perfil y recuperación por código de administrador, en MySQL |
| Puntuaciones | Puntos, niveles y clasificación por modo, validados por el servidor |
| Modo educativo | Planos ubicados en llano y armados por etapas, con guía 3D, sílabas y lectura en voz alta |
| Asistente | Chat de consultas sobre el juego y la partida, sin servicios externos |
| Diagnóstico | Panel F3 con rendimiento, jugador y mundo |

## Pendiente

- **Mundo grande:** generación por chunk a medida que el jugador avanza. Hoy el mundo es de tamaño fijo y se genera completo al empezar; las mallas ya se arman y liberan por distancia, así que el render está listo para mundos más grandes.
- **Asistente, etapa 2:** modelo de lenguaje con proxy en el servidor. Ver `docs/CHATBOT.md`; necesita aprobación del equipo y una clave de API.
- **Cuentas:** recuperación por correo, si algún día el juego se publica con un servidor de correo.
- **Más adelante:** crafteo, entidades, ciclo de día y noche, estructuras generadas y multijugador.
