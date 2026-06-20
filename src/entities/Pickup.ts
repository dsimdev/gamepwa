import Phaser from 'phaser'

export type PickupKind = 'weapon' | 'ammo' | 'coin'

export class Pickup extends Phaser.Physics.Arcade.Sprite {
  readonly kind: PickupKind
  readonly itemKey: string   // weapon key | element name | 'coin'
  readonly amount: number    // ammo quantity or coin value

  constructor(scene: Phaser.Scene, x: number, y: number, kind: PickupKind, itemKey: string, color: number, amount = 1) {
    const texKey = kind === 'ammo' ? 'ammo_pickup' : kind === 'coin' ? 'coin_pickup' : 'pickup'
    super(scene, x, y, texKey)
    scene.add.existing(this)
    scene.physics.add.existing(this)
    this.kind = kind
    this.itemKey = itemKey
    this.amount = amount
    this.setTint(color)
    this.body!.setSize(14, 14)

    scene.tweens.add({
      targets: this,
      y: y - 6,
      duration: 600,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.InOut',
    })
  }
}
