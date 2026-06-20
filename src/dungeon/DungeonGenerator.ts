import { DIRS, keyOf } from './types'
import type { Dir, Dungeon, RoomData } from './types'

/**
 * Genera un dungeon estilo Binding of Isaac: salas en una grilla, conectadas
 * por crecimiento aleatorio desde la sala inicial. Las puertas se derivan de
 * la adyacencia final (permite loops, no solo árbol). TS puro, testeable.
 */
export function generateDungeon(targetRooms = 9): Dungeon {
  const rooms = new Map<string, RoomData>()

  const makeRoom = (x: number, y: number): RoomData => ({
    x,
    y,
    doors: { n: false, s: false, e: false, w: false },
    type: 'normal',
    cleared: false,
  })

  const start = makeRoom(0, 0)
  start.type = 'start'
  start.cleared = true
  rooms.set(keyOf(0, 0), start)

  const dirKeys = Object.keys(DIRS) as Dir[]
  const frontier: RoomData[] = [start]
  let guard = 0

  while (rooms.size < targetRooms && guard++ < 1000) {
    const base = frontier[Math.floor(Math.random() * frontier.length)]
    const dir = dirKeys[Math.floor(Math.random() * dirKeys.length)]
    const { dx, dy } = DIRS[dir]
    const nx = base.x + dx
    const ny = base.y + dy
    if (rooms.has(keyOf(nx, ny))) continue

    const room = makeRoom(nx, ny)
    rooms.set(keyOf(nx, ny), room)
    frontier.push(room)
  }

  // Derivar puertas de la adyacencia (conecta también salas vecinas no-árbol)
  for (const room of rooms.values()) {
    for (const dir of dirKeys) {
      const { dx, dy } = DIRS[dir]
      if (rooms.has(keyOf(room.x + dx, room.y + dy))) {
        room.doors[dir] = true
      }
    }
  }

  // Sala de boss: la más lejana de la inicial (distancia Manhattan)
  let boss = start
  let maxDist = -1
  for (const room of rooms.values()) {
    if (room === start) continue
    const dist = Math.abs(room.x) + Math.abs(room.y)
    if (dist > maxDist) {
      maxDist = dist
      boss = room
    }
  }
  if (boss !== start) boss.type = 'boss'

  return { rooms, start }
}
