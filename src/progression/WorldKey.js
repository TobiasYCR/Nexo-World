/**
 * Identificador estable de un mundo generado: semilla, versión del generador y
 * dimensiones. Dos mundos con la misma clave son idénticos bloque a bloque, por
 * eso el progreso se registra por clave de mundo y el servidor puede regenerar
 * el mundo para validar lo que el cliente informa.
 *
 * Formato: s<semilla>-v<versión>-<ancho>x<alto>x<profundidad>
 */
export class WorldKey {
  static #PATTERN = /^s(\d{1,10})-v(\d{1,4})-(\d{1,4})x(\d{1,4})x(\d{1,4})$/;
  static MAX_LENGTH = 48;

  static of({ seed, version, width, height, depth }) {
    return `s${seed >>> 0}-v${version}-${width}x${height}x${depth}`;
  }

  /** Clave del mundo que produjo un generador sobre un World concreto. */
  static fromGenerator(generator, world) {
    return WorldKey.of({ ...generator.signature, width: world.width, height: world.height, depth: world.depth });
  }

  /** @returns {{seed:number, version:number, width:number, height:number, depth:number}|null} */
  static parse(key) {
    if (typeof key !== 'string' || key.length > WorldKey.MAX_LENGTH) return null;
    const match = WorldKey.#PATTERN.exec(key);
    if (!match) return null;
    const [seed, version, width, height, depth] = match.slice(1).map(Number);
    if (seed > 0xffffffff) return null;
    return { seed, version, width, height, depth };
  }
}
