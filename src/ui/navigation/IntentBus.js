/**
 * Bus de intenciones de la interfaz. Las pantallas emiten "qué quiso hacer
 * el usuario" (ver UIIntent.js) sin conocer al motor ni a otras pantallas.
 * Quien traduce la intención en una acción real (navegar, tocar el motor)
 * se suscribe acá; por ahora ese rol lo cumple HUD.
 */
export class IntentBus {
  #handlers = new Map();

  /** @returns {() => void} función para desuscribirse */
  on(intent, handler) {
    if (!this.#handlers.has(intent)) this.#handlers.set(intent, new Set());
    this.#handlers.get(intent).add(handler);
    return () => this.off(intent, handler);
  }

  off(intent, handler) {
    this.#handlers.get(intent)?.delete(handler);
  }

  emit(intent, payload) {
    for (const handler of this.#handlers.get(intent) ?? []) handler(payload);
  }
}
