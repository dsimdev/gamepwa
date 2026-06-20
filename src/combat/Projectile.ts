import Phaser from 'phaser'
import { ELEMENT_COLORS } from '../data/elements'
import type { ElementType } from '../data/elements'

const DEFAULT_SPEED = 300
const DEFAULT_LIFETIME = 1100

export class Projectile extends Phaser.Physics.Arcade.Image {
  damage = 0
  element: ElementType | undefined = undefined
  private diesAt = 0

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, 'projectile')
  }

  fire(
    x: number,
    y: number,
    dir: Phaser.Math.Vector2,
    damage: number,
    textureKey = 'projectile',
    element?: ElementType,
    speed = DEFAULT_SPEED,
    lifetime = DEFAULT_LIFETIME,
    projScale = 1,
  ): void {
    this.damage = damage
    this.element = element
    if (this.texture.key !== textureKey) this.setTexture(textureKey)
    this.enableBody(true, x, y, true, true)
    this.setScale(projScale)
    this.setVelocity(dir.x * speed, dir.y * speed)
    this.setRotation(dir.angle())
    if (element) {
      this.setTint(ELEMENT_COLORS[element])
    } else {
      this.clearTint()
    }
    this.diesAt = this.scene.time.now + lifetime
  }

  preUpdate(time: number, _delta: number): void {
    if (time >= this.diesAt) this.kill()
  }

  kill(): void {
    this.setScale(1)
    this.disableBody(true, true)
  }
}
