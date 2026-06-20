import { WEAPONS } from '../data/weapons'

export interface ItemInstance {
  key: string
  durability: number
}

/** Arma indestructible de fallback cuando el arma equipada se rompe. */
export const KNIFE_KEY = 'knife'

export function makeItem(key: string): ItemInstance {
  const def = WEAPONS[key]
  return { key, durability: def?.maxDurability ?? 0 }
}

export function isUnbreakable(key: string): boolean {
  return (WEAPONS[key]?.maxDurability ?? 0) <= 0
}
