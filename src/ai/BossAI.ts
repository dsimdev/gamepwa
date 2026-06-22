import Phaser from 'phaser'
import type { AIBehavior } from './types'
import type { Enemy } from '../entities/Enemy'
import type { Player } from '../entities/Player'

const SPREAD = [-0.4, -0.2, 0, 0.2, 0.4] // offsets de ángulo del abanico
const LEASH_RANGE = 420  // si el jugador se aleja más de esto, el boss deja de perseguir

export class BossAI implements AIBehavior {
  private dir = new Phaser.Math.Vector2()
  private wanderDir = new Phaser.Math.Vector2(1, 0)
  private nextWanderAt = 0
  private nextVolleyAt = 0
  private readonly volleyDirs = SPREAD.map(() => new Phaser.Math.Vector2())

  update(enemy: Enemy, player: Player, time: number): void {
    if (player.isDead) {
      enemy.setVelocity(0, 0)
      return
    }

    const dist = Phaser.Math.Distance.Between(enemy.x, enemy.y, player.x, player.y)

    if (player.inSafeZone || dist > LEASH_RANGE) {
      if (time > this.nextWanderAt) {
        const angle = player.inSafeZone
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

    if (time >= this.nextVolleyAt) {
      const base = this.dir.angle()
      for (let i = 0; i < SPREAD.length; i++) {
        const a = base + SPREAD[i]
        this.volleyDirs[i].set(Math.cos(a), Math.sin(a))
      }
      enemy.volley(this.volleyDirs, time)
      this.nextVolleyAt = time + (enemy.def.shootCooldownMs ?? 1500)
    }
  }
}
