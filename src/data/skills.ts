/**
 * Skills defensivas data-driven (botón B). Todas consumen maná.
 * - heal  → al presionar, gasta maná y cura vida
 * - block → mientras se mantiene, anula el daño y drena maná
 */

export type SkillType = 'heal' | 'block'

export interface SkillDef {
  key: string
  name: string
  type: SkillType
  /** heal: maná por uso. */
  manaCost?: number
  /** heal: vida restaurada por uso. */
  healAmount?: number
  /** heal: cooldown entre usos. */
  cooldownMs?: number
  /** block: maná drenado por segundo mientras se mantiene. */
  manaDrainPerSec?: number
  color: number
}

export const SKILLS: Record<string, SkillDef> = {
  heal: {
    key: 'heal',
    name: 'Nanocura',
    type: 'heal',
    manaCost: 4,
    healAmount: 2,
    cooldownMs: 700,
    color: 0x2ecc71,
  },
  block: {
    key: 'block',
    name: 'Escudo',
    type: 'block',
    manaDrainPerSec: 5,
    color: 0x3498db,
  },
}

/** Skill inicial del jugador. */
export const STARTING_SKILL = 'heal'
