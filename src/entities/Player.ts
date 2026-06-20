import Phaser from 'phaser'

const SPEED = 80

export class Player extends Phaser.Physics.Arcade.Sprite {
  private cursors: Phaser.Types.Input.Keyboard.CursorKeys
  private attackKey: Phaser.Input.Keyboard.Key
  hp = 6
  maxHp = 6

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, 'player')
    scene.add.existing(this)
    scene.physics.add.existing(this)

    this.setCollideWorldBounds(true)
    this.body!.setSize(12, 12)
    this.body!.setOffset(2, 4)

    this.cursors = scene.input.keyboard!.createCursorKeys()
    this.attackKey = scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE)
  }

  update() {
    const { left, right, up, down } = this.cursors
    let vx = 0
    let vy = 0

    if (left.isDown) vx = -SPEED
    else if (right.isDown) vx = SPEED

    if (up.isDown) vy = -SPEED
    else if (down.isDown) vy = SPEED

    // Diagonal normalization
    if (vx !== 0 && vy !== 0) {
      vx *= 0.707
      vy *= 0.707
    }

    this.setVelocity(vx, vy)

    if (vx < 0) this.setFlipX(true)
    else if (vx > 0) this.setFlipX(false)
  }
}
