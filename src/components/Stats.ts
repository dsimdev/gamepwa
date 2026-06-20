export interface StatBlock {
  maxHp: number
  hpRegen: number
  maxMana: number
  manaRegen: number
  meleeDamage: number
  rangedDamage: number
  defense: number
  moveSpeed: number
}

export function applyDefense(raw: number, defense: number): number {
  return Math.max(1, Math.round(raw - defense))
}
