import Phaser from 'phaser'
import { GameState } from '../systems/GameState'

export class PreloadScene extends Phaser.Scene {
  constructor() {
    super({ key: 'PreloadScene' })
  }

  preload() {
    // TODO: cargar tilemaps, tilesets y sprites aquí
    // this.load.tilemapTiledJSON('map', 'assets/tilemaps/world.json')
    // this.load.spritesheet('player', 'assets/sprites/player.png', { frameWidth: 16, frameHeight: 16 })
  }

  create() {
    // Cargar progreso guardado — usamos .then()/.catch() porque Phaser no awaita create()
    GameState.load()
      .catch(err => console.warn('Save load failed, starting fresh:', err))
      .then(() => this.scene.start('GameScene', { mode: 'overworld' }))
  }
}
