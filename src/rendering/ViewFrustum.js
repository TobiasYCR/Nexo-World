/**
 * Pirámide de visión de la cámara, para no dibujar chunks que quedan atrás o
 * a los costados. Se arma con la posición, la dirección de la mirada, el
 * vector derecha (horizontal: la cámara no se inclina de costado), el campo de
 * visión vertical y la proporción de la pantalla.
 *
 * Cada plano guarda su normal hacia adentro: un punto está dentro si la
 * distancia con signo a los seis planos no es negativa.
 */
export class ViewFrustum {
  #planes = Array.from({ length: 6 }, () => ({ x: 0, y: 0, z: 0, d: 0 }));

  /**
   * @param {{x,y,z}} eye posición de la cámara
   * @param {{x,y,z}} forward dirección de la mirada (unitaria)
   * @param {{x,y,z}} right derecha horizontal (unitaria)
   * @param {number} fovDegrees campo de visión vertical
   * @param {number} aspect ancho / alto
   * @param {number} near
   * @param {number} far
   */
  update(eye, forward, right, fovDegrees, aspect, near, far) {
    // up = right × forward
    const up = {
      x: right.y * forward.z - right.z * forward.y,
      y: right.z * forward.x - right.x * forward.z,
      z: right.x * forward.y - right.y * forward.x
    };
    const tanV = Math.tan((fovDegrees * Math.PI) / 360);
    const tanH = tanV * aspect;

    const set = (plane, nx, ny, nz, point) => {
      const length = Math.hypot(nx, ny, nz) || 1;
      plane.x = nx / length;
      plane.y = ny / length;
      plane.z = nz / length;
      plane.d = plane.x * point.x + plane.y * point.y + plane.z * point.z;
    };
    const [left, rightPlane, bottom, top, nearPlane, farPlane] = this.#planes;
    set(left, right.x + forward.x * tanH, right.y + forward.y * tanH, right.z + forward.z * tanH, eye);
    set(rightPlane, forward.x * tanH - right.x, forward.y * tanH - right.y, forward.z * tanH - right.z, eye);
    set(bottom, up.x + forward.x * tanV, up.y + forward.y * tanV, up.z + forward.z * tanV, eye);
    set(top, forward.x * tanV - up.x, forward.y * tanV - up.y, forward.z * tanV - up.z, eye);
    set(nearPlane, forward.x, forward.y, forward.z, {
      x: eye.x + forward.x * near, y: eye.y + forward.y * near, z: eye.z + forward.z * near
    });
    set(farPlane, -forward.x, -forward.y, -forward.z, {
      x: eye.x + forward.x * far, y: eye.y + forward.y * far, z: eye.z + forward.z * far
    });
    return this;
  }

  /**
   * ¿La caja toca la pirámide? Prueba el vértice más "adentro" de la caja
   * contra cada plano: si ese queda afuera de alguno, la caja entera también.
   * @param {number} margin holgura en unidades de mundo (evita parpadeos en los bordes)
   */
  intersectsBox(minX, minY, minZ, maxX, maxY, maxZ, margin = 0) {
    for (const plane of this.#planes) {
      const px = plane.x >= 0 ? maxX : minX;
      const py = plane.y >= 0 ? maxY : minY;
      const pz = plane.z >= 0 ? maxZ : minZ;
      if (plane.x * px + plane.y * py + plane.z * pz - plane.d < -margin) return false;
    }
    return true;
  }
}
