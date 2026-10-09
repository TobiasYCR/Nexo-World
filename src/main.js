import p5 from 'p5';
import { Game } from './game/Game.js';
import { GameUiBridge } from './ui/GameUiBridge.js';

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

    game = new Game(p);
    game.start(canvas.elt);

    if (game.hud) {
      uiBridge = new GameUiBridge(game, game.hud, game.hud.intentBus);
    }
  };

  p.draw = () => {
    if (!game) return;
    const deltaTimeSeconds = p.deltaTime / 1000;
    game.update(deltaTimeSeconds);
    game.render();
  };

  p.windowResized = () => {
    game?.onResize(p.windowWidth, p.windowHeight);
  };
};

new p5(sketch);
