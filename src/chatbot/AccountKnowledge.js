import { ChatResponse } from './ChatResponse.js';
import { GameConfig } from '../game/GameConfig.js';

/**
 * Cuentas: cómo se registra un jugador, qué pasa con lo jugado como invitado y
 * para qué sirve iniciar sesión.
 *
 * El comportamiento no se escribe de memoria: sale de GameConfig.users y de
 * docs/PROGRESION.md §1.4, que es el contrato que implementan AuthService,
 * PlayerProgression y el servidor. Si AUTH_SOURCE cambia a 'local', la respuesta
 * también cambia, porque el lugar donde viven las cuentas es configuración.
 *
 * Esta clase no registra, no inicia sesión y no toca tokens: solo explica.
 */
export class AccountKnowledge {
  #config;

  /**
   * @param {Object} [options]
   * @param {Object} [options.config] GameConfig completo
   */
  constructor({ config = GameConfig } = {}) {
    this.#config = config;
  }

  /**
   * @param {string} intentId
   * @returns {Object|null}
   */
  answer(intentId) {
    const handlers = {
      'game.meta.account': () => this.#register(),
      'game.accounts.register': () => this.#register(),
      'game.accounts.guest': () => this.#guestProgress(),
      'game.accounts.session': () => this.#session()
    };
    return handlers[intentId]?.() ?? null;
  }

  #register() {
    const users = this.#config.users ?? {};
    const alcance = users.AUTH_SOURCE === 'local'
      ? 'Las cuentas quedan guardadas en este navegador, no en un servidor.'
      : 'La cuenta se guarda en el servidor del juego, con una contraseña protegida.';

    return ChatResponse.known(
      `Desde el menú principal podés crear una cuenta o entrar como invitado. El nombre de ` +
        `usuario tiene entre ${users.USERNAME_MIN_LENGTH} y ${users.USERNAME_MAX_LENGTH} ` +
        'caracteres, sin espacios: letras, números, guion y guion bajo. La contraseña tiene al ' +
        `menos ${users.PASSWORD_MIN_LENGTH} caracteres. ${alcance}`,
      ChatResponse.Topics.ACCOUNTS,
      'GameConfig.users + docs/PROGRESION.md §1.4'
    );
  }

  #guestProgress() {
    const users = this.#config.users ?? {};
    if (users.AUTH_SOURCE === 'local') {
      return ChatResponse.known(
        'En este navegador cada perfil guarda lo suyo. Si jugaste como invitado y después creás ' +
          'una cuenta, lo del invitado queda aparte: no se mezcla solo.',
        ChatResponse.Topics.ACCOUNTS,
        'GameConfig.users.AUTH_SOURCE + LocalAuthClient'
      );
    }

    return ChatResponse.known(
      'Si jugaste como invitado y después te registrás, tu progreso pasa a la cuenta cuando ese ' +
        'invitado todavía no es de nadie. Si iniciás sesión con una cuenta que ya tiene progreso, ' +
        'lo del invitado no se mezcla: cada uno conserva lo suyo. Y si la sesión vence, el juego ' +
        'sigue guardando como invitado en ese navegador.',
      ChatResponse.Topics.ACCOUNTS,
      'docs/PROGRESION.md §1.4 + src/auth/AuthService.js'
    );
  }

  #session() {
    const users = this.#config.users ?? {};
    if (users.AUTH_SOURCE === 'local') {
      return ChatResponse.known(
        'Iniciar sesión sirve para separar perfiles en esta máquina. Sin sesión jugás como ' +
          'invitado y el progreso queda en este navegador.',
        ChatResponse.Topics.ACCOUNTS,
        'GameConfig.users.AUTH_SOURCE + docs/PROGRESION.md §1.4'
      );
    }

    return ChatResponse.known(
      'Iniciar sesión sirve para que tu progreso quede en tu cuenta y no solo en este navegador. ' +
        'Sin sesión jugás como invitado: si borrás los datos del sitio y no tenés cuenta, perdés ' +
        'ese progreso. Con cuenta, el servidor lo conserva.',
      ChatResponse.Topics.ACCOUNTS,
      'docs/PROGRESION.md §1.4'
    );
  }
}
