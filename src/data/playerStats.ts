import type { StatBlock } from '../components/Stats'

/**
 * Progresión del jugador, data-driven. Balancear = editar este archivo.
 */

export const BASE_STATS: StatBlock = {
  maxHp: 6,
  maxMana: 10,
  manaRegen: 2,
  meleeDamage: 2,
  rangedDamage: 1,
  defense: 0,
  moveSpeed: 80,
}

/** Crecimiento sumado por cada nivel por encima de 1. */
const GROWTH: Partial<StatBlock> = {
  maxHp: 1,
  maxMana: 1,
  meleeDamage: 0.5,
  rangedDamage: 0.5,
  defense: 0.25,
}

export function statsForLevel(level: number): StatBlock {
  const lv = Math.max(0, level - 1)
  const g = (key: keyof StatBlock) => (GROWTH[key] ?? 0) * lv
  return {
    maxHp: Math.round(BASE_STATS.maxHp + g('maxHp')),
    maxMana: Math.round(BASE_STATS.maxMana + g('maxMana')),
    manaRegen: BASE_STATS.manaRegen,
    meleeDamage: Math.round(BASE_STATS.meleeDamage + g('meleeDamage')),
    rangedDamage: Math.round(BASE_STATS.rangedDamage + g('rangedDamage')),
    defense: Math.floor(BASE_STATS.defense + g('defense')),
    moveSpeed: BASE_STATS.moveSpeed,
  }
}

// Curva de XP: XP requerida para pasar del nivel L al L+1.
const XP_BASE = 5
const XP_GROWTH = 1.5

export function xpToNext(level: number): number {
  return Math.floor(XP_BASE * Math.pow(XP_GROWTH, level - 1))
}
