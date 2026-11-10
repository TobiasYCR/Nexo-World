/**
 * Comandos de administración que se corren en la máquina del servidor
 * (npm run admin -- <comando>). Separados de admin.js para poder probarlos.
 */
export class AdminCommands {
  static USAGE = [
    'Uso: npm run admin -- <comando>',
    '',
    'Comandos:',
    '  reset-password <usuario o correo>   genera un código de un solo uso para poner una contraseña nueva'
  ].join('\n');

  /**
   * @param {import('../accounts/AccountService.js').AccountService} accounts
   * @param {{log:Function, error:Function}} [output]
   */
  constructor(accounts, output = console) {
    this.accounts = accounts;
    this.output = output;
  }

  /**
   * @param {string[]} args argumentos después de "npm run admin --"
   * @returns {Promise<number>} código de salida
   */
  async run(args) {
    const [command, ...rest] = args;
    if (command === 'reset-password') return this.#resetPassword(rest.join(' '));
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
}
