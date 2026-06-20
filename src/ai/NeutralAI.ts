import Phaser from 'phaser'
import type { AIBehavior } from './types'
import type { Enemy } from '../entities/Enemy'
import type { Player } from '../entities/Player'

/** Vaga sin atacar. Si recibe daño (enemy.provoked = true) persigue al jugador. */
export class NeutralAI implements AIBehavior {
  private wanderDir = new Phaser.Math.Vector2(1, 0)
  private nextWanderAt = 0
  private chaseDir = new Phaser.Math.Vector2()

  update(enemy: Enemy, player: Player, time: number): void {
    if (enemy.provoked) {
      this.chaseDir.set(player.x - enemy.x, player.y - enemy.y)
      if (this.chaseDir.lengthSq() > 0) this.chaseDir.normalize()
      enemy.setVelocity(this.chaseDir.x * enemy.speed, this.chaseDir.y * enemy.speed)
      return
    }

    if (player.isDead) {
      enemy.setVelocity(0, 0)
      return
    }

    if (time > this.nextWanderAt) {
      const angle = Math.random() * Math.PI * 2
      this.wanderDir.set(Math.cos(angle), Math.sin(angle))
      this.nextWanderAt = time + 1500 + Math.random() * 2000
    }
    enemy.setVelocity(this.wanderDir.x * enemy.speed * 0.5, this.wanderDir.y * enemy.speed * 0.5)
  }
}
