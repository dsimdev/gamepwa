import Phaser from 'phaser'

/** Cualquier entidad que puede recibir daño (player, enemigos, objetos). */
export interface Damageable {
  takeDamage(amount: number, knockbackFrom?: Phaser.Math.Vector2): void
  /** Para que el sistema de combate filtre objetivos muertos. */
  readonly isDead: boolean
}

/**
 * Contexto de combate que la escena expone a las entidades. Desacopla al
 * Player de la GameScene: pide acciones sin conocer grupos ni físicas.
 */
export interface CombatContext {
  /** Dispara un proyectil del jugador desde (x,y) en dirección `dir` (normalizada). */
  spawnPlayerProjectile(x: number, y: number, dir: Phaser.Math.Vector2, damage: number): void
  /** Aplica daño melee a los enemigos dentro de `rect`. */
  meleePlayerHit(rect: Phaser.Geom.Rectangle, damage: number, from: Phaser.Math.Vector2): void
}
