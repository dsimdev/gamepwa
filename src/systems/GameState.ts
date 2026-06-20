import { IndexedDBSaveStore } from './IndexedDBSaveStore'
import { STARTING_WEAPON } from '../data/weapons'
import { STARTING_SKILL } from '../data/skills'
import type { SaveData, StashItem } from './SaveStore'

/**
 * Estado global que sobrevive a los reinicios de escena (base ↔ run, muerte).
 * Lo persistente (level/xp/stash) se guarda en IndexedDB; `carried` es solo
 * en memoria (el equipo que llevás encima ahora mismo).
 */
class GameStateClass {
  level = 1
  xp = 0
  depth = 0
  stash: StashItem[] = []

  // En memoria (no se persiste): equipo que llevás encima
  carriedWeapon = STARTING_WEAPON
  carriedSkill = STARTING_SKILL

  private store = new IndexedDBSaveStore()

  async load(): Promise<void> {
    const data = await this.store.load()
    if (data) {
      this.level = data.level
      this.xp = data.xp
      this.depth = data.depth ?? 0
      this.stash = data.stash ?? []
    }
  }

  /** Persiste lo que debe sobrevivir a un cierre del juego. */
  persist(): void {
    const data: SaveData = { level: this.level, xp: this.xp, depth: this.depth, stash: this.stash }
    void this.store.save(data)
  }

  /** Resetea el equipo al loadout básico (al iniciar una run o al morir). */
  resetLoadout(): void {
    this.carriedWeapon = STARTING_WEAPON
    this.carriedSkill = STARTING_SKILL
  }

  addToStash(item: StashItem): boolean {
    if (this.stash.some(s => s.kind === item.kind && s.key === item.key)) return false
    this.stash.push(item)
    this.persist()
    return true
  }
}

export const GameState = new GameStateClass()
