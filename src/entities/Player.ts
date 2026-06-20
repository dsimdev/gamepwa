import Phaser from 'phaser'
import { InputManager } from '../systems/InputManager'

const SPEED = 80

export class Player extends Phaser.Physics.Arcade.Sprite {
  private inputManager: InputManager
  hp = 6
  maxHp = 6
  /** Última dirección encarada (para ataques direccionales en v0.3.0). */
  facing = new Phaser.Math.Vector2(0, 1)

  constructor(scene: Phaser.Scene, x: number, y: number, input: InputManager) {
    super(scene, x, y, 'player')
    scene.add.existing(this)
    scene.physics.add.existing(this)
    this.inputManager = input

    this.setCollideWorldBounds(true)
    this.body!.setSize(12, 12)
    this.body!.setOffset(2, 4)
  }

  update() {
    const move = this.inputManager.getMove()
    this.setVelocity(move.x * SPEED, move.y * SPEED)

    if (move.lengthSq() > 0) {
      this.facing.copy(move).normalize()
      if (move.x < 0) this.setFlipX(true)
      else if (move.x > 0) this.setFlipX(false)
    }
  }
}
