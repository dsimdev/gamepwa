import Phaser from 'phaser'
import { InputManager } from '../systems/InputManager'
import { Resource } from '../components/Resource'
import { Progression } from '../components/Progression'
import { applyDefense } from '../components/Stats'
import { computeStats } from '../data/playerStats'
import { WEAPONS, STARTING_WEAPON } from '../data/weapons'
import { makeItem, isUnbreakable, KNIFE_KEY } from '../items/types'
import { GameState } from '../systems/GameState'
import type { StatBlock } from '../components/Stats'
import type { WeaponDef } from '../data/weapons'
import type { ItemInstance } from '../items/types'
import type { CombatContext, Damageable } from '../combat/types'
import type { ElementType } from '../data/elements'

const MELEE_WIDTH = 32
const INVULN_MS = 600
const COMBAT_WINDOW_MS = 4000
const COMBAT_REGEN_MULT = 0.15

export class Player extends Phaser.Physics.Arcade.Sprite implements Damageable {
  private inputManager: InputManager
  private combat: CombatContext

  stats: StatBlock
  health: Resource
  mana: Resource
  progression = new Progression()

  equippedItem: ItemInstance = makeItem(STARTING_WEAPON)

  get weapon(): WeaponDef {
    return WEAPONS[this.equippedItem.key]
  }

  facing = new Phaser.Math.Vector2(0, 1)
  inBase = false
  isDashing = false     // invulnerable y sin input durante el dash
  shieldHp = 0          // escudo de plasma — absorbe daño antes que la vida
  tempDefBonus = 0      // bonus temporal de DEF (pared de fuego)

  private nextAttackAt = 0
  private invulnUntil = 0
  private lastCombatAt = -COMBAT_WINDOW_MS

  constructor(scene: Phaser.Scene, x: number, y: number, input: InputManager, combat: CombatContext) {
    super(scene, x, y, 'player')
    scene.add.existing(this)
    scene.physics.add.existing(this)
    this.inputManager = input
    this.combat = combat

    this.stats = computeStats(1, GameState.statLevels)
    this.health = new Resource(this.stats.maxHp, this.stats.hpRegen)
    this.mana = new Resource(this.stats.maxMana, this.stats.manaRegen)

    this.setCollideWorldBounds(true)
    this.body!.setSize(24, 24)
    this.body!.setOffset(4, 8)
    ;(this.body as Phaser.Physics.Arcade.Body).pushable = false
  }

  get isDead(): boolean {
    return this.health.isEmpty
  }

  get level(): number {
    return this.progression.level
  }

  get inCombat(): boolean {
    return this.scene.time.now - this.lastCombatAt < COMBAT_WINDOW_MS
  }

  markCombat(): void {
    this.lastCombatAt = this.scene.time.now
  }

  update(_time: number, delta: number): void {
    const baseBonus = this.inBase ? 2.0 : 1.0
    const regenMult = this.inCombat ? COMBAT_REGEN_MULT : baseBonus
    this.health.regenPerSec = this.stats.hpRegen * regenMult
    this.mana.regenPerSec = this.stats.manaRegen * regenMult
    this.health.update(delta)
    this.mana.update(delta)

    if (!this.isDashing) {
      const move = this.inputManager.getMove()
      this.setVelocity(move.x * this.stats.moveSpeed, move.y * this.stats.moveSpeed)
      if (move.lengthSq() > 0) {
        this.facing.copy(move).normalize()
        if (move.x < 0) this.setFlipX(true)
        else if (move.x > 0) this.setFlipX(false)
      }
    }

    this.setAlpha(this.scene.time.now < this.invulnUntil ? 0.5 : 1)
  }

  /** Llamado por GameScene cuando hay un enemigo en rango (auto-ataque por proximidad). */
  triggerAttack(): void {
    const now = this.scene.time.now
    if (now < this.nextAttackAt) return

    const cooldown = this.weapon.cooldownMs

    this.markCombat()
    if (this.weapon.type === 'melee') {
      this.nextAttackAt = now + cooldown
      this.meleeSwing()
      this.degradeWeapon()
    } else {
      const el = this.weapon.element as ElementType
      if (!this.combat.consumeAmmo(el)) return
      this.nextAttackAt = now + cooldown
      const dmg = this.stats.rangedDamage + this.weapon.damage
      this.combat.spawnPlayerProjectile(this.x, this.y, this.facing.clone(), dmg, el)
      this.degradeWeapon()
    }
  }

  private degradeWeapon(): void {
    if (isUnbreakable(this.equippedItem.key)) return
    this.equippedItem.durability -= 1
    if (this.equippedItem.durability <= 0) {
      const brokenName = this.weapon.name
      this.equip(makeItem(KNIFE_KEY))
      this.scene.events.emit('weaponbroke', brokenName)
    }
  }

  private meleeSwing(): void {
    const range = this.weapon.range ?? 14
    const cx = this.x + this.facing.x * range
    const cy = this.y + this.facing.y * range
    const horizontal = Math.abs(this.facing.x) >= Math.abs(this.facing.y)
    const w = horizontal ? range * 2 : MELEE_WIDTH
    const h = horizontal ? MELEE_WIDTH : range * 2
    const rect = new Phaser.Geom.Rectangle(cx - w / 2, cy - h / 2, w, h)
    const dmg = this.stats.meleeDamage + this.weapon.damage
    this.combat.meleePlayerHit(rect, dmg, new Phaser.Math.Vector2(this.x, this.y))
  }

  takeDamage(amount: number, _knockbackFrom?: Phaser.Math.Vector2, _element?: ElementType): void {
    const now = this.scene.time.now
    if (now < this.invulnUntil || this.isDead || this.isDashing) return
    this.markCombat()
    let dmg = applyDefense(amount, this.stats.defense + this.tempDefBonus)
    if (this.shieldHp > 0) {
      const absorbed = Math.min(this.shieldHp, dmg)
      this.shieldHp -= absorbed
      dmg -= absorbed
      if (this.shieldHp <= 0) this.scene.events.emit('toast', 'Escudo roto')
      if (dmg <= 0) { this.invulnUntil = now + INVULN_MS; return }
    }
    this.health.damage(dmg)
    this.invulnUntil = now + INVULN_MS
    if (this.isDead) {
      this.setTint(0x555555)
      this.setVelocity(0, 0)
    }
  }

  /** Rebuilds stats from character level + invested stat points. Call after level-up or stat allocation. */
  rebuildStats(): void {
    this.stats = computeStats(this.progression.level, GameState.statLevels)
    this.health.max = this.stats.maxHp
    this.health.regenPerSec = this.stats.hpRegen
    this.mana.max = this.stats.maxMana
    this.mana.regenPerSec = this.stats.manaRegen
  }

  applyProgression(level: number, xp: number): void {
    this.progression.level = level
    this.progression.xp = xp
    this.rebuildStats()
    this.health.current = this.health.max
    this.mana.current = this.mana.max
  }

  gainXp(amount: number): void {
    const gained = this.progression.addXp(amount)
    if (gained > 0) this.onLevelUp()
  }

  private onLevelUp(): void {
    this.rebuildStats()
    this.health.current = this.health.max
    this.mana.current = this.mana.max
    this.scene.events.emit('levelup', this.progression.level)
  }

  equip(item: ItemInstance): void {
    this.equippedItem = item
    this.nextAttackAt = 0
  }
}
