import Phaser from 'phaser'
import { BootScene } from './scenes/BootScene'
import { PreloadScene } from './scenes/PreloadScene'
import { GameScene } from './scenes/GameScene'
import { UIScene } from './scenes/UIScene'

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  backgroundColor: '#0a0a16',
  antialias: false,
  roundPixels: true,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: 360,
    height: 640,
  },
  fps: {
    target: 60,
    forceSetTimeOut: true,  // más estable en mobile que requestAnimationFrame nativo
  },
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { x: 0, y: 0 },
      fixedStep: false,   // sin catch-up de steps cuando hay lag
      debug: false,
    },
  },
  scene: [BootScene, PreloadScene, GameScene, UIScene],
}

new Phaser.Game(config)
