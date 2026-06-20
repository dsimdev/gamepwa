/**
 * Biomas data-driven. Cada incursión usa uno: define colores (piso/pared),
 * el pool de enemigos normales y el boss. Agregar variedad = editar este archivo.
 */

export interface BiomeDef {
  key: string
  name: string
  floorColor: number
  wallColor: number
  /** Claves de ENEMIES que aparecen como enemigos normales. */
  enemies: string[]
  /** Clave del boss (en ENEMIES). */
  boss: string
}

export const BIOMES: Record<string, BiomeDef> = {
  forest: {
    key: 'forest',
    name: 'Bosque',
    floorColor: 0x2d5a27,
    wallColor: 0x4a3728,
    enemies: ['slime', 'bat'],
    boss: 'golem',
  },
  cave: {
    key: 'cave',
    name: 'Caverna',
    floorColor: 0x33333f,
    wallColor: 0x22222c,
    enemies: ['bat', 'mage'],
    boss: 'golem',
  },
  ruins: {
    key: 'ruins',
    name: 'Ruinas',
    floorColor: 0x5a5042,
    wallColor: 0x3a342a,
    enemies: ['slime', 'mage'],
    boss: 'golem',
  },
}

export const BIOME_KEYS = Object.keys(BIOMES)
