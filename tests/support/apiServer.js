import { ApiServer } from '../../server/http/ApiServer.js';
import { ProgressionService } from '../../server/progression/ProgressionService.js';
import { WorldVerifier } from '../../server/progression/WorldVerifier.js';
import { InMemoryProgressionRepository } from '../../server/persistence/InMemoryProgressionRepository.js';
import { InMemoryAccountRepository } from '../../server/persistence/InMemoryAccountRepository.js';
import { AccountService } from '../../server/accounts/AccountService.js';
import { AuthRoutes } from '../../server/http/AuthRoutes.js';
import { LoginThrottle } from '../../server/security/LoginThrottle.js';
import { PasswordHasher } from '../../src/users/PasswordHasher.js';
import { GameConfig } from '../../src/game/GameConfig.js';

/** Reloj controlable: los tests avanzan el tiempo sin esperar. */
export class FakeClock {
  constructor(now = 1_000_000) {
    this.now = now;
  }

  advanceMinutes(minutes) {
    this.now += minutes * 60_000;
  }

  read = () => this.now;
}

const silentLogger = { error() {} };

/** PBKDF2 con pocas iteraciones: el costo real no aporta nada en los tests y los haría lentos. */
const fastHasher = new PasswordHasher(globalThis.crypto, { ...GameConfig.users, PBKDF2_ITERATIONS: 1000 });

/** API real sobre HTTP en un puerto libre, con repositorios en memoria. */
export async function startTestApi({
  repository = new InMemoryProgressionRepository(),
  accountRepository = new InMemoryAccountRepository(),
  clock = new FakeClock(),
  throttle = new LoginThrottle()
} = {}) {
  const verifier = new WorldVerifier({ maxWidth: 256, maxHeight: 128, maxDepth: 256, cacheSize: 4 });
  const accounts = new AccountService(accountRepository, repository, { hasher: fastHasher, throttle, clock: clock.read, logger: silentLogger });
  const service = new ProgressionService(repository, verifier, { clock: clock.read, logger: silentLogger, sessions: accounts });
  const api = new ApiServer(service, { allowedOrigin: '*', logger: silentLogger, authRoutes: new AuthRoutes(accounts) });
  const port = await api.listen(0, '127.0.0.1');
  const origin = `http://127.0.0.1:${port}`;

  /** fetch que acepta rutas relativas, como el navegador detrás del proxy de Vite. */
  const fetchFn = (path, init) => fetch(`${origin}${path}`, init);

  async function call(method, path, { body, token } = {}) {
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers.Authorization = `Bearer ${token}`;
    const response = await fetchFn(`/api${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
    return { status: response.status, body: await response.json() };
  }

  return { api, service, accounts, repository, accountRepository, clock, origin, fetchFn, call, close: () => api.close() };
}
