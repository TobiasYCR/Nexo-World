/**
 * Zona de construcción: un cuadrado totalmente llano de llanura en el centro
 * del mundo, donde aparece el jugador. Sin árboles ni cuevas, para poder
 * levantar los planos y cualquier construcción sin desniveles.
 *
 * Alrededor hay una franja de transición en la que la altura pasa poco a poco
 * del nivel de la zona al terreno natural, así no queda un escalón ni un pozo.
 *
 * Es código puro: no escribe en el mundo, solo corrige el plan de superficie
 * (alturas y biomas por columna) antes de generar.
 */
export class BuildZone {
  /**
   * @param {{ENABLED:boolean, RADIUS:number, BLEND:number, TREE_CLEARANCE:number, CAVE_CLEARANCE:number}} config
   * @param {number} width ancho del mundo, en bloques
   * @param {number} depth profundidad del mundo, en bloques
   * @param {number} level altura (y) de la superficie de la zona
   */
  constructor(config, width, depth, level) {
    this.enabled = Boolean(config?.ENABLED) && config.RADIUS >= 0;
    this.radius = config?.RADIUS ?? 0;
    this.blend = Math.max(0, config?.BLEND ?? 0);
    this.treeClearance = config?.TREE_CLEARANCE ?? 0;
    this.caveClearance = config?.CAVE_CLEARANCE ?? 0;
    this.centerX = Math.floor(width / 2);
    this.centerZ = Math.floor(depth / 2);
    this.level = level;
  }

  /** Distancia al borde del cuadrado llano: 0 adentro, bordes redondeados afuera. */
  distanceOutside(x, z) {
    const dx = Math.max(Math.abs(x - this.centerX) - this.radius, 0);
    const dz = Math.max(Math.abs(z - this.centerZ) - this.radius, 0);
    return Math.hypot(dx, dz);
  }

  /** true si la columna está en la zona llana o a menos de margin bloques de ella. */
  contains(x, z, margin = 0) {
    return this.enabled && this.distanceOutside(x, z) <= margin;
  }

  /** 1 en la zona, baja suave hasta 0 al terminar la franja de transición. */
  weight(x, z) {
    if (!this.enabled) return 0;
    const distance = this.distanceOutside(x, z);
    if (distance === 0) return 1;
    if (distance >= this.blend) return 0;
    const t = 1 - distance / this.blend;
    return t * t * (3 - 2 * t);
  }

  /** La columna queda sin árboles: ni troncos ni copas sobre la zona. */
  blocksTrees(x, z) {
    return this.contains(x, z, this.treeClearance);
  }

  /** La columna queda sin cuevas: se puede cavar cimientos sin caer a un hueco. */
  blocksCaves(x, z) {
    return this.contains(x, z, this.caveClearance);
  }

  /**
   * Corrige el plan de superficie en el lugar.
   * @param {Int16Array} heights altura por columna, indexada por z * width + x
   * @param {Uint8Array} biomeIds bioma por columna
   * @param {number} width
   * @param {number} depth
   * @param {number} flatBiomeId bioma de la zona (llanura)
   */
  apply(heights, biomeIds, width, depth, flatBiomeId) {
    if (!this.enabled) return;
    for (let z = 0; z < depth; z += 1) {
      for (let x = 0; x < width; x += 1) {
        const weight = this.weight(x, z);
        if (weight === 0) continue;
        const index = z * width + x;
        heights[index] = Math.round(this.level * weight + heights[index] * (1 - weight));
        if (weight === 1) biomeIds[index] = flatBiomeId;
      }
    }
  }
}
