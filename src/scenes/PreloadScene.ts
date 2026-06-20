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

  async create() {
    // Cargar progreso guardado (nivel/xp/stash) antes de entrar a la base
    await GameState.load()
    this.scene.start('GameScene', { mode: 'base' })
  }
}
