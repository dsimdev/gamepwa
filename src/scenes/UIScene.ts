import Phaser from 'phaser'
import { VirtualJoystick } from '../ui/VirtualJoystick'
import { ActionButton } from '../ui/ActionButton'
import { INPUT_KEYS } from '../systems/InputManager'
import { Player } from '../entities/Player'
import { GameState } from '../systems/GameState'
import { WEAPONS } from '../data/weapons'
import { isUnbreakable } from '../items/types'
import type { ItemInstance } from '../items/types'

const HEART_SIZE = 8
const HEART_GAP = 10
const MARGIN = 6
const MANA_BAR_W = 56
const MANA_BAR_H = 4
const XP_BAR_H = 2
const MAX_HEARTS = 10

export class UIScene extends Phaser.Scene {
  private player!: Player
  private mode: 'base' | 'run' = 'run'
  private info = ''

  private hearts: Phaser.GameObjects.GameObject[] = []
  private manaBar!: Phaser.GameObjects.Rectangle
  private xpBar!: Phaser.GameObjects.Rectangle
  private levelText!: Phaser.GameObjects.Text
  private equipText!: Phaser.GameObjects.Text
  private lastHp = -1
  private lastLevel = -1

  private panel?: Phaser.GameObjects.Container
  private panelKind?: 'bag' | 'stash'

  constructor() {
    super({ key: 'UIScene' })
  }

  init(data: { player: Player; mode?: 'base' | 'run'; info?: string }) {
    this.player = data.player
    this.mode = data.mode ?? 'run'
    this.info = data.info ?? ''
  }

  create() {
    const { width } = this.scale

    this.add.rectangle(0, 0, width, XP_BAR_H, 0x2c2c44).setOrigin(0, 0)
    this.xpBar = this.add.rectangle(0, 0, 0, XP_BAR_H, 0xf1c40f).setOrigin(0, 0)

    this.drawHealth(this.player.health.max, this.player.health.max)

    this.add.rectangle(MARGIN, MARGIN + HEART_SIZE + 3, MANA_BAR_W, MANA_BAR_H, 0x1b2a4a).setOrigin(0, 0)
    this.manaBar = this.add.rectangle(MARGIN, MARGIN + HEART_SIZE + 3, MANA_BAR_W, MANA_BAR_H, 0x3498db).setOrigin(0, 0)

    this.levelText = this.add.text(width - 4, 5, 'Lv 1', { fontSize: '8px', color: '#f1c40f' }).setOrigin(1, 0)

    // Botones de paneles
    this.addTextButton(width - 4, 16, '[BAG]', () => this.togglePanel('bag'))
    if (this.mode === 'base') this.addTextButton(width - 4, 26, '[BAÚL]', () => this.togglePanel('stash'))

    this.equipText = this.add.text(MARGIN, this.scale.height - 8, '', { fontSize: '7px', color: '#ecf0f1' }).setOrigin(0, 1)
    this.add.text(this.scale.width / 2, 4, this.info, { fontSize: '7px', color: '#95a5a6' }).setOrigin(0.5, 0)

    this.setupTouchControls()
    this.listenEvents()
  }

  private addTextButton(x: number, y: number, label: string, onTap: () => void) {
    this.add
      .text(x, y, label, { fontSize: '7px', color: '#95a5a6' })
      .setOrigin(1, 0)
      .setInteractive({ useHandCursor: true })
      .on(Phaser.Input.Events.POINTER_DOWN, onTap)
  }

  private listenEvents() {
    const ev = this.player.scene.events
    ev.off('toast')
    ev.on('toast', (msg: string) => this.showToast(msg))
    ev.off('stashed')
    ev.on('stashed', (count: number) => {
      this.showToast(`Depositado (${count})`)
      if (this.panelKind) this.refreshPanel()
    })
    ev.off('boss')
    ev.on('boss', (depth: number) => this.showToast(`¡Boss derrotado! Prof ${depth}`))
  }

  update() {
    const hp = Math.round(this.player.health.current)
    if (hp !== this.lastHp) {
      this.drawHealth(hp, this.player.health.max)
      this.lastHp = hp
    }
    this.manaBar.width = MANA_BAR_W * this.player.mana.ratio
    this.xpBar.width = this.scale.width * this.player.progression.xpRatio

    if (this.player.level !== this.lastLevel) {
      if (this.lastLevel !== -1) this.showLevelUp(this.player.level)
      this.lastLevel = this.player.level
      this.levelText.setText(`Lv ${this.player.level}`)
    }

    this.equipText.setText(`A: ${this.itemLabel(this.player.equippedItem)}   B: ${this.player.skill.name}`)
  }

  /** "Espada 24/30" (o solo nombre si es inquebrable). */
  private itemLabel(item: ItemInstance): string {
    const def = WEAPONS[item.key]
    if (!def) return item.key
    return def.maxDurability > 0 ? `${def.name} ${item.durability}/${def.maxDurability}` : def.name
  }

  // --- Paneles (bag / baúl) ---

  private togglePanel(kind: 'bag' | 'stash') {
    if (this.panel && this.panelKind === kind) {
      this.closePanel()
      return
    }
    this.closePanel()
    this.panelKind = kind
    this.refreshPanel()
  }

  private closePanel() {
    this.panel?.destroy()
    this.panel = undefined
    this.panelKind = undefined
  }

  private refreshPanel() {
    this.panel?.destroy()
    const { width, height } = this.scale
    const isBag = this.panelKind === 'bag'
    const items = isBag ? GameState.bag : GameState.stash
    const title = isBag ? `BAG (${items.length}/${GameState.bagCapacity})` : `BAÚL (${items.length})`

    const bg = this.add.rectangle(0, 0, width, height, 0x000000, 0.85).setOrigin(0, 0)
    const head = this.add.text(width / 2, 10, title, { fontSize: '9px', color: '#f1c40f' }).setOrigin(0.5, 0)
    const sub = this.add
      .text(width / 2, 22, isBag ? '(tocá un arma para equipar)' : '(tocá para pasar a la bag)', { fontSize: '6px', color: '#7f8c8d' })
      .setOrigin(0.5, 0)

    const rows: Phaser.GameObjects.GameObject[] = []
    if (items.length === 0) {
      rows.push(this.add.text(width / 2, 44, 'Vacío', { fontSize: '8px', color: '#7f8c8d' }).setOrigin(0.5, 0))
    } else {
      items.forEach((item, i) => {
        const row = this.add
          .text(20, 36 + i * 13, `• ${this.itemLabel(item)}`, { fontSize: '8px', color: '#ecf0f1' })
          .setOrigin(0, 0)
          .setInteractive({ useHandCursor: true })
          .on(Phaser.Input.Events.POINTER_DOWN, () => (isBag ? this.equipFromBag(i) : this.withdraw(i)))
        rows.push(row)
      })
    }

    const eq = this.add
      .text(width / 2, height - 22, `Equipado: ${this.itemLabel(this.player.equippedItem)}`, { fontSize: '7px', color: '#2ecc71' })
      .setOrigin(0.5, 0)
    const close = this.add
      .text(width / 2, height - 12, 'cerrar', { fontSize: '7px', color: '#95a5a6' })
      .setOrigin(0.5, 0)
      .setInteractive({ useHandCursor: true })
      .on(Phaser.Input.Events.POINTER_DOWN, () => this.closePanel())

    this.panel = this.add.container(0, 0, [bg, head, sub, ...rows, eq, close]).setDepth(5000)
  }

  private equipFromBag(i: number) {
    const item = GameState.bag[i]
    if (!item) return
    const prev = this.player.equippedItem
    GameState.bag.splice(i, 1)
    if (!isUnbreakable(prev.key)) GameState.bag.push(prev) // el arma anterior vuelve a la bag (puños se descartan)
    this.player.equip(item)
    GameState.equipped = item
    GameState.persist()
    this.showToast(`Equipado: ${WEAPONS[item.key].name}`)
    this.refreshPanel()
  }

  private withdraw(i: number) {
    if (GameState.withdrawFromStash(i)) this.refreshPanel()
    else this.showToast('Bag llena')
  }

  // --- Feedback ---

  private showToast(text: string) {
    const { width, height } = this.scale
    const t = this.add.text(width / 2, height - 50, text, { fontSize: '8px', color: '#ffffff' }).setOrigin(0.5).setDepth(6000)
    this.tweens.add({ targets: t, y: t.y - 12, alpha: 0, duration: 1000, ease: 'Cubic.Out', onComplete: () => t.destroy() })
  }

  private showLevelUp(level: number) {
    const { width, height } = this.scale
    const txt = this.add
      .text(width / 2, height / 2 - 30, `¡NIVEL ${level}!`, { fontSize: '14px', color: '#f1c40f' })
      .setOrigin(0.5)
      .setScale(0.5)
    this.tweens.add({ targets: txt, scale: 1, alpha: 0, y: txt.y - 16, duration: 900, ease: 'Cubic.Out', onComplete: () => txt.destroy() })
  }

  private setupTouchControls() {
    const { width, height } = this.scale
    new VirtualJoystick(this, (x, y) => this.registry.set(INPUT_KEYS.move, { x, y }))
    new ActionButton(this, width - 20, height - 18, 0xe74c3c, 'A',
      () => this.registry.set(INPUT_KEYS.attack, true),
      () => this.registry.set(INPUT_KEYS.attack, false))
    new ActionButton(this, width - 52, height - 40, 0x3498db, 'B',
      () => this.registry.set(INPUT_KEYS.cast, true),
      () => this.registry.set(INPUT_KEYS.cast, false))
  }

  private drawHealth(current: number, max: number) {
    this.hearts.forEach(h => h.destroy())
    this.hearts = []

    if (max <= MAX_HEARTS) {
      for (let i = 0; i < max; i++) {
        const x = MARGIN + i * HEART_GAP
        const color = i < current ? 0xe74c3c : 0x7f8c8d
        this.hearts.push(this.add.rectangle(x, MARGIN, HEART_SIZE, HEART_SIZE, color).setOrigin(0, 0))
      }
      return
    }

    const bw = 70
    this.hearts.push(this.add.rectangle(MARGIN, MARGIN, bw, HEART_SIZE, 0x4a0000).setOrigin(0, 0))
    this.hearts.push(this.add.rectangle(MARGIN, MARGIN, bw * (current / max), HEART_SIZE, 0xe74c3c).setOrigin(0, 0))
    this.hearts.push(this.add.text(MARGIN + bw + 4, MARGIN - 1, `${current}/${max}`, { fontSize: '7px', color: '#e74c3c' }).setOrigin(0, 0))
  }
}
