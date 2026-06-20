import Phaser from 'phaser'
import { VirtualJoystick } from '../ui/VirtualJoystick'
import { ActionButton } from '../ui/ActionButton'
import { INPUT_KEYS } from '../systems/InputManager'
import { Player } from '../entities/Player'

const HEART_SIZE = 8
const HEART_GAP = 10
const MARGIN = 6
const MANA_BAR_W = 56
const MANA_BAR_H = 4

export class UIScene extends Phaser.Scene {
  private player!: Player
  private hearts: Phaser.GameObjects.Rectangle[] = []
  private manaBar!: Phaser.GameObjects.Rectangle
  private lastHp = -1

  constructor() {
    super({ key: 'UIScene' })
  }

  init(data: { player: Player }) {
    this.player = data.player
  }

  create() {
    this.drawHearts(this.player.health.max, this.player.health.max)

    // Barra de maná bajo los corazones
    this.add
      .rectangle(MARGIN, MARGIN + HEART_SIZE + 3, MANA_BAR_W, MANA_BAR_H, 0x1b2a4a)
      .setOrigin(0, 0)
    this.manaBar = this.add
      .rectangle(MARGIN, MARGIN + HEART_SIZE + 3, MANA_BAR_W, MANA_BAR_H, 0x3498db)
      .setOrigin(0, 0)

    this.setupTouchControls()
  }

  update() {
    const hp = Math.round(this.player.health.current)
    if (hp !== this.lastHp) {
      this.drawHearts(hp, this.player.health.max)
      this.lastHp = hp
    }
    this.manaBar.width = MANA_BAR_W * this.player.mana.ratio
  }

  private setupTouchControls() {
    const { width, height } = this.scale

    // Joystick: publica el vector analógico al registry
    new VirtualJoystick(this, (x, y) => {
      this.registry.set(INPUT_KEYS.move, { x, y })
    })

    // Botones de acción (mitad derecha), separados para no solaparse
    new ActionButton(
      this,
      width - 20,
      height - 18,
      0xe74c3c,
      'A',
      () => this.registry.set(INPUT_KEYS.attack, true),
      () => this.registry.set(INPUT_KEYS.attack, false)
    )
    new ActionButton(
      this,
      width - 52,
      height - 40,
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
}
