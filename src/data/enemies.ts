/**
 * Definiciones data-driven de enemigos. Balancear = editar este archivo,
 * sin tocar código. Los colores/tamaños son placeholders hasta tener arte.
 */

export type BehaviorKind = 'chaser' | 'shooter' | 'boss'

export interface EnemyDef {
  key: string
  name: string
  hp: number
  speed: number
  /** Daño por contacto con el jugador. */
  contactDamage: number
  behavior: BehaviorKind
  /** XP que otorga al morir. */
  xpReward: number
  // Placeholder visual
  color: number
  size: number
  // Parámetros de 'shooter'
  shootRange?: number
  shootCooldownMs?: number
  projectileDamage?: number
}

export const ENEMIES: Record<string, EnemyDef> = {
  slime: {
    key: 'slime',
    name: 'Nanolimo',
    hp: 4,
    speed: 24,
    contactDamage: 1,
    behavior: 'chaser',
    xpReward: 3,
    color: 0x2bff88,
    size: 12,
  },
  bat: {
    key: 'bat',
    name: 'Dron',
    hp: 2,
    speed: 48,
    contactDamage: 1,
    behavior: 'chaser',
    xpReward: 2,
    color: 0xb14aff,
    size: 10,
  },
  mage: {
    key: 'mage',
    name: 'Torreta',
    hp: 3,
    speed: 20,
    contactDamage: 1,
    behavior: 'shooter',
    xpReward: 5,
    color: 0xffa600,
    size: 12,
    shootRange: 90,
    shootCooldownMs: 1400,
    projectileDamage: 1,
  },
  golem: {
    key: 'golem',
    name: 'Mecha-Gólem',
    hp: 22,
    speed: 22,
    contactDamage: 2,
    behavior: 'boss',
    xpReward: 30,
    color: 0xff2d95,
    size: 26,
    shootCooldownMs: 1800,
    projectileDamage: 1,
  },
}
