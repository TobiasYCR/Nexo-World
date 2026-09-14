import { GameConfig } from '../game/GameConfig.js';

/**
 * Integra la intención de movimiento del jugador en el tiempo y resuelve sus
 * colisiones contra el mundo. No decide qué movimiento pedir (eso es
 * PlayerController): traduce velocidad deseada en desplazamiento efectivo.
 */
export class PlayerPhysics {
  constructor(player, collisionSystem, config = GameConfig.player) {
    this.player = player;
    this.collisionSystem = collisionSystem;
    this.config = config;
  }

  update(deltaTime) {
    const player = this.player;
    const config = this.config;
    const wasOnGround = player.isOnGround;

    player.velocity.x = player.moveIntent.x * player.currentSpeed;
    player.velocity.z = player.moveIntent.z * player.currentSpeed;

    if (wasOnGround && player.wantsToJump) {
      player.velocity.y = config.JUMP_FORCE;
    } else {
      player.velocity.y += config.GRAVITY * deltaTime;
    }
    // Caída con velocidad límite: sin esto, a bajo framerate se atraviesa bloques.
    player.velocity.y = Math.max(player.velocity.y, -config.MAX_FALL_SPEED);

    const dx = player.velocity.x * deltaTime;
    const dy = player.velocity.y * deltaTime;
    const dz = player.velocity.z * deltaTime;

    let box = player.boundingBox;
    let result = this.collisionSystem.resolveMovement(box, dx, dy, dz, config.COLLISION_SKIN);

    // Asistencia de escalón: levantar, avanzar y volver a bajar. Solo funciona
    // cuando hay suelo sosteniendo y la barrera tiene altura de un desnivel.
    const tryingToMove = dx !== 0 || dz !== 0;
    if (tryingToMove && wasOnGround && (result.collided.x || result.collided.z)) {
      const stepped = this.#tryStepAssist(box.clone(), dx, dz, config);
      if (stepped) {
        box = stepped;
        player.isOnGround = true;
      }
    }

    player.position.set(
      (box.minX + box.maxX) / 2,
      box.minY,
      (box.minZ + box.maxZ) / 2
    );

    player.isOnGround = this.collisionSystem.isOnGround(box, config.GROUND_TOLERANCE);

    // Anular la velocidad en los ejes donde se chocó.
    if (result.collided.x) player.velocity.x = 0;
    if (result.collided.z) player.velocity.z = 0;
    if (result.collided.y) player.velocity.y = 0;
  }

  /**
   * Intenta subir un desnivel: eleva la caja STEP_HEIGHT, avanza y desciende.
   * Devuelve la caja final solo si el avance quedó despejado; si el muro es más
   * alto que el escalón, conserva la resolución original y desliza.
   */
  #tryStepAssist(box, dx, dz, config) {
    const skin = config.COLLISION_SKIN;
    const step = config.STEP_HEIGHT;

    const risen = this.collisionSystem.resolveMovement(box, 0, step, 0, skin);
    const over = this.collisionSystem.resolveMovement(risen.box, dx, 0, dz, skin);
    if (over.collided.x || over.collided.z) return null;
    const landed = this.collisionSystem.resolveMovement(over.box, 0, -step, 0, skin);
    return landed.box;
  }
}