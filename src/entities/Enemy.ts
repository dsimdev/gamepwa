import Phaser from 'phaser'
import { Resource } from '../components/Resource'
import { createBehavior } from '../ai'
import type { AIBehavior } from '../ai/types'
import type { EnemyDef } from '../data/enemies'
import type { EnemyContext, Damageable } from '../combat/types'
import type { Player } from './Player'
import { ELEMENT_COLORS, ELEMENT_CSS } from '../data/elements'
import type { ElementType } from '../data/elements'
import { FONT_FAMILY } from '../ui/theme'

const KNOCKBACK = 80
const DEATH_MS = 180

export class Enemy extends Phaser.Physics.Arcade.Sprite implements Damageable {
  readonly def: EnemyDef
  readonly speed: number
  readonly contactDamage: number
  readonly xpReward: number
  health: Resource

  onDeath?: (enemy: Enemy) => void

  private behavior: AIBehavior
  private context: EnemyContext
  private nextShotAt = 0
  private deathHandled = false

  private hpBarBg!: Phaser.GameObjects.Rectangle
  private hpBarFill!: Phaser.GameObjects.Rectangle

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

    // Health bar colored by primary weakness (tells player which element to use)
    const weakness = this.getPrimaryWeakness()
    const barColor = weakness ? ELEMENT_COLORS[weakness] : 0x888888
    const bw = def.size
    this.hpBarBg = scene.add.rectangle(x, y - def.size / 2 - 4, bw, 2, 0x222233)
    this.hpBarFill = scene.add.rectangle(x - bw / 2, y - def.size / 2 - 4, bw, 2, barColor).setOrigin(0, 0.5)
  }

  get isDead(): boolean {
    return this.health.isEmpty
  }

  update(player: Player, time: number, delta: number): void {
    if (this.isDead) return
    this.behavior.update(this, player, time, delta)

    const barY = this.y - this.def.size / 2 - 4
    this.hpBarBg.setPosition(this.x, barY)
    this.hpBarFill.setPosition(this.x - this.def.size / 2, barY)
    this.hpBarFill.width = this.def.size * this.health.ratio
  }

  volley(dirs: Phaser.Math.Vector2[], time: number): void {
    if (time < this.nextShotAt) return
    this.nextShotAt = time + (this.def.shootCooldownMs ?? 1500)
    const dmg = this.def.projectileDamage ?? 1
    for (const d of dirs) this.context.spawnEnemyProjectile(this.x, this.y, d, dmg)
  }

  tryShoot(dir: Phaser.Math.Vector2, time: number): void {
    this.volley([dir], time)
  }

  takeDamage(amount: number, knockbackFrom?: Phaser.Math.Vector2, element?: ElementType): void {
    if (this.isDead) return

    let finalDamage = amount
    if (element) {
      const res = this.def.resistances?.[element] ?? 0
      const weak = this.def.weaknesses?.[element] ?? 1
      finalDamage = amount * weak * (1 - res)
      if (res > 0.3) {
        this.showFloating('RES!', ELEMENT_CSS[element])
      } else if (weak > 1.2) {
        this.showFloating('DÉB!', '#ffffff')
      }
    }

    this.health.damage(finalDamage)
    this.setTintFill()
    this.scene.time.delayedCall(70, () => this.clearTint())

    if (knockbackFrom) {
      const dir = new Phaser.Math.Vector2(this.x - knockbackFrom.x, this.y - knockbackFrom.y).normalize()
      this.setVelocity(dir.x * KNOCKBACK, dir.y * KNOCKBACK)
    }

    if (this.isDead) this.die()
  }

  private getPrimaryWeakness(): ElementType | undefined {
    const w = this.def.weaknesses
    if (!w) return undefined
    let best: ElementType | undefined
    let bestVal = 0
    for (const [k, v] of Object.entries(w) as [ElementType, number][]) {
      if (v > bestVal) { bestVal = v; best = k as ElementType }
    }
    return best
  }

  private showFloating(text: string, color: string): void {
    const t = this.scene.add.text(this.x, this.y - this.def.size / 2 - 8, text, {
      fontFamily: FONT_FAMILY,
      fontStyle: 'bold',
      fontSize: '7px',
      color,
      resolution: 2,
    })
    this.scene.tweens.add({
      targets: t, y: t.y - 10, alpha: 0, duration: 600, ease: 'Cubic.Out',
      onComplete: () => t.destroy(),
    })
  }

  private die(): void {
    if (!this.deathHandled) {
      this.deathHandled = true
      this.onDeath?.(this)
    }
    this.body!.enable = false
    this.hpBarBg.destroy()
    this.hpBarFill.destroy()
    this.scene.tweens.add({
      targets: this, alpha: 0, scale: 0.3, duration: DEATH_MS,
      onComplete: () => this.destroy(),
    })
  }
}
