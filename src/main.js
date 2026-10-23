import p5 from 'p5';
import { Game } from './game/Game.js';
import { GameUiBridge } from './ui/GameUiBridge.js';

/** ?seed=123 en la URL genera un mundo reproducible con esa semilla. */
function seedFromUrl() {
  const raw = new URLSearchParams(window.location.search).get('seed');
  if (raw === null || raw.trim() === '') return undefined;
  const seed = Number(raw);
  return Number.isInteger(seed) ? seed : undefined;
}

/**
 * Punto de entrada. p5 se usa en modo instancia: no hay variables globales y el
 * sketch queda acotado a este archivo.
 *
 * draw() es solo el disparador del ciclo: toda la lógica vive en Game.
 */
const sketch = (p) => {
  let game = null;
  let uiBridge = null;

  p.setup = () => {
    const canvas = p.createCanvas(p.windowWidth, p.windowHeight, p.WEBGL);
    canvas.parent('game-root');

    game = new Game(p, undefined, { seed: seedFromUrl() });
    game.start(canvas.elt);

    if (game.hud) {
      uiBridge = new GameUiBridge(game, game.hud, game.hud.intentBus);
    }

    const { seed, version, totalMs } = game.worldGenerator.stats;
    console.info(`[Nexo World] mundo generado: semilla ${seed}, generador v${version}, ${totalMs.toFixed(1)} ms`);
  };

  p.draw = () => {
    if (!game) return;
    const deltaTimeSeconds = p.deltaTime / 1000;
    game.update(deltaTimeSeconds);
    game.render();
  };

  // Al cerrar o recargar la pestaña se envía el progreso pendiente sin esperar la respuesta.
  window.addEventListener('pagehide', () => game?.progression.flush({ keepalive: true }));

  p.windowResized = () => {
    game?.onResize(p.windowWidth, p.windowHeight);
  };
};

new p5(sketch);
