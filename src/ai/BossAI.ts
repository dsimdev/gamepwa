import Phaser from 'phaser'
import type { AIBehavior } from './types'
import type { Enemy } from '../entities/Enemy'
import type { Player } from '../entities/Player'

const SPREAD = [-0.4, -0.2, 0, 0.2, 0.4] // offsets de ángulo del abanico

/**
 * Boss: persigue al jugador y periódicamente dispara un abanico de proyectiles
 * hacia él. Combina presión de melee (contacto) con zonas de proyectiles.
 */
export class BossAI implements AIBehavior {
  private dir = new Phaser.Math.Vector2()

  update(enemy: Enemy, player: Player, time: number): void {
    if (player.isDead) {
      enemy.setVelocity(0, 0)
      return
    }
    this.dir.set(player.x - enemy.x, player.y - enemy.y).normalize()
    enemy.setVelocity(this.dir.x * enemy.speed, this.dir.y * enemy.speed)

    const base = this.dir.angle()
    const dirs = SPREAD.map(off => new Phaser.Math.Vector2(Math.cos(base + off), Math.sin(base + off)))
    enemy.volley(dirs, time)
  }
}
