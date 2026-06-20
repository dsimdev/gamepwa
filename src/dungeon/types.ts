export type Dir = 'n' | 's' | 'e' | 'w'
export type RoomType = 'start' | 'normal' | 'miniboss' | 'boss'

export interface RoomData {
  x: number
  y: number
  doors: Record<Dir, boolean>
  type: RoomType
  /** Sala ya limpiada (enemigos derrotados). Se persiste al revisitar. */
  cleared: boolean
}

export interface Dungeon {
  rooms: Map<string, RoomData>
  start: RoomData
}

export const keyOf = (x: number, y: number): string => `${x},${y}`

/** Desplazamiento de grilla y puerta opuesta para cada dirección. */
export const DIRS: Record<Dir, { dx: number; dy: number; opposite: Dir }> = {
  n: { dx: 0, dy: -1, opposite: 's' },
  s: { dx: 0, dy: 1, opposite: 'n' },
  e: { dx: 1, dy: 0, opposite: 'w' },
  w: { dx: -1, dy: 0, opposite: 'e' },
}
