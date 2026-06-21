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
    height: 760,
  },
  input: {
    activePointers: 3,  // multi-touch: joystick + skill + skill simultáneos
  },
  fps: {
    target: 60,
    forceSetTimeOut: true,
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

// Chequea nuevo SW cada 30 s para que las actualizaciones lleguen rápido
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.ready.then(reg => {
    setInterval(() => reg.update(), 30_000)
  })
}
