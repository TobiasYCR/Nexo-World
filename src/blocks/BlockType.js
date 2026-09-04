/**
 * Definición inmutable de una clase de bloque. Describe QUÉ es un bloque
 * (propiedades y apariencia), nunca dónde está ni cómo se dibuja.
 */
export class BlockType {
  constructor({
    id,
    name,
    solid = true,
    texture = null,
    /** Color de respaldo usado mientras la textura no está disponible. */
    color = [255, 255, 255],
    transparent = false,
    breakable = true,
    hardness = 1
  }) {
    if (!Number.isInteger(id) || id < 0) {
      throw new TypeError(`BlockType "${name}": id debe ser un entero >= 0.`);
    }
    if (!name) {
      throw new TypeError(`BlockType con id ${id}: name es obligatorio.`);
    }

    this.id = id;
    this.name = name;
    this.solid = solid;
    this.texture = texture;
    this.color = Object.freeze([...color]);
    this.transparent = transparent;
    this.breakable = breakable;
    this.hardness = hardness;

    Object.freeze(this);
  }

  /** Un bloque opaco tapa las caras vecinas y permite descartarlas al dibujar. */
  get isOpaque() {
    return this.solid && !this.transparent;
  }
}
