import Phaser from 'phaser'

const BASE_RADIUS = 26
const THUMB_RADIUS = 12
const DEAD_ZONE = 0.18

/**
 * Joystick virtual táctil. Aparece donde el jugador toca la mitad izquierda
 * de la pantalla y se oculta al soltar. Publica un vector normalizado (-1..1)
 * vía callback. Pensado para vivir en una escena screen-space (UIScene).
 */
export class VirtualJoystick {
  private scene: Phaser.Scene
  private base: Phaser.GameObjects.Arc
  private thumb: Phaser.GameObjects.Arc
  private pointerId: number | null = null
  private origin = new Phaser.Math.Vector2()
  private value = new Phaser.Math.Vector2()
  private onChange: (x: number, y: number) => void

  constructor(scene: Phaser.Scene, onChange: (x: number, y: number) => void) {
    this.scene = scene
    this.onChange = onChange

    this.base = scene.add
      .circle(0, 0, BASE_RADIUS, 0xffffff, 0.12)
      .setStrokeStyle(1, 0xffffff, 0.35)
      .setVisible(false)
      .setScrollFactor(0)
      .setDepth(1000)

    this.thumb = scene.add
      .circle(0, 0, THUMB_RADIUS, 0xffffff, 0.45)
      .setVisible(false)
      .setScrollFactor(0)
      .setDepth(1001)

    scene.input.on(Phaser.Input.Events.POINTER_DOWN, this.onDown, this)
    scene.input.on(Phaser.Input.Events.POINTER_MOVE, this.onMove, this)
    scene.input.on(Phaser.Input.Events.POINTER_UP, this.onUp, this)
  }

  /** Solo controla movimiento desde la mitad izquierda de la pantalla. */
  private isMovementZone(x: number): boolean {
    return x < this.scene.scale.width / 2
  }

  private onDown(pointer: Phaser.Input.Pointer) {
    if (this.pointerId !== null) return
    if (!this.isMovementZone(pointer.x)) return

    this.pointerId = pointer.id
    this.origin.set(pointer.x, pointer.y)
    this.base.setPosition(pointer.x, pointer.y).setVisible(true)
    this.thumb.setPosition(pointer.x, pointer.y).setVisible(true)
  }

  private onMove(pointer: Phaser.Input.Pointer) {
    if (pointer.id !== this.pointerId) return

    const dx = pointer.x - this.origin.x
    const dy = pointer.y - this.origin.y
    const dist = Math.min(Math.hypot(dx, dy), BASE_RADIUS)
    const angle = Math.atan2(dy, dx)

    this.thumb.setPosition(
      this.origin.x + Math.cos(angle) * dist,
      this.origin.y + Math.sin(angle) * dist
    )

    const norm = dist / BASE_RADIUS
    if (norm < DEAD_ZONE) {
      this.value.set(0, 0)
    } else {
      this.value.set(Math.cos(angle) * norm, Math.sin(angle) * norm)
    }
    this.onChange(this.value.x, this.value.y)
  }

  private onUp(pointer: Phaser.Input.Pointer) {
    if (pointer.id !== this.pointerId) return
    this.pointerId = null
    this.value.set(0, 0)
    this.base.setVisible(false)
    this.thumb.setVisible(false)
    this.onChange(0, 0)
  }
}
