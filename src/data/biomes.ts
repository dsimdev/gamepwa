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
    name: 'Sector Bio',
    floorColor: 0x10241c,
    wallColor: 0x1c3a2e,
    enemies: ['slime', 'bat'],
    boss: 'golem',
  },
  cave: {
    key: 'cave',
    name: 'Subsuelo',
    floorColor: 0x121226,
    wallColor: 0x24244a,
    enemies: ['bat', 'mage'],
    boss: 'golem',
  },
  ruins: {
    key: 'ruins',
    name: 'Data-Ruinas',
    floorColor: 0x241a2a,
    wallColor: 0x3a2a44,
    enemies: ['slime', 'mage'],
    boss: 'golem',
  },
}

export const BIOME_KEYS = Object.keys(BIOMES)
