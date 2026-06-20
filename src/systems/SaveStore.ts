import type { PickupKind } from '../entities/Pickup'

export interface StashItem {
  kind: PickupKind
  key: string
}

export interface SaveData {
  level: number
  xp: number
  stash: StashItem[]
  /** Profundidad: sube al derrotar bosses, escala la dificultad. */
  depth?: number
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
