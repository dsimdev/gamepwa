import Phaser from 'phaser'
import { Resource } from '../components/Resource'
import type { Damageable } from '../combat/types'

const KNOCKBACK = 90

/**
 * TEMPORAL (v0.3.0): objetivo de prueba para validar el combate visualmente.
 * Se reemplaza por enemigos reales con IA en v0.4.0. Implementa Damageable.
 */
export class TrainingDummy extends Phaser.Physics.Arcade.Sprite implements Damageable {
  health = new Resource(5)

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, 'dummy')
    scene.add.existing(this)
    scene.physics.add.existing(this)
    this.body!.setSize(12, 12)
    this.setDrag(400, 400)
  }

  get isDead(): boolean {
    return this.health.isEmpty
  }

  takeDamage(amount: number, knockbackFrom?: Phaser.Math.Vector2): void {
    if (this.isDead) return
    this.health.damage(amount)

    // Flash blanco al recibir daño (setTintFill rellena sólido con el tint actual)
    this.setTintFill()
    this.scene.time.delayedCall(80, () => this.clearTint())

    if (knockbackFrom) {
      const dir = new Phaser.Math.Vector2(this.x - knockbackFrom.x, this.y - knockbackFrom.y).normalize()
      this.setVelocity(dir.x * KNOCKBACK, dir.y * KNOCKBACK)
    }

    if (this.isDead) {
      this.scene.tweens.add({
        targets: this,
        alpha: 0,
        scale: 0.3,
        duration: 200,
        onComplete: () => this.destroy(),
      })
    }
  }
}
