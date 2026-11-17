import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { extname, join, normalize, resolve, sep } from 'node:path';

/** Tipos de archivo del build de Vite y de los assets del juego. */
const MIME_TYPES = Object.freeze({
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.wav': 'audio/wav',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.obj': 'text/plain; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8'
});

/**
 * Sirve el juego ya compilado (la carpeta dist de Vite) desde el mismo
 * servidor que la API: así en producción hay un solo servicio y el juego
 * llama a /api en su mismo dominio, sin CORS.
 *
 * - Nunca sale de la carpeta raíz (rutas con .. se rechazan).
 * - Los archivos con hash de Vite (/assets/…) se cachean un año; el resto, no.
 * - Una ruta sin extensión que no existe devuelve index.html.
 */
export class StaticFiles {
  /** @param {string} root carpeta a servir (por ejemplo, dist) */
  constructor(root) {
    this.root = resolve(root);
  }

  /** @returns {Promise<boolean>} true si existe la carpeta con un index.html */
  async isAvailable() {
    try {
      return (await stat(join(this.root, 'index.html'))).isFile();
    } catch {
      return false;
    }
  }

  /**
   * @param {import('node:http').IncomingMessage} request
   * @param {import('node:http').ServerResponse} response
   * @param {string} pathname
   * @returns {Promise<boolean>} true si respondió
   */
  async serve(request, response, pathname) {
    if (request.method !== 'GET' && request.method !== 'HEAD') return false;
    let decoded;
    try {
      decoded = decodeURIComponent(pathname);
    } catch {
      return false;
    }
    const relative = normalize(decoded).replace(/^([/\\])+/, '');
    const target = resolve(this.root, relative);
    if (target !== this.root && !target.startsWith(this.root + sep)) return false;

    const file = (await StaticFiles.#fileAt(target)) ?? (await StaticFiles.#fileAt(join(target, 'index.html')))
      ?? (extname(relative) === '' ? await StaticFiles.#fileAt(join(this.root, 'index.html')) : null);
    if (!file) return false;

    const hashed = relative.startsWith(`assets${sep}`) || relative.startsWith('assets/');
    response.writeHead(200, {
      'Content-Type': MIME_TYPES[extname(file.path).toLowerCase()] ?? 'application/octet-stream',
      'Content-Length': file.size,
      'Cache-Control': hashed ? 'public, max-age=31536000, immutable' : 'no-cache'
    });
    if (request.method === 'HEAD') {
      response.end();
      return true;
    }
    await new Promise((done, fail) => {
      createReadStream(file.path).on('error', fail).on('end', done).pipe(response);
    });
    return true;
  }

  static async #fileAt(path) {
    try {
      const info = await stat(path);
      return info.isFile() ? { path, size: info.size } : null;
    } catch {
      return null;
    }
  }
}
