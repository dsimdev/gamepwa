import Phaser from 'phaser'
import { VirtualJoystick } from '../ui/VirtualJoystick'
import { ActionButton } from '../ui/ActionButton'
import { INPUT_KEYS } from '../systems/InputManager'

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
    this.setupTouchControls()
  }

  private setupTouchControls() {
    const { width, height } = this.scale

    // Joystick: publica el vector analógico al registry
    new VirtualJoystick(this, (x, y) => {
      this.registry.set(INPUT_KEYS.move, { x, y })
    })

    // Botones de acción (mitad derecha). La lógica de combate llega en v0.3.0.
    new ActionButton(
      this,
      width - 22,
      height - 20,
      0xe74c3c,
      'A',
      () => this.registry.set(INPUT_KEYS.attack, true),
      () => this.registry.set(INPUT_KEYS.attack, false)
    )
    new ActionButton(
      this,
      width - 48,
      height - 34,
      0x3498db,
      'B',
      () => this.registry.set(INPUT_KEYS.cast, true),
      () => this.registry.set(INPUT_KEYS.cast, false)
    )
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
