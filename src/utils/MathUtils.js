/** Utilidades numéricas sin dependencias de p5, reutilizables desde tests. */
export class MathUtils {
  static clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  static lerp(from, to, t) {
    return from + (to - from) * t;
  }

  static degToRad(degrees) {
    return (degrees * Math.PI) / 180;
  }

  static radToDeg(radians) {
    return (radians * 180) / Math.PI;
  }

  /** División entera hacia abajo, correcta también para negativos. */
  static floorDiv(value, divisor) {
    return Math.floor(value / divisor);
  }

  /** Módulo siempre positivo: necesario para mapear coordenadas globales a locales. */
  static mod(value, divisor) {
    return ((value % divisor) + divisor) % divisor;
  }

  static roundTo(value, decimals = 2) {
    const factor = 10 ** decimals;
    return Math.round(value * factor) / factor;
  }
}
