import Phaser from 'phaser'
import { Player } from '../entities/Player'

export class GameScene extends Phaser.Scene {
  private player!: Player
  private debugGraphics!: Phaser.GameObjects.Graphics

  constructor() {
    super({ key: 'GameScene' })
  }

  create() {
    const { width, height } = this.scale

    // Placeholder textures until real sprites arrive
    const g = this.make.graphics({ x: 0, y: 0 })
    g.fillStyle(0x3498db)
    g.fillRect(0, 0, 16, 16)
    g.generateTexture('player', 16, 16)
    g.destroy()

    // Placeholder floor until tilemaps arrive
    this.add.rectangle(width / 2, height / 2, width, height, 0x2d5a27)

    // Placeholder walls
    this.add.rectangle(width / 2, 8, width, 16, 0x4a3728)
    this.add.rectangle(width / 2, height - 8, width, 16, 0x4a3728)
    this.add.rectangle(8, height / 2, 16, height, 0x4a3728)
    this.add.rectangle(width - 8, height / 2, 16, height, 0x4a3728)

    this.player = new Player(this, width / 2, height / 2)

    this.cameras.main.startFollow(this.player, true, 0.1, 0.1)
    this.cameras.main.setBounds(0, 0, width, height)

    this.scene.launch('UIScene', { scene: this })
  }

  update() {
    this.player.update()
  }
}
