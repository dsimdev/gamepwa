import Phaser from 'phaser'

export const FONT_FAMILY = "system-ui, -apple-system, 'Segoe UI', sans-serif"
export const TEXT_RES = 4

/** Paleta cyberpunk: neón sobre oscuro. */
export const COLORS = {
  bg: 0x0a0a16,
  floorOverworld: 0x141826,
  wallOverworld: 0x2a2c4a,
  player: 0x00e5ff,
  projectile: 0x39ff14,
  enemyProjectile: 0xff2d95,
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

export function addLabel(
  scene: Phaser.Scene,
  x: number,
  y: number,
  text: string,
  size = 8,
  color: string = CSS.light
): Phaser.GameObjects.Text {
  return scene.add.text(x, y, text, {
    fontFamily: FONT_FAMILY,
    fontStyle: 'bold',
    fontSize: `${size}px`,
    color,
    resolution: TEXT_RES,
  })
}
