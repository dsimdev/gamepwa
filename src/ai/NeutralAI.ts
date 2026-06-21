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
      const dist = this.chaseDir.length()
      if (dist > 0.1) this.chaseDir.normalize()
      const sr = enemy.def.shootRange
      if (sr) {
        // Mob ranged provocado: mantiene distancia y dispara
        if (dist > sr) {
          enemy.setVelocity(this.chaseDir.x * enemy.speed, this.chaseDir.y * enemy.speed)
        } else if (dist < sr - 24) {
          enemy.setVelocity(-this.chaseDir.x * enemy.speed * 0.6, -this.chaseDir.y * enemy.speed * 0.6)
          enemy.tryShoot(this.chaseDir, time)
        } else {
          enemy.setVelocity(0, 0)
          enemy.tryShoot(this.chaseDir, time)
        }
      } else {
        // Mob melee provocado: perseguir
        enemy.setVelocity(this.chaseDir.x * enemy.speed, this.chaseDir.y * enemy.speed)
      }
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
