import Phaser from 'phaser'

/** Paleta cyberpunk: neón sobre oscuro. */
export const COLORS = {
  bg: 0x0a0a16,
  floorOverworld: 0x141826,
  wallOverworld: 0x2a2c4a,
  player: 0x00e5ff, // cyan neón
  projectile: 0x39ff14, // verde neón
  enemyProjectile: 0xff2d95, // magenta neón
  hp: 0xff2d55,
  hpDim: 0x4a0d1a,
  mana: 0x00e5ff,
  manaDim: 0x0a2336,
  xp: 0xf5d020,
  neonCyan: 0x00e5ff,
  neonMagenta: 0xff2d95,
  neonGreen: 0x39ff14,
  neonYellow: 0xf5d020,
  neonRed: 0xff2d55,
} as const

export const CSS = {
  light: '#bfeaff',
  dim: '#6b7a99',
  cyan: '#00e5ff',
  magenta: '#ff2d95',
  green: '#39ff14',
  yellow: '#f5d020',
  red: '#ff2d55',
} as const

/** Resolución de rasterizado del texto: lo hace nítido pese al zoom ×3. */
export const TEXT_RES = 4

/** Texto legible (alta resolución + monospace). Usar SIEMPRE en vez de scene.add.text. */
export function addLabel(
  scene: Phaser.Scene,
  x: number,
  y: number,
  text: string,
  size = 8,
  color: string = CSS.light
): Phaser.GameObjects.Text {
  return scene.add.text(x, y, text, {
    fontFamily: 'monospace',
    fontStyle: 'bold',
    fontSize: `${size}px`,
    color,
    resolution: TEXT_RES,
  })
}
