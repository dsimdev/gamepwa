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

// Pool de textos flotantes por escena — evita crear/destruir Text en cada golpe
const _floatingPools = new WeakMap<Phaser.Scene, Phaser.GameObjects.Text[]>()
const POOL_MAX = 12

function acquireFloating(scene: Phaser.Scene, x: number, y: number, text: string, color: string): Phaser.GameObjects.Text {
  const pool = _floatingPools.get(scene) ?? []
  _floatingPools.set(scene, pool)
  while (pool.length > 0) {
    const t = pool.pop()!
    if (t.active) {
      t.setPosition(x, y).setText(text).setColor(color).setAlpha(1).setVisible(true)
      return t
    }
  }
  return scene.add.text(x, y, text, { fontFamily: FONT_FAMILY, fontStyle: 'bold', fontSize: '14px', color })
}

function releaseFloating(scene: Phaser.Scene, t: Phaser.GameObjects.Text): void {
  if (!t.active) return
  t.setVisible(false)
  const pool = _floatingPools.get(scene) ?? []
  if (pool.length < POOL_MAX) pool.push(t)
  else t.destroy()
}

const KNOCKBACK = 160
const DEATH_MS = 180

export class Enemy extends Phaser.Physics.Arcade.Sprite implements Damageable {
  readonly def: EnemyDef
  readonly speed: number
  readonly contactDamage: number
  readonly xpReward: number
  private readonly scaledProjectileDmg: number
  health: Resource

  onDeath?: (enemy: Enemy) => void

  provoked = false
  eliteTintColor?: number   // tinte que se restaura después del flash de golpe
  bonusResistance = 0       // resistencia flat extra (élite Blindado)

  private behavior: AIBehavior
  private context: EnemyContext
  private nextShotAt = 0
  private deathHandled = false
  private readonly _knockbackDir = new Phaser.Math.Vector2()

  private hpBarBg!: Phaser.GameObjects.Rectangle
  private hpBarFill!: Phaser.GameObjects.Rectangle

  constructor(scene: Phaser.Scene, x: number, y: number, def: EnemyDef, context: EnemyContext, scale = 1) {
    super(scene, x, y, `enemy_${def.key}`)
    scene.add.existing(this)
    scene.physics.add.existing(this)

    // El daño escala más suave que la vida (^0.6) para que el desafío sea aguantar, no morir de un toque
    const dmgScale = Math.pow(scale, 0.6)
    this.def = def
    this.speed = def.speed
    this.contactDamage = Math.max(1, Math.round(def.contactDamage * dmgScale))
    this.scaledProjectileDmg = def.projectileDamage !== undefined
      ? Math.max(1, Math.round(def.projectileDamage * dmgScale))
      : 1
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
    this.hpBarBg = scene.add.rectangle(x, y - def.size / 2 - 8, bw, 4, 0x222233)
    this.hpBarFill = scene.add.rectangle(x - bw / 2, y - def.size / 2 - 8, bw, 4, barColor).setOrigin(0, 0.5)
  }

  get isDead(): boolean {
    return this.health.isEmpty
  }

  update(player: Player, time: number, delta: number): void {
    if (this.isDead) return
    this.behavior.update(this, player, time, delta)

    const barY = this.y - this.def.size / 2 - 8
    this.hpBarBg.setPosition(this.x, barY)
    this.hpBarFill.setPosition(this.x - this.def.size / 2, barY)
    this.hpBarFill.width = this.def.size * this.health.ratio
  }

  volley(dirs: Phaser.Math.Vector2[], time: number): void {
    if (time < this.nextShotAt) return
    this.nextShotAt = time + (this.def.shootCooldownMs ?? 1500)
    for (const d of dirs) this.context.spawnEnemyProjectile(this.x, this.y, d, this.scaledProjectileDmg)
  }

  tryShoot(dir: Phaser.Math.Vector2, time: number): void {
    this.volley([dir], time)
  }

  takeDamage(amount: number, knockbackFrom?: Phaser.Math.Vector2, element?: ElementType): void {
    if (this.isDead) return

    let finalDamage = amount
    if (element) {
      const res = Math.min((this.def.resistances?.[element] ?? 0) + this.bonusResistance, 0.85)
      const weak = this.def.weaknesses?.[element] ?? 1
      finalDamage = amount * weak * (1 - res)
      if (res > 0.3) {
        this.showFloating('RES!', ELEMENT_CSS[element])
      } else if (weak > 1.2) {
        this.showFloating('DÉB!', '#ffffff')
      }
    }

    this.provoked = true
    this.health.damage(finalDamage)
    this.setTint(0xffffff)  // flash de golpe
    this.scene.time.delayedCall(70, () => {
      if (this.eliteTintColor) this.setTint(this.eliteTintColor)
      else this.clearTint()
    })

    if (knockbackFrom) {
      this._knockbackDir.set(this.x - knockbackFrom.x, this.y - knockbackFrom.y).normalize()
      this.setVelocity(this._knockbackDir.x * KNOCKBACK, this._knockbackDir.y * KNOCKBACK)
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
    const y = this.y - this.def.size / 2 - 16
    const t = acquireFloating(this.scene, this.x, y, text, color)
    this.scene.tweens.add({
      targets: t, y: y - 10, alpha: 0, duration: 600, ease: 'Cubic.Out',
      onComplete: () => releaseFloating(this.scene, t),
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

  // Garantiza que las HP bars se destruyan en CUALQUIER ruta de destrucción
  // (die(), enemies.clear(true,true), clearRoom(), etc.)
  destroy(fromScene = false): void {
    if (this.hpBarBg?.active)   this.hpBarBg.destroy()
    if (this.hpBarFill?.active) this.hpBarFill.destroy()
    super.destroy(fromScene)
  }
}
