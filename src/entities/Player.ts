import Phaser from 'phaser'
import { InputManager } from '../systems/InputManager'
import { Resource } from '../components/Resource'
import { Progression } from '../components/Progression'
import { applyDefense } from '../components/Stats'
import { statsForLevel } from '../data/playerStats'
import { WEAPONS, STARTING_WEAPON } from '../data/weapons'
import { makeItem, isUnbreakable, KNIFE_KEY } from '../items/types'
import type { StatBlock } from '../components/Stats'
import type { WeaponDef } from '../data/weapons'
import type { ItemInstance } from '../items/types'
import type { CombatContext, Damageable } from '../combat/types'
import type { ElementType } from '../data/elements'

const MELEE_WIDTH = 16
const INVULN_MS = 600

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

  private nextAttackAt = 0
  private invulnUntil = 0

  constructor(scene: Phaser.Scene, x: number, y: number, input: InputManager, combat: CombatContext) {
    super(scene, x, y, 'player')
    scene.add.existing(this)
    scene.physics.add.existing(this)
    this.inputManager = input
    this.combat = combat

    this.stats = statsForLevel(1)
    this.health = new Resource(this.stats.maxHp)
    this.mana = new Resource(this.stats.maxMana, this.stats.manaRegen)

    this.setCollideWorldBounds(true)
    this.body!.setSize(12, 12)
    this.body!.setOffset(2, 4)
    ;(this.body as Phaser.Physics.Arcade.Body).pushable = false
  }

  get isDead(): boolean {
    return this.health.isEmpty
  }

  get level(): number {
    return this.progression.level
  }

  update(_time: number, delta: number): void {
    this.mana.update(delta)

    const move = this.inputManager.getMove()
    this.setVelocity(move.x * this.stats.moveSpeed, move.y * this.stats.moveSpeed)

    if (move.lengthSq() > 0) {
      this.facing.copy(move).normalize()
      if (move.x < 0) this.setFlipX(true)
      else if (move.x > 0) this.setFlipX(false)
    }

    if (this.inputManager.justAttacked()) this.tryAttack()

    this.setAlpha(this.scene.time.now < this.invulnUntil ? 0.5 : 1)
  }

  private tryAttack(): void {
    const now = this.scene.time.now
    if (now < this.nextAttackAt) return

    if (this.weapon.type === 'melee') {
      this.nextAttackAt = now + this.weapon.cooldownMs
      this.meleeSwing()
    } else {
      const cost = this.weapon.manaCost ?? 0
      if (!this.mana.spend(cost)) return
      this.nextAttackAt = now + this.weapon.cooldownMs
      const dmg = this.stats.rangedDamage + this.weapon.damage
      this.combat.spawnPlayerProjectile(this.x, this.y, this.facing.clone(), dmg, this.weapon.element as ElementType | undefined)
    }
    this.degradeWeapon()
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
    if (now < this.invulnUntil || this.isDead) return
    this.health.damage(applyDefense(amount, this.stats.defense))
    this.invulnUntil = now + INVULN_MS

    if (this.isDead) {
      this.setTint(0x555555)
      this.setVelocity(0, 0)
    }
  }

  applyProgression(level: number, xp: number): void {
    this.progression.level = level
    this.progression.xp = xp
    this.stats = statsForLevel(level)
    this.health.max = this.stats.maxHp
    this.mana.max = this.stats.maxMana
    this.mana.regenPerSec = this.stats.manaRegen
    this.health.current = this.health.max
    this.mana.current = this.mana.max
  }

  gainXp(amount: number): void {
    const gained = this.progression.addXp(amount)
    if (gained > 0) this.onLevelUp()
  }

  private onLevelUp(): void {
    this.stats = statsForLevel(this.progression.level)
    this.health.max = this.stats.maxHp
    this.mana.max = this.stats.maxMana
    this.mana.regenPerSec = this.stats.manaRegen
    this.health.current = this.health.max
    this.mana.current = this.mana.max
    this.scene.events.emit('levelup', this.progression.level)
  }

  equip(item: ItemInstance): void {
    this.equippedItem = item
    this.nextAttackAt = 0
  }
}
