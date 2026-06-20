import type { ItemInstance } from '../items/types'

export interface SaveData {
  level: number
  xp: number
  /** Profundidad: sube al derrotar bosses, escala la dificultad. */
  depth?: number
  /** Baúl: almacén persistente en la base. */
  stash: ItemInstance[]
  /** Arma equipada (persiste, se degrada). */
  equipped?: ItemInstance
}

/**
 * Capa de persistencia abstracta. El juego solo conoce esta interfaz, así que
 * cambiar de IndexedDB (local) a un backend (cloud saves) es enchufar otra
 * implementación sin tocar el resto. Ver GDD / decisión de backend.
 */
export interface SaveStore {
  load(): Promise<SaveData | null>
  save(data: SaveData): Promise<void>
}
