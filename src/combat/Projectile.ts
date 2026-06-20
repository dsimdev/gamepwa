import Phaser from 'phaser'
import { ELEMENT_COLORS } from '../data/elements'
import type { ElementType } from '../data/elements'

const SPEED = 150
const LIFETIME = 1100

export class Projectile extends Phaser.Physics.Arcade.Image {
  damage = 0
  element: ElementType | undefined = undefined
  private diesAt = 0

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, 'projectile')
  }

  fire(x: number, y: number, dir: Phaser.Math.Vector2, damage: number, textureKey = 'projectile', element?: ElementType): void {
    this.damage = damage
    this.element = element
    if (this.texture.key !== textureKey) this.setTexture(textureKey)
    this.enableBody(true, x, y, true, true)
    this.setVelocity(dir.x * SPEED, dir.y * SPEED)
    this.setRotation(dir.angle())
    if (element) {
      this.setTint(ELEMENT_COLORS[element])
    } else {
      this.clearTint()
    }
    this.diesAt = this.scene.time.now + LIFETIME
  }

  preUpdate(time: number, _delta: number): void {
    if (time >= this.diesAt) this.kill()
  }

  kill(): void {
    this.disableBody(true, true)
  }
}
