import type { ItemInstance } from '../items/types'

export interface SaveData {
  level: number
  xp: number
  depth?: number
  stash: ItemInstance[]
  equipped?: ItemInstance
  coins?: number
  ammo?: { fire?: number; electro?: number; plasma?: number }
  statPoints?: number
  statLevels?: Partial<Record<string, number>>
  statResetCount?: number
}

export interface SaveStore {
  load(): Promise<SaveData | null>
  save(data: SaveData): Promise<void>
}
