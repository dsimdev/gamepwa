import Phaser from 'phaser'
import { VirtualJoystick } from '../ui/VirtualJoystick'
import { ActionButton } from '../ui/ActionButton'
import { INPUT_KEYS } from '../systems/InputManager'
import { Player } from '../entities/Player'
import { GameState } from '../systems/GameState'
import { WEAPONS } from '../data/weapons'
import { isUnbreakable } from '../items/types'
import { addLabel, COLORS, CSS } from '../ui/theme'
import { ELEMENT_CSS, ELEMENT_NAMES } from '../data/elements'
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
  private mode: 'overworld' | 'run' = 'run'
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

  init(data: { player: Player; mode?: 'overworld' | 'run'; info?: string }) {
    this.player = data.player
    this.mode = data.mode ?? 'run'
    this.info = data.info ?? ''
  }

  create() {
    const { width } = this.scale

    this.add.rectangle(0, 0, width, XP_BAR_H, 0x1a1a2e).setOrigin(0, 0)
    this.xpBar = this.add.rectangle(0, 0, 0, XP_BAR_H, COLORS.xp).setOrigin(0, 0)

    this.drawHealth(this.player.health.max, this.player.health.max)

    this.add.rectangle(MARGIN, MARGIN + HEART_SIZE + 3, MANA_BAR_W, MANA_BAR_H, COLORS.manaDim).setOrigin(0, 0)
    this.manaBar = this.add.rectangle(MARGIN, MARGIN + HEART_SIZE + 3, MANA_BAR_W, MANA_BAR_H, COLORS.mana).setOrigin(0, 0)

    this.levelText = addLabel(this, width - 4, 5, 'Lv 1', 8, CSS.yellow).setOrigin(1, 0)

    this.addTextButton(width - 4, 16, '[BAG]', () => this.togglePanel('bag'))
    if (this.mode !== 'run') this.addTextButton(width - 4, 27, '[BAÚL]', () => this.togglePanel('stash'))

    this.equipText = addLabel(this, MARGIN, this.scale.height - 7, '', 8, CSS.light).setOrigin(0, 1)
    addLabel(this, this.scale.width / 2, 4, this.info, 8, CSS.light).setOrigin(0.5, 0)

    this.setupTouchControls()
    this.listenEvents()
  }

  private addTextButton(x: number, y: number, label: string, onTap: () => void) {
    addLabel(this, x, y, label, 7, CSS.cyan)
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

    const item = this.player.equippedItem
    const def = WEAPONS[item.key]
    const elColor = def?.element ? ELEMENT_CSS[def.element] : CSS.light
    this.equipText.setColor(elColor)
    this.equipText.setText(`A: ${this.itemLabel(item)}`)
  }

  private itemLabel(item: ItemInstance): string {
    const def = WEAPONS[item.key]
    if (!def) return item.key
    const durStr = def.maxDurability > 0 ? ` ${item.durability}/${def.maxDurability}` : ''
    const elStr = def.element ? ` [${ELEMENT_NAMES[def.element]}]` : ''
    return `${def.name}${durStr}${elStr}`
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

    const bg = this.add.rectangle(0, 0, width, height, 0x0a0a16, 0.92).setOrigin(0, 0)
    const head = addLabel(this, width / 2, 10, title, 9, CSS.cyan).setOrigin(0.5, 0)
    const sub = addLabel(this, width / 2, 22, isBag ? '(tocá un arma para equipar)' : '(tocá para pasar a la bag)', 6, CSS.dim).setOrigin(0.5, 0)

    const rows: Phaser.GameObjects.GameObject[] = []
    if (items.length === 0) {
      rows.push(addLabel(this, width / 2, 44, 'Vacío', 8, CSS.dim).setOrigin(0.5, 0))
    } else {
      items.forEach((item, i) => {
        const def = WEAPONS[item.key]
        const rowColor = def?.element ? ELEMENT_CSS[def.element] : CSS.light
        const row = addLabel(this, 20, 36 + i * 13, `• ${this.itemLabel(item)}`, 8, rowColor)
          .setOrigin(0, 0)
          .setInteractive({ useHandCursor: true })
          .on(Phaser.Input.Events.POINTER_DOWN, () => (isBag ? this.equipFromBag(i) : this.withdraw(i)))
        rows.push(row)
      })
    }

    const eq = addLabel(this, width / 2, height - 22, `Equipado: ${this.itemLabel(this.player.equippedItem)}`, 7, CSS.green).setOrigin(0.5, 0)
    const close = addLabel(this, width / 2, height - 12, 'cerrar', 7, CSS.dim)
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
    if (!isUnbreakable(prev.key)) GameState.bag.push(prev)
    this.player.equip(item)
    GameState.equipped = item
    GameState.persist()
    this.showToast(`Equipado: ${WEAPONS[item.key]?.name ?? item.key}`)
    this.refreshPanel()
  }

  private withdraw(i: number) {
    if (GameState.withdrawFromStash(i)) this.refreshPanel()
    else this.showToast('Bag llena')
  }

  // --- Feedback ---

  private showToast(text: string) {
    const { width, height } = this.scale
    const t = addLabel(this, width / 2, height - 50, text, 8, CSS.light).setOrigin(0.5).setDepth(6000)
    this.tweens.add({ targets: t, y: t.y - 12, alpha: 0, duration: 1000, ease: 'Cubic.Out', onComplete: () => t.destroy() })
  }

  private showLevelUp(level: number) {
    const { width, height } = this.scale
    const txt = addLabel(this, width / 2, height / 2 - 30, `¡NIVEL ${level}!`, 14, CSS.yellow).setOrigin(0.5).setScale(0.5)
    this.tweens.add({ targets: txt, scale: 1, alpha: 0, y: txt.y - 16, duration: 900, ease: 'Cubic.Out', onComplete: () => txt.destroy() })
  }

  private setupTouchControls() {
    const { width, height } = this.scale
    new VirtualJoystick(this, (x, y) => this.registry.set(INPUT_KEYS.move, { x, y }))
    new ActionButton(this, width - 20, height - 18, COLORS.neonMagenta, 'A',
      () => this.registry.set(INPUT_KEYS.attack, true),
      () => this.registry.set(INPUT_KEYS.attack, false))
  }

  private drawHealth(current: number, max: number) {
    this.hearts.forEach(h => h.destroy())
    this.hearts = []

    if (max <= MAX_HEARTS) {
      for (let i = 0; i < max; i++) {
        const x = MARGIN + i * HEART_GAP
        const color = i < current ? COLORS.hp : 0x3a3a4a
        this.hearts.push(this.add.rectangle(x, MARGIN, HEART_SIZE, HEART_SIZE, color).setOrigin(0, 0))
      }
      return
    }

    const bw = 70
    this.hearts.push(this.add.rectangle(MARGIN, MARGIN, bw, HEART_SIZE, COLORS.hpDim).setOrigin(0, 0))
    this.hearts.push(this.add.rectangle(MARGIN, MARGIN, bw * (current / max), HEART_SIZE, COLORS.hp).setOrigin(0, 0))
    this.hearts.push(addLabel(this, MARGIN + bw + 4, MARGIN - 1, `${current}/${max}`, 8, CSS.light).setOrigin(0, 0))
  }
}
