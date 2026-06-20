import Phaser from 'phaser'

const SPEED = 150
const LIFETIME = 1100

/**
 * Proyectil de combate. Diseñado para usarse en un grupo con pooling
 * (get/kill) y `runChildUpdate: true` para que preUpdate maneje su vida.
 */
export class Projectile extends Phaser.Physics.Arcade.Image {
  damage = 0
  private diesAt = 0

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, 'projectile')
  }

  fire(x: number, y: number, dir: Phaser.Math.Vector2, damage: number): void {
    this.damage = damage
    this.enableBody(true, x, y, true, true)
    this.setVelocity(dir.x * SPEED, dir.y * SPEED)
    this.setRotation(dir.angle())
    this.diesAt = this.scene.time.now + LIFETIME
  }

  /** Se llama solo si el grupo tiene runChildUpdate: true. */
  preUpdate(time: number, _delta: number): void {
    if (time >= this.diesAt) this.kill()
  }

  /** Devuelve el proyectil al pool (impacto o expiración). */
  kill(): void {
    this.disableBody(true, true)
  }
}
