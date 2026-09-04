/**
 * Referencia a un bloque concreto del mundo: posición en la grilla más su tipo.
 * El mundo guarda solo ids por eficiencia; Block es el objeto que se pasa entre
 * sistemas (raycast, interacción, inventario) cuando hace falta contexto.
 */
export class Block {
  constructor(x, y, z, type) {
    this.x = x;
    this.y = y;
    this.z = z;
    this.type = type;
  }

  get id() {
    return this.type.id;
  }

  get isSolid() {
    return this.type.solid;
  }

  equalsPosition(x, y, z) {
    return this.x === x && this.y === y && this.z === z;
  }

  toString() {
    return `${this.type.name}(${this.x}, ${this.y}, ${this.z})`;
  }
}
