import Phaser from 'phaser'

/** Claves del registry compartidas con UIScene (controles táctiles). */
export const INPUT_KEYS = {
  move: 'input.move',
  attack: 'input.attack',
  cast: 'input.cast',
} as const

/**
 * Capa de input abstracta. Unifica teclado (desktop) y controles táctiles
 * (mobile, publicados por UIScene en el registry) en una sola interfaz.
 * El resto del juego consume esto sin saber el origen del input.
 */
export class InputManager {
  private keys: {
    attack: Phaser.Input.Keyboard.Key
    cast: Phaser.Input.Keyboard.Key
  }
  private cursors: Phaser.Types.Input.Keyboard.CursorKeys
  private wasd: { up: Phaser.Input.Keyboard.Key; down: Phaser.Input.Keyboard.Key; left: Phaser.Input.Keyboard.Key; right: Phaser.Input.Keyboard.Key }
  private registry: Phaser.Data.DataManager
  private move = new Phaser.Math.Vector2()

  // Edge detection para botones
  private attackWasDown = false
  private castWasDown = false

  constructor(scene: Phaser.Scene) {
    this.registry = scene.registry
    const kb = scene.input.keyboard!
    const K = Phaser.Input.Keyboard.KeyCodes
    this.cursors = kb.createCursorKeys()
    this.wasd = {
      up: kb.addKey(K.W),
      down: kb.addKey(K.S),
      left: kb.addKey(K.A),
      right: kb.addKey(K.D),
    }
    this.keys = {
      attack: kb.addKey(K.SPACE),
      cast: kb.addKey(K.SHIFT),
    }

    this.registry.set(INPUT_KEYS.move, { x: 0, y: 0 })
    this.registry.set(INPUT_KEYS.attack, false)
    this.registry.set(INPUT_KEYS.cast, false)
  }

  /** Vector de movimiento normalizado (magnitud <= 1). Mergea teclado + táctil. */
  getMove(): Phaser.Math.Vector2 {
    let kx = 0
    let ky = 0
    if (this.cursors.left.isDown || this.wasd.left.isDown) kx -= 1
    if (this.cursors.right.isDown || this.wasd.right.isDown) kx += 1
    if (this.cursors.up.isDown || this.wasd.up.isDown) ky -= 1
    if (this.cursors.down.isDown || this.wasd.down.isDown) ky += 1

    if (kx !== 0 || ky !== 0) {
      // Input digital de teclado: normalizar para que la diagonal no sea más rápida
      return this.move.set(kx, ky).normalize()
    }

    // Sin teclado: usar joystick analógico del registry
    const touch = this.registry.get(INPUT_KEYS.move) as { x: number; y: number }
    this.move.set(touch.x, touch.y)
    if (this.move.length() > 1) this.move.normalize()
    return this.move
  }

  get attackDown(): boolean {
    return this.keys.attack.isDown || this.registry.get(INPUT_KEYS.attack) === true
  }

  get castDown(): boolean {
    return this.keys.cast.isDown || this.registry.get(INPUT_KEYS.cast) === true
  }

  /** True solo en el frame en que se presionó (edge). */
  justAttacked(): boolean {
    const down = this.attackDown
    const just = down && !this.attackWasDown
    this.attackWasDown = down
    return just
  }

  justCast(): boolean {
    const down = this.castDown
    const just = down && !this.castWasDown
    this.castWasDown = down
    return just
  }
}
