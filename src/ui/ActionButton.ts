import Phaser from 'phaser'

const RADIUS = 28

/**
 * Botón de acción táctil fijo en pantalla. Expone su estado (presionado)
 * vía callbacks de press/release. Para attack / cast en la mitad derecha.
 */
export class ActionButton {
  private circle: Phaser.GameObjects.Arc
  private pressed = false

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    color: number,
    label: string,
    onPress: () => void,
    onRelease: () => void
  ) {
    this.circle = scene.add
      .circle(x, y, RADIUS, color, 0.35)
      .setStrokeStyle(1, color, 0.7)
      .setScrollFactor(0)
      .setDepth(1000)
      .setInteractive({ useHandCursor: true })

    scene.add
      .text(x, y, label, { fontSize: '16px', color: '#ffffff' })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(1001)

    this.circle.on(Phaser.Input.Events.POINTER_DOWN, () => {
      this.pressed = true
      this.circle.setFillStyle(color, 0.6)
      onPress()
    })

    const release = () => {
      if (!this.pressed) return
      this.pressed = false
      this.circle.setFillStyle(color, 0.35)
      onRelease()
    }
    this.circle.on(Phaser.Input.Events.POINTER_UP, release)
    this.circle.on(Phaser.Input.Events.POINTER_OUT, release)
  }

  get isDown(): boolean {
    return this.pressed
  }
}
