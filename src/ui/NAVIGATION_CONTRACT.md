# Contrato de navegación — para Frontend 2

Decisión (issue #3, sección 4.5): el enum de pantallas, el bus de intenciones
y la clase base de pantalla viven en `src/ui/navigation/`, dentro de mi
carpeta. Frontend 2 los importa desde ahí; no dupliquen el enum ni el bus en
`src/interface/`.

## Piezas

- `ScreenId.js` — enum de pantallas: `MENU, SETTINGS, CONTROLS, INVENTORY,
  PLAYING, PAUSE`. `PLAYING` no es una pantalla con contenido: representa
  "sin overlay" (el HUD in-game a secas).
- `UIIntent.js` — enum de intenciones que cualquier pantalla puede emitir:
  `PLAY, RESUME, OPEN_SETTINGS, OPEN_CONTROLS, OPEN_INVENTORY,
  RETURN_TO_MENU, BACK`.
- `IntentBus.js` — `on(intent, handler)`, `off(intent, handler)`,
  `emit(intent, payload)`. Una pantalla emite, nunca escucha ni conoce quién
  la escucha.
- `Screen.js` — clase base abstracta. Ciclo de vida: `mount(container)`
  construye el DOM una sola vez, `show()` / `hide()` solo alternan
  visibilidad. Extenderla e implementar `build()` (arma el DOM) y, si hace
  falta, `onShow()` / `onHide()`.
- `ScreenManager.js` — `register(screen)`, `goTo(id)`, `back()` (vuelve a la
  anterior), getters `activeId` / `previousId`. Una sola instancia vive en
  `HUD`.

## Cómo se registra una pantalla nueva

```js
import { Screen } from '../ui/navigation/Screen.js';
import { ScreenId } from '../ui/navigation/ScreenId.js';
import { UIIntent } from '../ui/navigation/UIIntent.js';

export class SettingsScreen extends Screen {
  constructor(intentBus) {
    super(ScreenId.SETTINGS);
    this.intentBus = intentBus;
  }

  build() {
    // armar el DOM acá, una sola vez
    // ...
    // para volver: this.intentBus.emit(UIIntent.BACK);
  }
}
```

Hoy `HUD` registra un `PlaceholderScreen` para `SETTINGS` y `CONTROLS`
(`src/ui/screens/PlaceholderScreen.js`). Para reemplazarlo: en
`HUD.js#registerScreens()`, cambiar la línea que registra el placeholder de
ese id por `screens.register(new SettingsScreen(this.intentBus))`. Es el
único lugar que hay que tocar, y queda fuera de `src/ui/`... en realidad
queda **dentro** de `src/ui/HUD.js`, así que avisame cuando tengan la
pantalla lista y hago yo el cambio de una línea (o lo hacemos juntos).

`INVENTORY` está en el enum pero todavía no tiene ninguna pantalla
registrada ni intención de apertura — queda para cuando se defina quién es
dueño de esa pantalla.

## Limitaciones conocidas / dependencias pendientes

- **No hay forma de pausar/reanudar el motor sin tocar `src/game/`.** Hoy
  `EngineBridge.js` (marcado como parche temporal) simula la tecla Escape ya
  mapeada para lograrlo, y observa `stats.state` que `Game.update()` ya le
  pasa a `HUD.update()` cada frame para saber cuándo el motor pausó por su
  cuenta. Cuando el motor escuche el `IntentBus` directamente, borrar
  `EngineBridge.js` y que los handlers de `PLAY`/`RESUME` en `HUD.js` emitan
  la intención real en vez de simular la tecla.
- **El mundo/jugador no se detienen mientras se ve el menú.** `Game.js`
  arranca en `RUNNING` y no sabe nada de pantallas; el menú solo lo tapa
  visualmente. Si hace falta pausar de verdad la simulación al mostrar el
  menú, es un cambio en `Game.js` (fuera de mi alcance) para que consulte al
  `ScreenManager` o escuche una intención `PLAY`/`OPEN_MENU`.
- **Hotbar sin datos reales.** `HotbarView.render(slots, selectedIndex)`
  existe y funciona, pero nadie la llama todavía: `Game.js` no expone el
  contenido del inventario. Hasta que Backend 1 lo haga, se ven 9 ranuras
  vacías.
- Pointer Lock se pide con `document.querySelector('#game-root canvas')`
  dentro de `EngineBridge.requestPointerLock()`, porque `HUD` no tiene una
  referencia directa al `InputManager` del motor.
