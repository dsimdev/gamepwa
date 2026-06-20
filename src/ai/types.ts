import type { Enemy } from '../entities/Enemy'
import type { Player } from '../entities/Player'

/**
 * Estrategia de IA intercambiable. Cada enemigo referencia un comportamiento
 * por dato (ENEMIES[x].behavior); el comportamiento es stateless (el estado,
 * como cooldowns, vive en el Enemy). Permite combinar libremente sin herencia.
 */
export interface AIBehavior {
  update(enemy: Enemy, player: Player, time: number, delta: number): void
}
