import type { ElementType } from './elements'

export type BehaviorKind = 'chaser' | 'shooter' | 'boss'

export interface EnemyDef {
  key: string
  name: string
  hp: number
  speed: number
  contactDamage: number
  behavior: BehaviorKind
  xpReward: number
  color: number
  size: number
  shootRange?: number
  shootCooldownMs?: number
  projectileDamage?: number
  /** Reducción de daño por elemento (0-1). */
  resistances?: Partial<Record<ElementType, number>>
  /** Multiplicador de daño recibido por elemento (>1 = debilidad). */
  weaknesses?: Partial<Record<ElementType, number>>
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
    resistances: { plasma: 0.6 },
    weaknesses: { fire: 1.5 },
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
    resistances: { electro: 0.7 },
    weaknesses: { plasma: 1.5 },
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
    resistances: { fire: 0.6 },
    weaknesses: { electro: 1.5 },
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
    resistances: { fire: 0.5, electro: 0.4 },
    weaknesses: { plasma: 1.5 },
  },
}
