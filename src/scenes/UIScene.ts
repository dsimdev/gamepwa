import Phaser from 'phaser'

const HEART_SIZE = 8
const HEART_GAP = 10
const MARGIN = 6

export class UIScene extends Phaser.Scene {
  private hearts: Phaser.GameObjects.Rectangle[] = []

  constructor() {
    super({ key: 'UIScene' })
  }

  create() {
    this.drawHearts(6, 6)
  }

  private drawHearts(current: number, max: number) {
    this.hearts.forEach(h => h.destroy())
    this.hearts = []

    for (let i = 0; i < max; i++) {
      const x = MARGIN + i * HEART_GAP
      const color = i < current ? 0xe74c3c : 0x7f8c8d
      const heart = this.add.rectangle(x, MARGIN, HEART_SIZE, HEART_SIZE, color)
      heart.setOrigin(0, 0)
      this.hearts.push(heart)
    }
  }

  updateHearts(current: number, max: number) {
    this.drawHearts(current, max)
  }
}
