import { IndexedDBSaveStore } from './IndexedDBSaveStore'
import { WEAPONS, STARTING_WEAPON } from '../data/weapons'
import { makeItem } from '../items/types'
import type { SaveData } from './SaveStore'
import type { ItemInstance } from '../items/types'

const DEFAULT_BAG_CAPACITY = 8

/**
 * Estado global que sobrevive a los reinicios de escena (base ↔ run, muerte).
 * - equipped / stash (baúl) / level / xp / depth → persisten (IndexedDB)
 * - bag → solo en memoria: se pierde al morir o al recargar
 */
class GameStateClass {
  level = 1
  xp = 0
  depth = 0

  /** Arma equipada (persiste, se degrada). */
  equipped: ItemInstance = makeItem(STARTING_WEAPON)
  /** Baúl: almacén persistente de la base. */
  stash: ItemInstance[] = []
  /** Bag: lo que llevás encima en la run (en memoria, se pierde al morir). */
  bag: ItemInstance[] = []
  bagCapacity = DEFAULT_BAG_CAPACITY

  // Feedback de la última incursión, para mostrar al volver a la base
  lastOutcome: 'retreat' | 'death' | null = null

  private store = new IndexedDBSaveStore()

  async load(): Promise<void> {
    const data = await this.store.load()
    if (!data) return
    this.level = data.level
    this.xp = data.xp
    this.depth = data.depth ?? 0
    // Baúl: filtrar a items válidos (migración de saves viejos)
    this.stash = (data.stash ?? [])
      .filter(it => it && WEAPONS[it.key])
      .map(it => ({ key: it.key, durability: it.durability ?? WEAPONS[it.key].maxDurability }))
    // Equipo: validar; si no hay, arma inicial
    this.equipped =
      data.equipped && WEAPONS[data.equipped.key]
        ? { key: data.equipped.key, durability: data.equipped.durability }
        : makeItem(STARTING_WEAPON)
  }

  persist(): void {
    const data: SaveData = {
      level: this.level,
      xp: this.xp,
      depth: this.depth,
      stash: this.stash,
      equipped: this.equipped,
    }
    void this.store.save(data)
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

  /** Deposita toda la bag en el baúl. Devuelve cuántos guardó. */
  depositBag(): number {
    const n = this.bag.length
    this.stash.push(...this.bag)
    this.bag = []
    if (n > 0) this.persist()
    return n
  }

  /** Retira un item del baúl a la bag. */
  withdrawFromStash(index: number): boolean {
    if (index < 0 || index >= this.stash.length || this.bagFull) return false
    const [item] = this.stash.splice(index, 1)
    this.bag.push(item)
    this.persist()
    return true
  }
}

export const GameState = new GameStateClass()
