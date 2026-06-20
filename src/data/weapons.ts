import type { ElementType } from './elements'

export type WeaponType = 'melee' | 'ranged'

export interface WeaponDef {
  key: string
  name: string
  type: WeaponType
  damage: number
  cooldownMs: number
  hpCost?: number
  range?: number
  maxDurability: number
  color: number
  element?: ElementType
}

export const WEAPONS: Record<string, WeaponDef> = {
  knife: {
    key: 'knife',
    name: 'Filo Nano',
    type: 'melee',
    damage: 1,
    cooldownMs: 350,
    hpCost: 0,
    range: 12,
    maxDurability: 0,
    color: 0xaaaaaa,
  },
  blaster: {
    key: 'blaster',
    name: 'Blaster Térmico',
    type: 'ranged',
    element: 'fire',
    damage: 2,
    cooldownMs: 500,
    maxDurability: 24,
    color: 0xff5500,
  },
  railgun: {
    key: 'railgun',
    name: 'Rail Electro',
    type: 'ranged',
    element: 'electro',
    damage: 3,
    cooldownMs: 700,
    maxDurability: 20,
    color: 0xffd700,
  },
  caster: {
    key: 'caster',
    name: 'Cañón Plasma',
    type: 'ranged',
    element: 'plasma',
    damage: 2,
    cooldownMs: 450,
    maxDurability: 28,
    color: 0xb14aff,
  },
}

export const KNIFE_KEY = 'knife'
export const STARTING_WEAPON = 'knife'
export const LOOTABLE_WEAPONS = ['blaster', 'railgun', 'caster']
