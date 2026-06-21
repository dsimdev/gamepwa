import type { ElementType } from './elements'

export type BehaviorKind = 'chaser' | 'shooter' | 'boss' | 'neutral'

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
    xpReward: 5,
    color: 0x2bff88,
    size: 24,
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
    xpReward: 4,
    color: 0xb14aff,
    size: 20,
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
    xpReward: 8,
    color: 0xffa600,
    size: 24,
    shootRange: 180,
    shootCooldownMs: 1400,
    projectileDamage: 1,
    resistances: { fire: 0.6 },
    weaknesses: { electro: 1.5 },
  },
  scavenger: {
    key: 'scavenger',
    name: 'Rebuscador',
    hp: 6,
    speed: 50,
    contactDamage: 1,
    behavior: 'neutral',
    xpReward: 2,  // overworld: muy poca XP para forzar a dungear
    color: 0x88bb44,
    size: 22,
    resistances: { plasma: 0.4 },
    weaknesses: { fire: 1.4 },
  },
  ow_guard: {
    key: 'mage',             // reutiliza textura/color de Torreta
    name: 'Guardia',
    hp: 4,
    speed: 24,
    contactDamage: 1,
    behavior: 'neutral',     // neutral hasta ser atacado o defender terminal
    xpReward: 6,
    color: 0xffa600,
    size: 24,
    shootRange: 160,
    shootCooldownMs: 1600,
    projectileDamage: 1,
    resistances: { fire: 0.4 },
    weaknesses: { electro: 1.5 },
  },
  miniboss: {
    key: 'miniboss',
    name: 'Centinela',
    hp: 18,
    speed: 30,
    contactDamage: 2,
    behavior: 'boss',
    xpReward: 35,
    color: 0xff6600,
    size: 44,
    shootCooldownMs: 1400,
    projectileDamage: 2,
    resistances: { fire: 0.3 },
    weaknesses: { electro: 1.4, plasma: 1.3 },
  },
  golem: {
    key: 'golem',
    name: 'Mecha-Gólem',
    hp: 22,
    speed: 22,
    contactDamage: 2,
    behavior: 'boss',
    xpReward: 60,
    color: 0xff2d95,
    size: 52,
    shootCooldownMs: 1800,
    projectileDamage: 1,
    resistances: { fire: 0.5, electro: 0.4 },
    weaknesses: { plasma: 1.5 },
  },
}
