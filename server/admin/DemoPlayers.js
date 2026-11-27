import { randomBytes } from 'node:crypto';
import { GameConfig } from '../../src/game/GameConfig.js';
import { ProgressState } from '../../src/progression/ProgressState.js';
import { ScoreRules } from '../../src/progression/ScoreRules.js';
import { WorldKey } from '../../src/progression/WorldKey.js';
import { WorldGenerator } from '../../src/world/WorldGenerator.js';
import { BiomeIds } from '../../src/world/BiomeRegistry.js';
import { UserAccount } from '../../src/users/UserAccount.js';

/**
 * Jugadores de ejemplo para llenar la clasificación. Son cuentas reales
 * (pasan por AccountService.register, con su validación y su contraseña
 * cifrada) con un progreso coherente: el puntaje sale de ScoreRules a partir de
 * lo explorado, los biomas y lo construido, igual que el de un jugador real.
 *
 * Se reconocen por el dominio del correo (@nexo-world.test, reservado para
 * pruebas): remove() borra solo esas cuentas. La contraseña es aleatoria y no
 * se muestra; nadie inicia sesión con ellas.
 */
export class DemoPlayers {
  static EMAIL_DOMAIN = '@nexo-world.test';

  /** Nombre, modo, celdas exploradas, biomas pisados, bloques construidos y antigüedad en días. */
  static ROSTER = Object.freeze([
    ['lucia_mc', 'survival', 118, 4, 640, 21],
    ['mateo2010', 'survival', 96, 4, 410, 18],
    ['valen-crafter', 'creative', 72, 4, 1500, 16],
    ['sofi_builder', 'creative', 54, 3, 1820, 15],
    ['juanpi', 'survival', 88, 4, 260, 13],
    ['cami_rocks', 'survival', 64, 3, 330, 12],
    ['tomi_123', 'creative', 40, 3, 900, 10],
    ['agus_pixel', 'survival', 52, 3, 150, 9],
    ['martu-blocks', 'creative', 36, 2, 1120, 7],
    ['nico_minero', 'survival', 70, 4, 90, 6],
    ['flor_arq', 'creative', 30, 2, 760, 4],
    ['santi_dev', 'survival', 28, 2, 60, 2]
  ]);

  #accounts;
  #accountStore;
  #players;
  #rules;
  #clock;

  /**
   * @param {import('../accounts/AccountService.js').AccountService} accounts
   * @param {import('../persistence/AccountRepository.js').AccountRepository} accountStore
   * @param {import('../persistence/ProgressionRepository.js').ProgressionRepository} players
   */
  constructor(accounts, accountStore, players, { rules = new ScoreRules(), clock = Date.now } = {}) {
    this.#accounts = accounts;
    this.#accountStore = accountStore;
    this.#players = players;
    this.#rules = rules;
    this.#clock = clock;
  }

  /**
   * Crea los que falten (correrlo dos veces no duplica nada).
   * @param {number} [count] cuántos de la lista, desde el primero
   * @returns {Promise<{created:string[], skipped:string[], failed:{name:string, reason:string}[]}>}
   */
  async seed(count = DemoPlayers.ROSTER.length) {
    const report = { created: [], skipped: [], failed: [] };
    for (const entry of DemoPlayers.ROSTER.slice(0, count)) {
      const [name] = entry;
      if (await this.#accountStore.findAccountByLogin(UserAccount.normalizeUsername(name))) {
        report.skipped.push(name);
        continue;
      }
      const reason = await this.#create(entry);
      if (reason) report.failed.push({ name, reason });
      else report.created.push(name);
    }
    return report;
  }

  /** @returns {Promise<number>} cuántas cuentas de ejemplo se borraron */
  async remove() {
    const ids = await this.#accountStore.deleteAccountsByEmailSuffix(DemoPlayers.EMAIL_DOMAIN);
    await this.#players.deletePlayersOfAccounts(ids);
    return ids.length;
  }

  async #create([name, mode, cells, biomes, built, daysAgo]) {
    const registered = await this.#accounts.register({
      username: name,
      email: `${name}${DemoPlayers.EMAIL_DOMAIN}`,
      password: randomBytes(18).toString('base64url')
    }, { skipDomainCheck: true });
    if (!registered.ok) return registered.body?.code ?? 'register-failed';

    const account = await this.#accountStore.findAccountByLogin(UserAccount.normalizeUsername(name));
    const player = account && (await this.#players.findPlayerByAccountId(account.id));
    if (!player) return 'player-missing';

    const state = new ProgressState({
      explored: Array.from({ length: cells }, (_, index) => index),
      biomes: Object.values(BiomeIds).slice(0, biomes),
      blocksBuilt: built
    });
    const stats = state.stats();
    const { WORLD_WIDTH: width, WORLD_HEIGHT: height, WORLD_DEPTH: depth } = GameConfig.world;
    const seed = 1000 + DemoPlayers.ROSTER.findIndex(([other]) => other === name);
    const saved = await this.#players.saveProgress({
      playerId: player.id,
      mode,
      worldKey: WorldKey.of({ seed, version: WorldGenerator.VERSION, width, height, depth }),
      revision: 1,
      score: this.#rules.scoreOf(stats),
      stats,
      state: state.toJSON(),
      updatedAt: this.#clock() - daysAgo * 24 * 60 * 60 * 1000
    }, 0);
    return saved.ok ? null : 'progress-failed';
  }
}
