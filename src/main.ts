import Phaser from 'phaser'
import { BootScene } from './scenes/BootScene'
import { PreloadScene } from './scenes/PreloadScene'
import { GameScene } from './scenes/GameScene'
import { UIScene } from './scenes/UIScene'

// Muestra errores JS en pantalla en vez de pantalla blanca muda
window.addEventListener('error', (e) => {
  document.body.style.cssText = 'background:#000;color:#f55;padding:20px;font:12px monospace;overflow:auto'
  document.body.innerHTML = `<b>ERROR</b><br>${e.message}<br>${e.filename}:${e.lineno}`
})

// Fuerza DPR=1 para evitar que Phaser cree un canvas 2x/3x en phones de alta densidad
// Un canvas 1080x2280 en DPR=3 consume ~10MB de VRAM y funde phones de gama baja
try {
  Object.defineProperty(window, 'devicePixelRatio', { get: () => 1, configurable: true })
} catch (_) { /* no-op si el browser no permite override */ }

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
