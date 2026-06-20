import { xpToNext } from '../data/playerStats'

/** XP y nivel del jugador. */
export class Progression {
  level = 1
  xp = 0

  /** Suma XP y aplica los level-ups acumulados. Devuelve cuántos niveles subió. */
  addXp(amount: number): number {
    this.xp += amount
    let gained = 0
    while (this.xp >= xpToNext(this.level)) {
      this.xp -= xpToNext(this.level)
      this.level++
      gained++
    }
    return gained
  }

  get xpToNext(): number {
    return xpToNext(this.level)
  }

  get xpRatio(): number {
    const r = this.xp / this.xpToNext
    return r < 0 ? 0 : r > 1 ? 1 : r
  }

  /** Descuenta un porcentaje del XP del nivel actual sin poder bajar de nivel. */
  penalizeXp(fraction: number): void {
    this.xp = Math.max(0, this.xp - Math.floor(this.xp * fraction))
  }
}
