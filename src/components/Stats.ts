/** Bloque de stats de una entidad. Componente reutilizable (player, y a futuro enemigos con stats ricas). */
export interface StatBlock {
  maxHp: number
  maxMana: number
  manaRegen: number
  /** Daño base del ataque melee. */
  meleeDamage: number
  /** Daño base del ataque a distancia. */
  rangedDamage: number
  /** Reduce el daño recibido (mínimo 1 siempre pasa). */
  defense: number
  moveSpeed: number
}

/** Daño efectivo tras defensa. Siempre pega al menos 1. */
export function applyDefense(raw: number, defense: number): number {
  return Math.max(1, Math.round(raw - defense))
}
