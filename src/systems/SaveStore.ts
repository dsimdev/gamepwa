import type { ItemInstance } from '../items/types'

export interface SaveData {
  level: number
  xp: number
  depth?: number
  stash: ItemInstance[]
  equipped?: ItemInstance
  coins?: number
  stashCoins?: number
  chips?: number
  stashChips?: number
  ammo?: { fire?: number; electro?: number; plasma?: number }
  statPoints?: number
  statLevels?: Partial<Record<string, number>>
  statResetCount?: number
  respawnCount?: number
  hackUpgrades?: {
    terminalCharges: number
    terminalYield: number
    farmSpeed: number
    dungeonDiscount: number
    baseRegen: number
  }
}

export interface SaveStore {
  load(): Promise<SaveData | null>
  save(data: SaveData): Promise<void>
}
