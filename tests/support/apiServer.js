import { ApiServer } from '../../server/http/ApiServer.js';
import { ProgressionService } from '../../server/progression/ProgressionService.js';
import { WorldVerifier } from '../../server/progression/WorldVerifier.js';
import { InMemoryProgressionRepository } from '../../server/persistence/InMemoryProgressionRepository.js';

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

/** API real sobre HTTP en un puerto libre, con repositorio en memoria. */
export async function startTestApi({ repository = new InMemoryProgressionRepository(), clock = new FakeClock() } = {}) {
  const verifier = new WorldVerifier({ maxWidth: 256, maxHeight: 128, maxDepth: 256, cacheSize: 4 });
  const service = new ProgressionService(repository, verifier, { clock: clock.read, logger: silentLogger });
  const api = new ApiServer(service, { allowedOrigin: '*', logger: silentLogger });
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

  return { api, service, repository, clock, origin, fetchFn, call, close: () => api.close() };
}
