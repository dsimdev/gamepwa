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

  coins = 0        // bolsillo — se pierden al morir
  stashCoins = 0   // banco — sobreviven la muerte
  chips = 0        // chips de acceso al dungeon — se farmean en terminales
  ammo: Record<ElementType, number> = { fire: 0, electro: 0, plasma: 0 }

  statPoints = 0
  statLevels: Partial<Record<StatKey, number>> = {}
  statResetCount = 0
  respawnCount = 0

  hackUpgrades = {
    terminalCharges: 0,   // 0-2: +1 carga por nivel (base 3)
    terminalYield:   0,   // 0-3: +1 chip por farm
    farmSpeed:       0,   // 0-3: -600ms por nivel (min 1200ms)
    dungeonDiscount: 0,   // 0-4: -1 chip entrada (min 1)
    baseRegen:       0,   // 0-3: +0.5x regen en base por nivel
  }

  static readonly HACK_MAX: Record<string, number> = {
    terminalCharges: 2,
    terminalYield:   3,
    farmSpeed:       3,
    dungeonDiscount: 4,
    baseRegen:       3,
  }

  get dungeonCost(): number { return Math.max(1, 5 - this.hackUpgrades.dungeonDiscount) }
  get baseRegenBonus(): number { return this.hackUpgrades.baseRegen * 0.5 }

  hackUpgradeCost(key: keyof typeof this.hackUpgrades): number {
    return Math.round(10 * Math.pow(2, this.hackUpgrades[key]))
  }

  buyHackUpgrade(key: keyof typeof this.hackUpgrades): boolean {
    const max = GameStateClass.HACK_MAX[key] ?? 0
    if (this.hackUpgrades[key] >= max) return false
    const cost = this.hackUpgradeCost(key)
    if (this.chips < cost) return false
    this.chips -= cost
    this.hackUpgrades[key]++
    this.persist()
    return true
  }

  get statResetCost(): number {
    return Math.round(20 * Math.pow(1.25, this.statResetCount))
  }

  lastOutcome: 'retreat' | 'death' | 'victory' | null = null

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
    this.stashCoins = data.stashCoins ?? 0
    this.chips = data.chips ?? 0
    this.ammo = {
      fire:    data.ammo?.fire    ?? 0,
      electro: data.ammo?.electro ?? 0,
      plasma:  data.ammo?.plasma  ?? 0,
    }
    this.statPoints = data.statPoints ?? 0
    this.statLevels = (data.statLevels ?? {}) as Partial<Record<StatKey, number>>
    this.statResetCount = data.statResetCount ?? 0
    this.respawnCount = data.respawnCount ?? 0
    if (data.hackUpgrades) this.hackUpgrades = { ...this.hackUpgrades, ...data.hackUpgrades }
    // Reconciliar nivel con puntos acumulados (evita save corrupto con level=1 + statPoints>0)
    const totalEarned = this.statPoints + Object.values(this.statLevels).reduce((s, v) => s + (v ?? 0), 0)
    if (this.level < 1 + totalEarned) this.level = 1 + totalEarned
  }

  persist(): void {
    const data: SaveData = {
      level: this.level,
      xp: this.xp,
      depth: this.depth,
      stash: this.stash,
      equipped: this.equipped,
      coins: this.coins,
      stashCoins: this.stashCoins,
      chips: this.chips,
      ammo: { ...this.ammo },
      statPoints: this.statPoints,
      statLevels: { ...this.statLevels },
      statResetCount: this.statResetCount,
      respawnCount: this.respawnCount,
      hackUpgrades: { ...this.hackUpgrades },
    }
    void this.store.save(data)
  }

  addStatPoints(n: number): void {
    this.statPoints += n
    this.persist()  // persistir inmediatamente para no perder el nivel ganado
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
    if (this.stashCoins < cost) return false
    const invested = Object.values(this.statLevels).reduce((s, v) => s + (v ?? 0), 0)
    if (invested === 0) return false
    this.stashCoins -= cost
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

  /** Mueve las coins del bolsillo al banco. Devuelve el monto depositado. */
  depositCoins(): number {
    const amount = this.coins
    if (amount <= 0) return 0
    this.stashCoins += amount
    this.coins = 0
    this.persist()
    return amount
  }

  addChips(amount: number): void {
    this.chips += amount
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

  async resetAll(): Promise<void> {
    await (this.store as any).clear()
    this.level = 1
    this.xp = 0
    this.depth = 0
    this.equipped = makeItem(STARTING_WEAPON)
    this.stash = []
    this.bag = []
    this.coins = 0
    this.stashCoins = 0
    this.chips = 0
    this.ammo = { fire: 0, electro: 0, plasma: 0 }
    this.statPoints = 0
    this.statLevels = {}
    this.statResetCount = 0
    this.respawnCount = 0
    this.hackUpgrades = { terminalCharges: 0, terminalYield: 0, farmSpeed: 0, dungeonDiscount: 0, baseRegen: 0 }
    this.lastOutcome = null
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
