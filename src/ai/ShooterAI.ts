import Phaser from 'phaser'
import type { AIBehavior } from './types'
import type { Enemy } from '../entities/Enemy'
import type { Player } from '../entities/Player'

const RETREAT_MARGIN = 20

/**
 * Mantiene distancia y dispara. Si está lejos del rango se acerca; si el
 * jugador se le acerca demasiado, retrocede; en rango óptimo, dispara.
 */
export class ShooterAI implements AIBehavior {
  private dir = new Phaser.Math.Vector2()

  update(enemy: Enemy, player: Player, time: number): void {
    if (player.isDead) {
      enemy.setVelocity(0, 0)
      return
    }

    const dist = Phaser.Math.Distance.Between(enemy.x, enemy.y, player.x, player.y)
    const range = enemy.def.shootRange ?? 90
    this.dir.set(player.x - enemy.x, player.y - enemy.y).normalize()

    if (dist > range) {
      // Acercarse al rango de tiro
      enemy.setVelocity(this.dir.x * enemy.speed, this.dir.y * enemy.speed)
    } else if (dist < range - RETREAT_MARGIN) {
      // Demasiado cerca: retroceder manteniendo la mira
      enemy.setVelocity(-this.dir.x * enemy.speed, -this.dir.y * enemy.speed)
      enemy.tryShoot(this.dir, time)
    } else {
      // En rango óptimo: plantarse y disparar
      enemy.setVelocity(0, 0)
      enemy.tryShoot(this.dir, time)
    }
  }
}
