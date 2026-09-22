# Tarea — Frontend 1: Mano en primera persona y feedback de interacción

**Proyecto:** Nexo World
**Rol:** Frontend 1 (viewmodel y efectos visuales de interacción)
**Rama sugerida:** `feat/viewmodel`
**Punto de partida:** commit `536bcfd` en `main`

---

## 1. Objetivo

Que se vea qué estás por romper o colocar y que cada acción tenga respuesta visual: mano con el bloque en uso, contorno del bloque apuntado, grietas mientras se rompe y partículas al romper.

---

## 2. Archivos que te pertenecen

```
src/viewmodel/             (nuevo)
├── HandRenderer.js
├── BlockHighlight.js
├── BreakOverlay.js
├── BlockParticles.js
└── ViewBob.js
scripts/lib/CrackTextureFactory.js   (nuevo)
scripts/generate-cracks.js           (nuevo)
assets/textures/effects/             (nuevo: crack_0.png … crack_9.png)
src/game/GameConfig.js               (solo sección viewmodel, nueva)
```

**No toques:** `src/rendering/`, `src/world/`, `src/player/`, `src/game/Game.js` (el registro de overlays se lo pedís a Backend 2), `src/ui/`, `src/interface/`, `src/blocks/`.

---

## 3. Antes de escribir código

- Leé `Renderer`, `FirstPersonCamera.applyTo()` (usa `frustum()` para no invertir Y) y `BlockInteraction.targetedBlock`.
- Corré `npm test` y verificá que esté en verde.
- Mirá `scripts/generate-textures.js` y `scripts/lib/`: tu generador de grietas sigue el mismo patrón (PNG determinista, sin dependencias).
- Mientras no exista `renderer.addOverlay()` (Backend 1), prototipá llamando a tu `draw()` desde una rama local.

---

## 4. Alcance

Todo se dibuja con `renderer.addOverlay({ draw(p, camera) })`, después del mundo.

### 4.1 `BlockHighlight`
- Contorno del bloque apuntado: `noFill()`, `stroke` oscuro semitransparente, caja un 0,5 % más grande para evitar z-fighting.
- Sin bloque apuntado no dibuja nada.

### 4.2 `HandRenderer`
- Dibuja en espacio de cámara: `p.clearDepth()` y una cámara fija con el mismo `frustum` del juego, así la mano no atraviesa paredes.
- Slot con bloque: cubo chico con su textura, abajo a la derecha. Slot vacío: brazo.
- Swing (~0,25 s, ease-out) con los eventos `blockBroken` y `blockPlaced`; en bucle mientras se mantiene la rotura.
- Al cambiar de slot, la mano baja y sube con el bloque nuevo (~0,15 s).

### 4.3 `ViewBob`
- Balanceo de la mano (no de la cámara) proporcional a la velocidad horizontal, solo con `isOnGround`.

### 4.4 `BreakOverlay`
- 10 texturas de grieta 16×16 con alfa, generadas por `generate-cracks.js`.
- Sobre `breakingBlock` dibuja la etapa `floor(breakProgress × 10)` en las 6 caras.

### 4.5 `BlockParticles`
- Al romper, 12 a 16 cuadraditos con colores de la textura del bloque (o su `color`), gravedad y vida de ~0,6 s.
- Pool fijo `MAX_PARTICLES`, sin crear objetos por frame; si se llena, se reciclan las más viejas.

---

## 5. Reglas que no se negocian

- Estas clases solo leen estado y escuchan eventos: no modifican mundo, jugador ni hotbar.
- Todo valor ajustable (tamaños, duraciones, amplitudes) en `GameConfig.viewmodel`.
- Sin shaders propios. POO estricta: un archivo por clase.

---

## 6. Definición de terminado

- `npm test` en verde, con tests nuevos: curva de swing (inicio, pico, fin), etapa de grieta por progreso, tope y reciclado del pool, bob en cero quieto o en el aire, determinismo de `generate-cracks.js`.
- Costo agregado < 1 ms por frame con 64 partículas (medido con `performance.now()` en el PR).
- `npm run build` sin errores. Consola limpia.
- Commit con mensaje convencional (`feat: ...`).

**Testeo manual con `npm run dev`:**
1. Apuntar a un bloque muestra el contorno; mirando al cielo desaparece.
2. La mano muestra el bloque del slot activo y cambia con 1-9 o la rueda.
3. Romper y colocar hacen swing; mantener clic hace swing continuo y las grietas avanzan.
4. Al romper saltan partículas del color del bloque.
5. Pegado a una pared, la mano no se mete dentro del bloque.

---

## 7. Dependencias con el resto del equipo

- **Backend 1:** `renderer.addOverlay()`.
- **Backend 2:** eventos `blockBroken`/`blockPlaced`, `breakProgress`, `breakingBlock` y el registro de tus overlays en `Game`.
- **Frontend 2:** ambos leen `hotbar.selectedIndex`; no cambiar su semántica.

---

## 8. Fuera de alcance

Modelos 3D importados, skins, tercera persona, animación del cuerpo, iluminación propia de la mano.
