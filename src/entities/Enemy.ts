import Phaser from 'phaser'
import { Resource } from '../components/Resource'
import { createBehavior } from '../ai'
import type { AIBehavior } from '../ai/types'
import type { EnemyDef } from '../data/enemies'
import type { EnemyContext, Damageable } from '../combat/types'
import type { Player } from './Player'

const KNOCKBACK = 80
const DEATH_MS = 180

export class Enemy extends Phaser.Physics.Arcade.Sprite implements Damageable {
  readonly def: EnemyDef
  readonly speed: number
  readonly contactDamage: number
  readonly xpReward: number
  health: Resource

  /** Callback al morir (la escena lo usa para otorgar XP). Se llama una sola vez. */
  onDeath?: (enemy: Enemy) => void

  private behavior: AIBehavior
  private context: EnemyContext
  private nextShotAt = 0
  private deathHandled = false

  constructor(scene: Phaser.Scene, x: number, y: number, def: EnemyDef, context: EnemyContext, scale = 1) {
    super(scene, x, y, `enemy_${def.key}`)
    scene.add.existing(this)
    scene.physics.add.existing(this)

    this.def = def
    this.speed = def.speed
    this.contactDamage = def.contactDamage
    this.xpReward = Math.round(def.xpReward * scale)
    this.health = new Resource(Math.max(1, Math.round(def.hp * scale)))
    this.behavior = createBehavior(def.behavior)
    this.context = context

    this.body!.setSize(def.size, def.size)
    this.setCollideWorldBounds(true)
  }

  get isDead(): boolean {
    return this.health.isEmpty
  }

  update(player: Player, time: number, delta: number): void {
    if (this.isDead) return
    this.behavior.update(this, player, time, delta)
  }

  /** Dispara una o varias direcciones a la vez. Respeta el cooldown. */
  volley(dirs: Phaser.Math.Vector2[], time: number): void {
    if (time < this.nextShotAt) return
    this.nextShotAt = time + (this.def.shootCooldownMs ?? 1500)
    const dmg = this.def.projectileDamage ?? 1
    for (const d of dirs) this.context.spawnEnemyProjectile(this.x, this.y, d, dmg)
  }

  /** Atajo de un solo disparo (usado por ShooterAI). */
  tryShoot(dir: Phaser.Math.Vector2, time: number): void {
    this.volley([dir], time)
  }

  takeDamage(amount: number, knockbackFrom?: Phaser.Math.Vector2): void {
    if (this.isDead) return
    this.health.damage(amount)

    this.setTintFill()
    this.scene.time.delayedCall(70, () => this.clearTint())

    if (knockbackFrom) {
      const dir = new Phaser.Math.Vector2(this.x - knockbackFrom.x, this.y - knockbackFrom.y).normalize()
      this.setVelocity(dir.x * KNOCKBACK, dir.y * KNOCKBACK)
    }

    if (this.isDead) this.die()
  }

  private die(): void {
    if (!this.deathHandled) {
      this.deathHandled = true
      this.onDeath?.(this)
    }
    this.body!.enable = false
    this.scene.tweens.add({
      targets: this,
      alpha: 0,
      scale: 0.3,
      duration: DEATH_MS,
      onComplete: () => this.destroy(),
    })
  }
}
