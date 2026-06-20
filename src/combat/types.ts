import Phaser from 'phaser'
import type { ElementType } from '../data/elements'

export interface Damageable {
  takeDamage(amount: number, knockbackFrom?: Phaser.Math.Vector2, element?: ElementType): void
  readonly isDead: boolean
}

export interface CombatContext {
  spawnPlayerProjectile(x: number, y: number, dir: Phaser.Math.Vector2, damage: number, element?: ElementType): void
  meleePlayerHit(rect: Phaser.Geom.Rectangle, damage: number, from: Phaser.Math.Vector2): void
}

export interface EnemyContext {
  spawnEnemyProjectile(x: number, y: number, dir: Phaser.Math.Vector2, damage: number): void
}
