import Phaser from 'phaser'
import { GameState } from '../systems/GameState'

export class PreloadScene extends Phaser.Scene {
  constructor() {
    super({ key: 'PreloadScene' })
  }

  preload() {
    this.load.image('cyberpunk', 'assets/tilesets/cyberpunk.png')
    this.load.tilemapTiledJSON('overworld', 'assets/maps/overworld.json')
  }

  create() {
    // Cargar progreso guardado — usamos .then()/.catch() porque Phaser no awaita create()
    GameState.load()
      .catch(err => console.warn('Save load failed, starting fresh:', err))
      .then(() => this.scene.start('GameScene', { mode: 'overworld' }))
  }
}
