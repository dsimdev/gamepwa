import Phaser from 'phaser'
import type { AIBehavior } from './types'
import type { Enemy } from '../entities/Enemy'
import type { Player } from '../entities/Player'

const SPREAD = [-0.4, -0.2, 0, 0.2, 0.4] // offsets de ángulo del abanico
const LEASH_RANGE = 420  // si el jugador se aleja más de esto, el boss deja de perseguir

/**
 * Boss: persigue al jugador y periódicamente dispara un abanico de proyectiles.
 * Si el jugador se aleja más de LEASH_RANGE, el boss abandona la persecución
 * y vuelve a vagar (evita que campee la zona de spawn del jugador).
 */
export class BossAI implements AIBehavior {
  private dir = new Phaser.Math.Vector2()
  private wanderDir = new Phaser.Math.Vector2(1, 0)
  private nextWanderAt = 0

  update(enemy: Enemy, player: Player, time: number): void {
    if (player.isDead) {
      enemy.setVelocity(0, 0)
      return
    }

    const dist = Phaser.Math.Distance.Between(enemy.x, enemy.y, player.x, player.y)

    if (player.inBase || dist > LEASH_RANGE) {
      // Jugador en base (indetectable) o demasiado lejos — vagar sin perseguir
      if (time > this.nextWanderAt) {
        // Si el jugador está en base: alejarse de donde está el sentinel (no campar)
        const angle = player.inBase
          ? Math.atan2(enemy.y - player.y, enemy.x - player.x) + (Math.random() - 0.5) * 1.2
          : Math.random() * Math.PI * 2
        this.wanderDir.set(Math.cos(angle), Math.sin(angle))
        this.nextWanderAt = time + 1800 + Math.random() * 1500
      }
      enemy.setVelocity(this.wanderDir.x * enemy.speed * 0.5, this.wanderDir.y * enemy.speed * 0.5)
      return
    }

    this.dir.set(player.x - enemy.x, player.y - enemy.y).normalize()
    enemy.setVelocity(this.dir.x * enemy.speed, this.dir.y * enemy.speed)

    const base = this.dir.angle()
    const dirs = SPREAD.map(off => new Phaser.Math.Vector2(Math.cos(base + off), Math.sin(base + off)))
    enemy.volley(dirs, time)
  }
}
