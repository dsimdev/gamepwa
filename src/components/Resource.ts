/**
 * Recurso agotable con regeneración opcional. Componente reutilizable:
 * sirve para vida (HP) y maná. Pensado para entidades con stats (v0.6.0).
 */
export class Resource {
  current: number
  max: number
  regenPerSec: number

  constructor(max: number, regenPerSec = 0) {
    this.max = max
    this.regenPerSec = regenPerSec
    this.current = max
  }

  get ratio(): number {
    return this.max <= 0 ? 0 : this.current / this.max
  }

  get isEmpty(): boolean {
    return this.current <= 0
  }

  /** Intenta gastar `n`. Devuelve false si no alcanza (no descuenta nada). */
  spend(n: number): boolean {
    if (this.current < n) return false
    this.current -= n
    return true
  }

  /** Suma sin pasar del máximo. */
  add(n: number): void {
    this.current = Math.min(this.max, this.current + n)
  }

  /** Resta sin bajar de cero. */
  damage(n: number): void {
    this.current = Math.max(0, this.current - n)
  }

  /** Regeneración por frame. `deltaMs` = delta time del update de Phaser. */
  update(deltaMs: number): void {
    if (this.regenPerSec > 0 && this.current < this.max) {
      this.add((this.regenPerSec * deltaMs) / 1000)
    }
  }
}
