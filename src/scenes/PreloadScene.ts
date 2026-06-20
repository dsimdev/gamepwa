import Phaser from 'phaser'

export class PreloadScene extends Phaser.Scene {
  constructor() {
    super({ key: 'PreloadScene' })
  }

  preload() {
    // Placeholder graphics until real assets arrive
    this.load.on('progress', (value: number) => {
      console.log(`Loading: ${Math.round(value * 100)}%`)
    })

    // TODO: cargar tilemaps, tilesets y sprites aquí
    // this.load.tilemapTiledJSON('map', 'assets/tilemaps/world.json')
    // this.load.image('tileset', 'assets/tilesets/overworld.png')
    // this.load.spritesheet('player', 'assets/sprites/player.png', { frameWidth: 16, frameHeight: 16 })
  }

  create() {
    this.scene.start('GameScene')
  }
}
