import type { StatBlock } from '../components/Stats'

export type StatKey = 'hp' | 'hpRegen' | 'mana' | 'manaRegen' | 'attack' | 'defense' | 'moveSpeed'

export const STAT_KEYS: StatKey[] = ['hp', 'hpRegen', 'mana', 'manaRegen', 'attack', 'defense', 'moveSpeed']

export const STAT_DEFS: Record<StatKey, { label: string; gainLabel: string }> = {
  hp:        { label: 'HP Máx',     gainLabel: '+5 hp' },
  hpRegen:   { label: 'HP Regen',   gainLabel: '+0.3/s' },
  mana:      { label: 'Maná Máx',   gainLabel: '+5 mp' },
  manaRegen: { label: 'Maná Regen', gainLabel: '+0.5/s' },
  attack:    { label: 'Ataque',     gainLabel: '+2 dmg' },
  defense:   { label: 'Defensa',    gainLabel: '+1 def' },
  moveSpeed: { label: 'Velocidad',  gainLabel: '+5 vel' },
}

const BASE: StatBlock = {
  maxHp:       10,
  hpRegen:     0.1,
  maxMana:     5,
  manaRegen:   1.0,
  meleeDamage: 1,
  rangedDamage: 1,
  defense:     1,
  moveSpeed:   80,
}

const LEVEL_GROWTH: Partial<StatBlock> = {
  maxHp:        1,
  maxMana:      0.5,
  meleeDamage:  0.3,
  rangedDamage: 0.3,
}

export function computeStats(level: number, statLevels: Partial<Record<StatKey, number>>): StatBlock {
  const lv = Math.max(0, level - 1)
  const g = (k: keyof StatBlock) => ((LEVEL_GROWTH[k] ?? 0) as number) * lv
  const sl = (k: StatKey) => statLevels[k] ?? 0

  return {
    maxHp:        Math.round(BASE.maxHp + g('maxHp') + 5 * sl('hp')),
    hpRegen:      BASE.hpRegen + 0.3 * sl('hpRegen'),
    maxMana:      Math.round(BASE.maxMana + g('maxMana') + 5 * sl('mana')),
    manaRegen:    BASE.manaRegen + 0.5 * sl('manaRegen'),
    meleeDamage:  Math.round(BASE.meleeDamage + g('meleeDamage') + 2 * sl('attack')),
    rangedDamage: Math.round(BASE.rangedDamage + g('rangedDamage') + 2 * sl('attack')),
    defense:      Math.floor(BASE.defense + g('defense') + sl('defense')),
    moveSpeed:    BASE.moveSpeed + 5 * sl('moveSpeed'),
  }
}

export function statsForLevel(level: number): StatBlock {
  return computeStats(level, {})
}

const XP_BASE = 5
const XP_GROWTH = 1.5
export function xpToNext(level: number): number {
  return Math.floor(XP_BASE * Math.pow(XP_GROWTH, level - 1))
}
