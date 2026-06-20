/**
 * Definiciones data-driven de enemigos. Balancear = editar este archivo,
 * sin tocar código. Los colores/tamaños son placeholders hasta tener arte.
 */

export type BehaviorKind = 'chaser' | 'shooter'

export interface EnemyDef {
  key: string
  name: string
  hp: number
  speed: number
  /** Daño por contacto con el jugador. */
  contactDamage: number
  behavior: BehaviorKind
  // Placeholder visual
  color: number
  size: number
  // Parámetros de 'shooter'
  shootRange?: number
  shootCooldownMs?: number
  projectileDamage?: number
}

export const ENEMIES: Record<string, EnemyDef> = {
  slime: {
    key: 'slime',
    name: 'Slime',
    hp: 4,
    speed: 24,
    contactDamage: 1,
    behavior: 'chaser',
    color: 0x27ae60,
    size: 12,
  },
  bat: {
    key: 'bat',
    name: 'Murciélago',
    hp: 2,
    speed: 48,
    contactDamage: 1,
    behavior: 'chaser',
    color: 0x8e44ad,
    size: 10,
  },
  mage: {
    key: 'mage',
    name: 'Mago oscuro',
    hp: 3,
    speed: 20,
    contactDamage: 1,
    behavior: 'shooter',
    color: 0xe67e22,
    size: 12,
    shootRange: 90,
    shootCooldownMs: 1400,
    projectileDamage: 1,
  },
}
