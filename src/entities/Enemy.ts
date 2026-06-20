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
  health: Resource

  private behavior: AIBehavior
  private context: EnemyContext
  private nextShotAt = 0

  constructor(scene: Phaser.Scene, x: number, y: number, def: EnemyDef, context: EnemyContext) {
    super(scene, x, y, `enemy_${def.key}`)
    scene.add.existing(this)
    scene.physics.add.existing(this)

    this.def = def
    this.speed = def.speed
    this.contactDamage = def.contactDamage
    this.health = new Resource(def.hp)
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

  /** Llamado por ShooterAI cuando está en rango. Respeta el cooldown. */
  tryShoot(dir: Phaser.Math.Vector2, time: number): void {
    if (time < this.nextShotAt) return
    this.nextShotAt = time + (this.def.shootCooldownMs ?? 1500)
    this.context.spawnEnemyProjectile(this.x, this.y, dir, this.def.projectileDamage ?? 1)
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
