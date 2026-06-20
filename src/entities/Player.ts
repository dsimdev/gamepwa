import Phaser from 'phaser'
import { InputManager } from '../systems/InputManager'
import { Resource } from '../components/Resource'
import { Progression } from '../components/Progression'
import { applyDefense } from '../components/Stats'
import { statsForLevel } from '../data/playerStats'
import { WEAPONS, STARTING_WEAPON } from '../data/weapons'
import { SKILLS, STARTING_SKILL } from '../data/skills'
import type { StatBlock } from '../components/Stats'
import type { WeaponDef } from '../data/weapons'
import type { SkillDef } from '../data/skills'
import type { CombatContext, Damageable } from '../combat/types'

const MELEE_WIDTH = 16
const INVULN_MS = 600

export class Player extends Phaser.Physics.Arcade.Sprite implements Damageable {
  private inputManager: InputManager
  private combat: CombatContext

  stats: StatBlock
  health: Resource
  mana: Resource
  progression = new Progression()

  weapon: WeaponDef = WEAPONS[STARTING_WEAPON]
  skill: SkillDef = SKILLS[STARTING_SKILL]

  facing = new Phaser.Math.Vector2(0, 1)

  private nextAttackAt = 0
  private nextSkillAt = 0
  private invulnUntil = 0
  private blocking = false

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

    // A = ataque según arma equipada
    if (this.inputManager.justAttacked()) this.tryAttack()
    // B = skill defensiva (cura o bloqueo)
    this.updateSkill(delta)

    if (!this.blocking) {
      this.setAlpha(this.scene.time.now < this.invulnUntil ? 0.5 : 1)
    }
  }

  // --- A: ataque según arma ---

  private tryAttack(): void {
    const now = this.scene.time.now
    if (now < this.nextAttackAt) return

    if (this.weapon.type === 'melee') {
      const cost = this.weapon.hpCost ?? 0
      if (cost > 0 && this.health.current <= cost) return // no suicidarse
      this.nextAttackAt = now + this.weapon.cooldownMs
      if (cost > 0) this.health.damage(cost)
      this.meleeSwing()
    } else {
      const cost = this.weapon.manaCost ?? 0
      if (!this.mana.spend(cost)) return
      this.nextAttackAt = now + this.weapon.cooldownMs
      const dmg = this.stats.rangedDamage + this.weapon.damage
      this.combat.spawnPlayerProjectile(this.x, this.y, this.facing.clone(), dmg)
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

  // --- B: skill defensiva ---

  private updateSkill(delta: number): void {
    if (this.skill.type === 'block') {
      const wantsBlock = this.inputManager.castDown && this.mana.current > 0
      if (wantsBlock) {
        this.blocking = true
        this.mana.damage(((this.skill.manaDrainPerSec ?? 0) * delta) / 1000)
        this.setTint(0x66aaff)
      } else if (this.blocking) {
        this.blocking = false
        this.clearTint()
      }
    } else if (this.skill.type === 'heal') {
      if (this.inputManager.justCast()) this.tryHeal()
    }
  }

  private tryHeal(): void {
    const now = this.scene.time.now
    if (now < this.nextSkillAt) return
    if (this.health.current >= this.health.max) return
    if (!this.mana.spend(this.skill.manaCost ?? 0)) return
    this.nextSkillAt = now + (this.skill.cooldownMs ?? 0)
    this.health.add(this.skill.healAmount ?? 0)
    this.setTint(0x2ecc71)
    this.scene.time.delayedCall(120, () => this.clearTint())
  }

  // --- Daño y progresión ---

  takeDamage(amount: number): void {
    const now = this.scene.time.now
    if (this.blocking) return // bloqueo total mientras dure el maná
    if (now < this.invulnUntil || this.isDead) return
    this.health.damage(applyDefense(amount, this.stats.defense))
    this.invulnUntil = now + INVULN_MS

    if (this.isDead) {
      this.setTint(0x555555)
      this.setVelocity(0, 0)
    }
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

  // --- Equipo ---

  equipWeapon(weapon: WeaponDef): void {
    this.weapon = weapon
    this.nextAttackAt = 0
  }

  equipSkill(skill: SkillDef): void {
    if (this.blocking) {
      this.blocking = false
      this.clearTint()
    }
    this.skill = skill
    this.nextSkillAt = 0
  }
}
