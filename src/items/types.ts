import { WEAPONS } from '../data/weapons'

/**
 * Instancia de item: una copia concreta de un arma con su durabilidad actual.
 * Dos espadas pueden tener durabilidad distinta, por eso no alcanza con la key.
 */
export interface ItemInstance {
  key: string
  durability: number
}

/** Arma inquebrable de fallback cuando no tenés nada equipado. */
export const FISTS_KEY = 'fists'

/** Crea una instancia nueva (durabilidad al máximo). */
export function makeItem(key: string): ItemInstance {
  const def = WEAPONS[key]
  return { key, durability: def?.maxDurability ?? 0 }
}

/** Un arma es inquebrable si su durabilidad máxima es 0 (ej. puños). */
export function isUnbreakable(key: string): boolean {
  return (WEAPONS[key]?.maxDurability ?? 0) <= 0
}
