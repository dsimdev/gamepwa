import Phaser from 'phaser'

export type PickupKind = 'weapon' | 'skill'

/**
 * Loot en el piso. Guarda qué tipo de item es (arma/skill) y su clave en los
 * datos. Al recogerlo, la escena resuelve la definición y lo equipa.
 */
export class Pickup extends Phaser.Physics.Arcade.Sprite {
  readonly kind: PickupKind
  readonly itemKey: string

  constructor(scene: Phaser.Scene, x: number, y: number, kind: PickupKind, itemKey: string, color: number) {
    super(scene, x, y, 'pickup')
    scene.add.existing(this)
    scene.physics.add.existing(this)
    this.kind = kind
    this.itemKey = itemKey
    this.setTint(color)
    this.body!.setSize(8, 8)

    // Pequeño bobbing para que se note que es recogible
    scene.tweens.add({
      targets: this,
      y: y - 3,
      duration: 600,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.InOut',
    })
  }
}
