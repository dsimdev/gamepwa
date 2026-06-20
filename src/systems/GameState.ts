import { IndexedDBSaveStore } from './IndexedDBSaveStore'
import { WEAPONS, STARTING_WEAPON } from '../data/weapons'
import { makeItem } from '../items/types'
import type { SaveData } from './SaveStore'
import type { ItemInstance } from '../items/types'
import type { StatKey } from '../data/playerStats'
import type { ElementType } from '../data/elements'

const DEFAULT_BAG_CAPACITY = 8
const STAT_POINTS_PER_LEVEL = 1

class GameStateClass {
  level = 1
  xp = 0
  depth = 0

  equipped: ItemInstance = makeItem(STARTING_WEAPON)
  stash: ItemInstance[] = []
  bag: ItemInstance[] = []
  bagCapacity = DEFAULT_BAG_CAPACITY

  coins = 0
  ammo: Record<ElementType, number> = { fire: 0, electro: 0, plasma: 0 }

  statPoints = 0
  statLevels: Partial<Record<StatKey, number>> = {}
  statResetCount = 0

  get statResetCost(): number {
    return Math.round(20 * Math.pow(1.25, this.statResetCount))
  }

  lastOutcome: 'retreat' | 'death' | null = null

  private store = new IndexedDBSaveStore()

  async load(): Promise<void> {
    const data = await this.store.load()
    if (!data) return
    this.level = data.level
    this.xp = data.xp
    this.depth = data.depth ?? 0
    this.stash = (data.stash ?? [])
      .filter(it => it && WEAPONS[it.key])
      .map(it => ({ key: it.key, durability: it.durability ?? WEAPONS[it.key].maxDurability }))
    this.equipped =
      data.equipped && WEAPONS[data.equipped.key]
        ? { key: data.equipped.key, durability: data.equipped.durability }
        : makeItem(STARTING_WEAPON)
    this.coins = data.coins ?? 0
    this.ammo = {
      fire:    data.ammo?.fire    ?? 0,
      electro: data.ammo?.electro ?? 0,
      plasma:  data.ammo?.plasma  ?? 0,
    }
    this.statPoints = data.statPoints ?? 0
    this.statLevels = (data.statLevels ?? {}) as Partial<Record<StatKey, number>>
    this.statResetCount = data.statResetCount ?? 0
  }

  persist(): void {
    const data: SaveData = {
      level: this.level,
      xp: this.xp,
      depth: this.depth,
      stash: this.stash,
      equipped: this.equipped,
      coins: this.coins,
      ammo: { ...this.ammo },
      statPoints: this.statPoints,
      statLevels: { ...this.statLevels },
      statResetCount: this.statResetCount,
    }
    void this.store.save(data)
  }

  addStatPoints(n: number): void {
    this.statPoints += n
  }

  allocateStat(key: StatKey): boolean {
    if (this.statPoints <= 0) return false
    this.statPoints--
    this.statLevels[key] = (this.statLevels[key] ?? 0) + 1
    this.persist()
    return true
  }

  resetStats(): boolean {
    const cost = this.statResetCost
    if (this.coins < cost) return false
    const invested = Object.values(this.statLevels).reduce((s, v) => s + (v ?? 0), 0)
    if (invested === 0) return false
    this.coins -= cost
    this.statPoints += invested
    this.statLevels = {}
    this.statResetCount++
    this.persist()
    return true
  }

  addCoins(amount: number): void {
    this.coins += amount
    this.persist()
  }

  addAmmo(element: ElementType, amount: number): void {
    this.ammo[element] = (this.ammo[element] ?? 0) + amount
    this.persist()
  }

  consumeAmmo(element: ElementType): boolean {
    if ((this.ammo[element] ?? 0) <= 0) return false
    this.ammo[element]--
    return true
  }

  // --- Bag ---

  get bagFull(): boolean {
    return this.bag.length >= this.bagCapacity
  }

  addToBag(item: ItemInstance): boolean {
    if (this.bagFull) return false
    this.bag.push(item)
    return true
  }

  clearBag(): void {
    this.bag = []
  }

  depositBag(): number {
    const n = this.bag.length
    this.stash.push(...this.bag)
    this.bag = []
    if (n > 0) this.persist()
    return n
  }

  withdrawFromStash(index: number): boolean {
    if (index < 0 || index >= this.stash.length || this.bagFull) return false
    const [item] = this.stash.splice(index, 1)
    this.bag.push(item)
    this.persist()
    return true
  }
}

export const GameState = new GameStateClass()
export { STAT_POINTS_PER_LEVEL }
