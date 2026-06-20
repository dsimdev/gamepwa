import Phaser from 'phaser'
import { InputManager } from '../systems/InputManager'
import { Resource } from '../components/Resource'
import type { CombatContext, Damageable } from '../combat/types'

const SPEED = 80
const MELEE_COOLDOWN = 350
const CAST_COOLDOWN = 450
const MELEE_DAMAGE = 2
const MELEE_HP_COST = 1 // melee cuesta vida (risk/reward). Tunear acá.
const CAST_DAMAGE = 1
const CAST_MANA_COST = 3
const MELEE_RANGE = 14
const MELEE_WIDTH = 16
const INVULN_MS = 600

export class Player extends Phaser.Physics.Arcade.Sprite implements Damageable {
  private inputManager: InputManager
  private combat: CombatContext

  health = new Resource(6)
  mana = new Resource(10, 2)

  /** Última dirección encarada (para ataques direccionales). */
  facing = new Phaser.Math.Vector2(0, 1)

  private nextMeleeAt = 0
  private nextCastAt = 0
  private invulnUntil = 0

  constructor(scene: Phaser.Scene, x: number, y: number, input: InputManager, combat: CombatContext) {
    super(scene, x, y, 'player')
    scene.add.existing(this)
    scene.physics.add.existing(this)
    this.inputManager = input
    this.combat = combat

    this.setCollideWorldBounds(true)
    this.body!.setSize(12, 12)
    this.body!.setOffset(2, 4)
  }

  get isDead(): boolean {
    return this.health.isEmpty
  }

  update(_time: number, delta: number): void {
    this.mana.update(delta)

    const move = this.inputManager.getMove()
    this.setVelocity(move.x * SPEED, move.y * SPEED)

    if (move.lengthSq() > 0) {
      this.facing.copy(move).normalize()
      if (move.x < 0) this.setFlipX(true)
      else if (move.x > 0) this.setFlipX(false)
    }

    if (this.inputManager.justAttacked()) this.tryMelee()
    if (this.inputManager.justCast()) this.tryCast()

    // Parpadeo durante invulnerabilidad
    this.setAlpha(this.scene.time.now < this.invulnUntil ? 0.5 : 1)
  }

  private tryMelee(): void {
    const now = this.scene.time.now
    if (now < this.nextMeleeAt) return
    // El melee cuesta vida; no permitir suicidarse con el propio golpe
    if (this.health.current <= MELEE_HP_COST) return
    this.nextMeleeAt = now + MELEE_COOLDOWN

    this.health.damage(MELEE_HP_COST)

    // Hitbox rectangular frontal centrada en la dirección encarada
    const cx = this.x + this.facing.x * MELEE_RANGE
    const cy = this.y + this.facing.y * MELEE_RANGE
    const horizontal = Math.abs(this.facing.x) >= Math.abs(this.facing.y)
    const w = horizontal ? MELEE_RANGE * 2 : MELEE_WIDTH
    const h = horizontal ? MELEE_WIDTH : MELEE_RANGE * 2
    const rect = new Phaser.Geom.Rectangle(cx - w / 2, cy - h / 2, w, h)

    this.combat.meleePlayerHit(rect, MELEE_DAMAGE, new Phaser.Math.Vector2(this.x, this.y))
  }

  private tryCast(): void {
    const now = this.scene.time.now
    if (now < this.nextCastAt) return
    if (!this.mana.spend(CAST_MANA_COST)) return
    this.nextCastAt = now + CAST_COOLDOWN

    this.combat.spawnPlayerProjectile(this.x, this.y, this.facing.clone(), CAST_DAMAGE)
  }

  takeDamage(amount: number): void {
    const now = this.scene.time.now
    if (now < this.invulnUntil || this.isDead) return
    this.health.damage(amount)
    this.invulnUntil = now + INVULN_MS

    if (this.isDead) {
      this.setTint(0x555555)
      this.setVelocity(0, 0)
    }
  }
}
