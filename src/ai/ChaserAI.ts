import Phaser from 'phaser'
import type { AIBehavior } from './types'
import type { Enemy } from '../entities/Enemy'
import type { Player } from '../entities/Player'

/** Persigue al jugador en línea recta. */
export class ChaserAI implements AIBehavior {
  private dir = new Phaser.Math.Vector2()

  update(enemy: Enemy, player: Player): void {
    if (player.isDead) {
      enemy.setVelocity(0, 0)
      return
    }
    this.dir.set(player.x - enemy.x, player.y - enemy.y).normalize()
    enemy.setVelocity(this.dir.x * enemy.speed, this.dir.y * enemy.speed)
  }
}
