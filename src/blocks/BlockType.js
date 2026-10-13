/**
 * Definición inmutable de una clase de bloque. Describe QUÉ es un bloque
 * (propiedades y apariencia), nunca dónde está ni cómo se dibuja.
 *
 * Todo comportamiento particular (dureza, drops, opacidad, si se puede romper,
 * cómo lo trata la generación del mundo) se declara acá como propiedad: ningún
 * sistema compara ids para decidirlo.
 */
export class BlockType {
  constructor({
    id,
    name,
    label = name,
    solid = true,
    texture = null,
    textures = null,
    /** Color de respaldo usado mientras la textura no está disponible. */
    color = [255, 255, 255],
    transparent = false,
    /** Alternativa declarativa a transparent: isOpaque: false equivale a transparent: true. */
    isOpaque = undefined,
    breakable = true,
    /** Alias de breakable con el nombre del contrato de minería. */
    isBreakable = undefined,
    hardness = 1,
    drops = undefined,
    /** Terreno natural que las cuevas pueden excavar. Lo colocado después (árboles, construcciones) no lo es. */
    carvable = false,
    /** Roca que los minerales pueden reemplazar al generar vetas. */
    oreHost = false,
    /** Superficie sobre la que la generación puede plantar árboles. */
    sustainsTrees = false,
    /** Se entrega en la hotbar inicial de la partida. */
    starter = false
  }) {
    if (!Number.isInteger(id) || id < 0) {
      throw new TypeError(`BlockType "${name}": id debe ser un entero >= 0.`);
    }
    if (!name) {
      throw new TypeError(`BlockType con id ${id}: name es obligatorio.`);
    }

    this.id = id;
    this.name = name;
    this.label = label;
    this.solid = solid;
    this.texture = texture;
    this.textures = Object.freeze({
      top: textures?.top ?? texture,
      side: textures?.side ?? texture,
      bottom: textures?.bottom ?? texture
    });
    this.color = Object.freeze([...color]);
    this.transparent = isOpaque === undefined ? transparent : !isOpaque;
    this.breakable = isBreakable === undefined ? breakable : isBreakable;
    this.hardness = hardness;
    this.drops = Object.freeze(drops === undefined ? [id] : [...drops]);
    this.carvable = carvable;
    this.oreHost = oreHost;
    this.sustainsTrees = sustainsTrees;
    this.starter = starter;

    Object.freeze(this);
  }

  /** Un bloque opaco tapa las caras vecinas y permite descartarlas al dibujar. */
  get isOpaque() {
    return this.solid && !this.transparent;
  }

  get isBreakable() {
    return this.breakable;
  }
}
