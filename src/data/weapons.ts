/**
 * Armas data-driven. El tipo define cómo se comporta el botón A:
 * - melee  → ataque cuerpo a cuerpo, consume vida (risk/reward)
 * - ranged → proyectil, consume maná
 * El daño del arma se SUMA al stat correspondiente del jugador.
 */

export type WeaponType = 'melee' | 'ranged'

export interface WeaponDef {
  key: string
  name: string
  type: WeaponType
  /** Daño del arma (se suma a meleeDamage / rangedDamage del jugador). */
  damage: number
  cooldownMs: number
  /** Coste de vida por golpe (solo melee). */
  hpCost?: number
  /** Coste de maná por disparo (solo ranged). */
  manaCost?: number
  /** Alcance de la hitbox (solo melee). */
  range?: number
  /** Durabilidad máxima; 0 = inquebrable (ej. puños). Se gasta por uso y al llegar a 0 el arma se destruye. */
  maxDurability: number
  /** Color placeholder del pickup. */
  color: number
}

export const WEAPONS: Record<string, WeaponDef> = {
  fists: {
    key: 'fists',
    name: 'Puños',
    type: 'melee',
    damage: 1,
    cooldownMs: 300,
    hpCost: 0,
    range: 11,
    maxDurability: 0, // inquebrable (fallback)
    color: 0xd0a070,
  },
  sword: {
    key: 'sword',
    name: 'Espada',
    type: 'melee',
    damage: 2,
    cooldownMs: 350,
    hpCost: 1,
    range: 14,
    maxDurability: 30,
    color: 0xbdc3c7,
  },
  dagger: {
    key: 'dagger',
    name: 'Daga',
    type: 'melee',
    damage: 1,
    cooldownMs: 200,
    hpCost: 1,
    range: 10,
    maxDurability: 24,
    color: 0x95a5a6,
  },
  wand: {
    key: 'wand',
    name: 'Varita',
    type: 'ranged',
    damage: 1,
    cooldownMs: 450,
    manaCost: 3,
    maxDurability: 28,
    color: 0x9b59b6,
  },
  bow: {
    key: 'bow',
    name: 'Arco',
    type: 'ranged',
    damage: 2,
    cooldownMs: 600,
    manaCost: 2,
    maxDurability: 22,
    color: 0xe67e22,
  },
}

/** Arma con la que empieza un jugador nuevo. */
export const STARTING_WEAPON = 'sword'

/** Armas que pueden dropear (excluye puños). */
export const LOOTABLE_WEAPONS = Object.keys(WEAPONS).filter(k => k !== 'fists')
