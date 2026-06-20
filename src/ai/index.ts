import type { AIBehavior } from './types'
import type { BehaviorKind } from '../data/enemies'
import { ChaserAI } from './ChaserAI'
import { ShooterAI } from './ShooterAI'
import { BossAI } from './BossAI'

/** Crea la estrategia de IA según el dato del enemigo. */
export function createBehavior(kind: BehaviorKind): AIBehavior {
  switch (kind) {
    case 'chaser':
      return new ChaserAI()
    case 'shooter':
      return new ShooterAI()
    case 'boss':
      return new BossAI()
  }
}
