import { GameConfig } from '../game/GameConfig.js';

/**
 * Integra la intención de movimiento del jugador en el tiempo.
 *
 * Estado actual: movimiento horizontal libre y gravedad con suelo plano de
 * seguridad. La resolución contra bloques queda delegada a CollisionSystem y se
 * conecta acá cuando la etapa de física esté implementada; por eso la clase ya
 * recibe el sistema de colisiones aunque todavía no resuelva penetraciones.
 */
export class PlayerPhysics {
  constructor(player, collisionSystem, config = GameConfig.player) {
    this.player = player;
    this.collisionSystem = collisionSystem;
    this.config = config;
    this.gravityEnabled = false;
  }

  update(deltaTime) {
    const player = this.player;
    const speed = player.currentSpeed;

    player.velocity.x = player.moveIntent.x * speed;
    player.velocity.z = player.moveIntent.z * speed;

    if (this.gravityEnabled) {
      player.velocity.y += this.config.GRAVITY * deltaTime;
      if (player.isOnGround && player.wantsToJump) {
        player.velocity.y = this.config.JUMP_FORCE;
      }
    } else {
      // Modo vuelo: útil para inspeccionar el mundo mientras no hay colisiones.
      player.velocity.y = player.wantsToJump ? speed : 0;
    }

    player.position.addScaled(player.velocity, deltaTime);
    player.isOnGround = this.collisionSystem.isOnGround(player.boundingBox);
  }
}
