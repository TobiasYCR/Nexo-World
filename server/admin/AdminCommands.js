import { DemoPlayers } from './DemoPlayers.js';
import { GameConfig } from '../../src/game/GameConfig.js';
import { UserAccount } from '../../src/users/UserAccount.js';
import { UserValidator } from '../../src/users/UserValidator.js';

/**
 * Comandos de administración que se corren en la máquina del servidor
 * (npm run admin -- <comando>). Separados de admin.js para poder probarlos.
 */
export class AdminCommands {
  static USAGE = [
    'Uso: npm run admin -- <comando>',
    '',
    'Comandos:',
    '  reset-password <usuario o correo>   genera un código de un solo uso para poner una contraseña nueva',
    '  usuario <usuario o correo>          muestra la cuenta, su jugador y sus puntajes, y revisa que estén bien',
    '  seed [cantidad]                     crea jugadores de ejemplo (correo @nexo-world.test) para la clasificación',
    '  unseed                              borra los jugadores de ejemplo'
  ].join('\n');

  /**
   * @param {import('../accounts/AccountService.js').AccountService} accounts
   * @param {{log:Function, error:Function}} [output]
   */
  constructor(accounts, output = console, { accountStore = null, players = null, clock = Date.now } = {}) {
    this.accounts = accounts;
    this.output = output;
    this.accountStore = accountStore;
    this.players = players;
    this.clock = clock;
  }

  /**
   * @param {string[]} args argumentos después de "npm run admin --"
   * @returns {Promise<number>} código de salida
   */
  async run(args) {
    const [command, ...rest] = args;
    if (command === 'reset-password') return this.#resetPassword(rest.join(' '));
    if (command === 'usuario') return this.#showUser(rest.join(' '));
    if (command === 'seed') return this.#seed(rest[0]);
    if (command === 'unseed') return this.#unseed();
    this.output.error(command ? `Comando desconocido: "${command}".\n\n${AdminCommands.USAGE}` : AdminCommands.USAGE);
    return 1;
  }

  async #resetPassword(identifier) {
    if (identifier.trim() === '') {
      this.output.error('Falta el usuario o el correo.\n\n' + AdminCommands.USAGE);
      return 1;
    }
    const result = await this.accounts.issueResetCode(identifier);
    if (!result.ok) {
      this.output.error(result.body.message);
      return 1;
    }
    const { code, expiresAt, username, email } = result.body;
    const expires = new Date(expiresAt).toLocaleString('es-AR', {
      day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false
    });
    this.output.log([
      `Código de recuperación para ${username} (${email}):`,
      '',
      `    ${code}`,
      '',
      `Vence el ${expires} hs. Sirve una sola vez; generar otro anula este.`,
      'En el juego: INICIAR SESIÓN → ¿Olvidaste tu contraseña? → usuario o correo, código y contraseña nueva.'
    ].join('\n'));
    return 0;
  }

  async #showUser(identifier) {
    if (identifier.trim() === '') {
      this.output.error('Falta el usuario o el correo.\n\n' + AdminCommands.USAGE);
      return 1;
    }
    const account = await this.accountStore.findAccountByLogin(UserAccount.normalizeUsername(identifier));
    if (!account) {
      this.output.error(`No hay ninguna cuenta con el usuario o correo "${identifier.trim()}".`);
      return 1;
    }
    const player = await this.players.findPlayerByAccountId(account.id);
    const validator = new UserValidator();
    const problems = [];
    if (validator.checkUsername(account.username)) problems.push('el nombre no cumple las reglas actuales');
    if (validator.checkEmail(account.email)) problems.push('el correo no cumple las reglas actuales');
    if (account.usernameKey !== UserAccount.normalizeUsername(account.username)) problems.push('la clave del nombre no coincide con el nombre');
    if (account.emailKey !== account.email.trim().toLowerCase()) problems.push('la clave del correo no coincide con el correo');
    if (!account.credential) problems.push('no tiene contraseña guardada');
    if (!player) problems.push('no tiene jugador para la clasificación (se crea al iniciar sesión)');
    else if (player.name !== account.username) problems.push(`el jugador se llama "${player.name}" y la cuenta "${account.username}"`);

    const lines = [
      `Usuario:  ${account.username}`,
      `Correo:   ${account.email}`,
      `Creada:   ${AdminCommands.#date(account.createdAt)}`,
      `Jugador:  ${player ? `${player.name} (${player.id})` : '—'}`
    ];
    if (player) {
      for (const mode of GameConfig.progression.MODES) {
        const standing = await this.players.standingOf(mode, player.id);
        lines.push(`  ${mode.padEnd(9)} ${standing ? `${standing.score} puntos, puesto ${standing.position}` : 'sin puntaje todavía'}`);
      }
    }
    lines.push('', problems.length ? `Problemas:\n${problems.map((problem) => `  - ${problem}`).join('\n')}` : 'Todo en orden.');
    this.output.log(lines.join('\n'));
    return problems.length ? 1 : 0;
  }

  async #seed(rawCount) {
    const max = DemoPlayers.ROSTER.length;
    const count = rawCount === undefined ? max : Number(rawCount);
    if (!Number.isInteger(count) || count < 1 || count > max) {
      this.output.error(`La cantidad tiene que ser un número entre 1 y ${max}.`);
      return 1;
    }
    const report = await this.#demo().seed(count);
    const lines = [`Creados: ${report.created.length ? report.created.join(', ') : 'ninguno'}`];
    if (report.skipped.length) lines.push(`Ya existían: ${report.skipped.join(', ')}`);
    for (const { name, reason } of report.failed) lines.push(`No se pudo crear ${name}: ${reason}`);
    this.output.log(lines.join('\n'));
    return report.failed.length ? 1 : 0;
  }

  async #unseed() {
    const removed = await this.#demo().remove();
    this.output.log(`Jugadores de ejemplo borrados: ${removed}.`);
    return 0;
  }

  #demo() {
    return new DemoPlayers(this.accounts, this.accountStore, this.players, { clock: this.clock });
  }

  static #date(ms) {
    return new Date(ms).toLocaleString('es-AR', {
      day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false
    });
  }
}
