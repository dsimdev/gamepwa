import Phaser from 'phaser'
import { BootScene } from './scenes/BootScene'
import { PreloadScene } from './scenes/PreloadScene'
import { GameScene } from './scenes/GameScene'
import { UIScene } from './scenes/UIScene'

// Muestra errores JS en pantalla en vez de pantalla blanca muda
const showError = (msg: string) => {
  document.body.style.cssText = 'background:#000;color:#f55;padding:20px;font:12px monospace;overflow:auto;white-space:pre-wrap'
  document.body.textContent = 'ERROR\n' + msg
}
window.addEventListener('error', (e) => showError(`${e.message}\n${e.filename}:${e.lineno}`))
window.addEventListener('unhandledrejection', (e) => showError(String(e.reason)))

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
  fps: { target: 60 },
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

// Chequea nuevo SW cada 10 minutos (no más frecuente — cada check descarga el bundle entero)
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.ready.then(reg => {
    setInterval(() => reg.update(), 10 * 60_000)
  })
}
