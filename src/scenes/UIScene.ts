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
import type { ElementType } from '../data/elements'
import { STAT_DEFS, STAT_KEYS } from '../data/playerStats'
import type { ItemInstance } from '../items/types'
import type { StatKey } from '../data/playerStats'
import type { BuildingKind } from '../scenes/GameScene'

const HEART_SIZE = 16
const HEART_GAP  = 20
const MARGIN     = 12
const MANA_BAR_W = 112
const MANA_BAR_H = 8
const XP_BAR_H   = 4
const MAX_HEARTS  = 10
const NAVBAR_H    = 44
const PANEL_RATIO = 0.74   // el panel ocupa el 74% de la altura de pantalla

export class UIScene extends Phaser.Scene {
  private player!: Player
  private mode: 'overworld' | 'run' = 'run'
  private info = ''

  private hearts: Phaser.GameObjects.GameObject[] = []
  private manaBar!: Phaser.GameObjects.Rectangle
  private xpBar!: Phaser.GameObjects.Rectangle
  private levelText!: Phaser.GameObjects.Text
  private pointsText!: Phaser.GameObjects.Text
  private lastHp    = -1
  private lastLevel = -1

  private panel?: Phaser.GameObjects.Container
  private backdrop?: Phaser.GameObjects.Rectangle
  private panelKind?: 'bag' | 'stash' | 'stats' | BuildingKind
  private navLabels: Partial<Record<string, Phaser.GameObjects.Text>> = {}

  // Altura del panel y posición Y cuando está abierto
  private get panelH(): number { return Math.floor(this.scale.height * PANEL_RATIO) }
  private get panelOpenY(): number { return this.scale.height - NAVBAR_H - this.panelH }

  constructor() { super({ key: 'UIScene' }) }

  init(data: { player: Player; mode?: 'overworld' | 'run'; info?: string }) {
    this.player    = data.player
    this.mode      = data.mode ?? 'run'
    this.info      = data.info ?? ''
    this.lastLevel = -1
    this.lastHp    = -1
  }

  create() {
    const { width } = this.scale

    // XP bar (top)
    this.add.rectangle(0, 0, width, XP_BAR_H, 0x1a1a2e).setOrigin(0, 0)
    this.xpBar = this.add.rectangle(0, 0, 0, XP_BAR_H, COLORS.xp).setOrigin(0, 0)

    // HP + mana
    this.drawHealth(this.player.health.max, this.player.health.max)
    this.add.rectangle(MARGIN, MARGIN + HEART_SIZE + 6, MANA_BAR_W, MANA_BAR_H, COLORS.manaDim).setOrigin(0, 0)
    this.manaBar = this.add.rectangle(MARGIN, MARGIN + HEART_SIZE + 6, MANA_BAR_W, MANA_BAR_H, COLORS.mana).setOrigin(0, 0)

    // HUD labels top-right
    this.levelText  = addLabel(this, width - 8, 10, 'Lv 1', 16, CSS.yellow).setOrigin(1, 0)
    this.pointsText = addLabel(this, width - 8, 28, '',      14, CSS.yellow).setOrigin(1, 0)

    // Info label (biome / mode) — debajo de la barra de maná
    addLabel(this, width / 2, 48, this.info, 12, CSS.dim).setOrigin(0.5, 0)

    this.buildNavBar()
    this.setupTouchControls()
    this.listenEvents()
  }

  // ─── Nav bar ────────────────────────────────────────────────────────────────

  private buildNavBar() {
    const { width, height } = this.scale
    const bg   = this.add.rectangle(0, height - NAVBAR_H, width, NAVBAR_H, 0x07070f, 0.97).setOrigin(0, 0)
    const line = this.add.rectangle(0, height - NAVBAR_H, width, 1, 0x1a1a3a).setOrigin(0, 0)

    const tabs: Array<{ key: 'bag' | 'stash' | 'stats'; label: string }> = [
      { key: 'bag',   label: 'BAG'   },
      { key: 'stats', label: 'STATS' },
      { key: 'stash', label: 'BAÚL'  },
    ]
    const tabW = width / tabs.length
    const items: Phaser.GameObjects.GameObject[] = [bg, line]

    tabs.forEach(({ key, label }, i) => {
      const tx = tabW * i + tabW / 2
      const ty = height - NAVBAR_H / 2
      const hit = this.add.rectangle(tabW * i, height - NAVBAR_H, tabW, NAVBAR_H, 0, 0)
        .setOrigin(0, 0).setInteractive({ useHandCursor: true })
      hit.on(Phaser.Input.Events.POINTER_DOWN, () => this.togglePanel(key))
      const lbl = addLabel(this, tx, ty, label, 14, CSS.dim).setOrigin(0.5, 0.5)
      this.navLabels[key] = lbl
      items.push(hit, lbl)
    })

    this.add.container(0, 0, items).setDepth(4900)
  }

  private updateNavHighlight() {
    for (const [key, lbl] of Object.entries(this.navLabels)) {
      lbl?.setColor(key === this.panelKind ? CSS.cyan : CSS.dim)
    }
  }

  // ─── Panel open / close / toggle ────────────────────────────────────────────

  private togglePanel(kind: 'bag' | 'stash' | 'stats') {
    if (this.panelKind === kind) { this.closePanel(); return }
    this.closePanel(false)
    this.openPanel(kind)
  }

  private openPanel(kind: 'bag' | 'stash' | 'stats' | BuildingKind, animate = true) {
    const { width, height } = this.scale
    this.panelKind = kind

    // Backdrop semitransparente detrás del panel — tap para cerrar
    this.backdrop = this.add
      .rectangle(0, 0, width, height - NAVBAR_H, 0x000000, 0.45)
      .setOrigin(0, 0).setDepth(4800).setInteractive()
    this.backdrop.on(Phaser.Input.Events.POINTER_DOWN, () => this.closePanel())

    // Construir contenido
    if (kind === 'stats') this.buildStatsPanel()
    else if (kind === 'bag' || kind === 'stash') this.buildInventoryPanel()
    else this.buildBuildingPanel(kind)

    // Animación desde abajo
    if (this.panel) {
      if (animate) {
        this.panel.setY(height - NAVBAR_H)
        this.tweens.add({ targets: this.panel, y: this.panelOpenY, duration: 220, ease: 'Cubic.Out' })
      } else {
        this.panel.setY(this.panelOpenY)
      }
    }
    this.updateNavHighlight()
  }

  private closePanel(animate = true) {
    const cleanup = () => {
      this.panel?.destroy();    this.panel    = undefined
      this.backdrop?.destroy(); this.backdrop = undefined
      this.panelKind = undefined
      this.updateNavHighlight()
    }
    if (!this.panel || !animate) { cleanup(); return }
    this.backdrop?.destroy(); this.backdrop = undefined
    this.tweens.add({
      targets: this.panel,
      y: this.scale.height,
      duration: 180,
      ease: 'Cubic.In',
      onComplete: cleanup,
    })
  }

  private refreshPanel() {
    if (!this.panelKind) return
    const kind = this.panelKind
    this.closePanel(false)
    this.openPanel(kind, false)
  }

  // ─── Panel BAG / BAÚL ───────────────────────────────────────────────────────

  private buildInventoryPanel() {
    this.panel?.destroy()
    const { width } = this.scale
    const pH = this.panelH
    const isBag = this.panelKind === 'bag'

    if (!isBag && this.mode === 'run') {
      // Baúl no disponible en dungeon
      const bg   = this.add.rectangle(0, 0, width, pH, 0x0a0a18, 0.97).setOrigin(0, 0)
      const hdl  = this.makeHandle(width)
      const msg  = addLabel(this, width / 2, pH / 2, 'Solo disponible en el overworld', 14, CSS.dim).setOrigin(0.5, 0.5)
      this.panel = this.add.container(0, this.panelOpenY, [bg, hdl, msg]).setDepth(5000)
      return
    }

    const items = isBag ? GameState.bag : GameState.stash
    const title = isBag
      ? `BAG  ${items.length}/${GameState.bagCapacity}`
      : `BAÚL  (${items.length})`

    const bg  = this.add.rectangle(0, 0, width, pH, 0x0a0a18, 0.97).setOrigin(0, 0)
    const hdl = this.makeHandle(width)
    const hd  = addLabel(this, width / 2, 22, title, 17, CSS.cyan).setOrigin(0.5, 0)
    const sub = addLabel(this, width / 2, 42, isBag ? 'tocá para equipar' : 'tocá para pasar a bag', 12, CSS.dim).setOrigin(0.5, 0)

    const extras: Phaser.GameObjects.GameObject[] = []
    if (isBag) {
      extras.push(
        addLabel(this, 20, 62, `◆ ${GameState.coins} coins`, 12, '#e74c3c').setOrigin(0, 0),
        addLabel(this, 20, 78, `⬡ ${GameState.chips} chips`, 12, CSS.cyan).setOrigin(0, 0),
      )
      const els: ElementType[] = ['fire', 'electro', 'plasma']
      const elW = (width - 40) / 3
      els.forEach((el, i) => {
        extras.push(addLabel(this, 20 + i * elW, 94, `${ELEMENT_NAMES[el]}: ${GameState.ammo[el]}`, 12, ELEMENT_CSS[el]).setOrigin(0, 0))
      })
    } else {
      extras.push(addLabel(this, 20, 62, `◆ ${GameState.stashCoins} coins en banco`, 12, CSS.yellow).setOrigin(0, 0))
    }

    const startY = isBag ? 114 : 84
    const rows: Phaser.GameObjects.GameObject[] = []
    if (items.length === 0) {
      rows.push(addLabel(this, width / 2, startY, 'Vacío', 15, CSS.dim).setOrigin(0.5, 0))
    } else {
      items.forEach((item, i) => {
        const def = WEAPONS[item.key]
        const color = def?.element ? ELEMENT_CSS[def.element] : CSS.light
        const row = addLabel(this, 20, startY + i * 26, `• ${this.itemLabel(item)}`, 14, color)
          .setOrigin(0, 0).setInteractive({ useHandCursor: true })
          .on(Phaser.Input.Events.POINTER_DOWN, () => isBag ? this.equipFromBag(i) : this.withdraw(i))
        rows.push(row)
      })
    }

    const eq = addLabel(this, width / 2, pH - 14, `Equipado: ${this.itemLabel(this.player.equippedItem)}`, 13, CSS.green).setOrigin(0.5, 1)

    this.panel = this.add.container(0, this.panelOpenY, [bg, hdl, hd, sub, ...extras, ...rows, eq]).setDepth(5000)
  }

  // ─── Panel STATS ────────────────────────────────────────────────────────────

  private buildStatsPanel() {
    this.panel?.destroy()
    const { width } = this.scale
    const pH = this.panelH
    const pts = GameState.statPoints

    const bg    = this.add.rectangle(0, 0, width, pH, 0x0a0a18, 0.97).setOrigin(0, 0)
    const hdl   = this.makeHandle(width)
    const hd    = addLabel(this, width / 2, 22, 'STATS', 17, CSS.cyan).setOrigin(0.5, 0)
    const ptsLbl = addLabel(this, width / 2, 42,
      pts > 0 ? `★ ${pts} puntos disponibles` : 'Sin puntos disponibles',
      13, pts > 0 ? CSS.yellow : CSS.dim).setOrigin(0.5, 0)

    const children: Phaser.GameObjects.GameObject[] = [bg, hdl, hd, ptsLbl]

    STAT_KEYS.forEach((key: StatKey, i: number) => {
      const def = STAT_DEFS[key]
      const val = this.statCurrentValue(key)
      const y   = 64 + i * 30
      children.push(
        addLabel(this, 20, y, def.label, 13, CSS.light).setOrigin(0, 0),
        addLabel(this, width - 96, y, val, 13, CSS.cyan).setOrigin(1, 0),
        addLabel(this, width - 92, y, def.gainLabel, 11, CSS.dim).setOrigin(0, 0),
      )
      if (pts > 0) {
        const plus = addLabel(this, width - 8, y, '[+]', 13, CSS.yellow)
          .setOrigin(1, 0).setInteractive({ useHandCursor: true })
          .on(Phaser.Input.Events.POINTER_DOWN, () => {
            if (GameState.allocateStat(key)) {
              this.player.scene.events.emit('statschanged')
              this.refreshPanel()
            }
          })
        children.push(plus)
      }
    })

    const invested = Object.values(GameState.statLevels).reduce((s, v) => s + (v ?? 0), 0)
    if (invested > 0) {
      const cost     = GameState.statResetCost
      const canAfford = GameState.stashCoins >= cost
      const resetBtn = addLabel(this, width / 2, pH - 14, `[RESET — ${cost} ◈ banco]`, 13, canAfford ? CSS.yellow : CSS.dim)
        .setOrigin(0.5, 1).setInteractive({ useHandCursor: canAfford })
        .on(Phaser.Input.Events.POINTER_DOWN, () => {
          if (!GameState.resetStats()) { this.showToast('Coins en banco insuficientes'); return }
          this.player.scene.events.emit('statschanged')
          this.refreshPanel()
        })
      children.push(resetBtn)
    }

    this.panel = this.add.container(0, this.panelOpenY, children).setDepth(5000)
  }

  // ─── Paneles de edificios ────────────────────────────────────────────────────

  private buildBuildingPanel(kind: BuildingKind) {
    this.panel?.destroy()
    if      (kind === 'health') this.buildHealthPanel()
    else if (kind === 'market') this.buildMarketPanel()
    else if (kind === 'repair') this.buildRepairPanel()
    else if (kind === 'hack')   this.buildHackPanel()
  }

  private buildHealthPanel() {
    const { width } = this.scale
    const pH = this.panelH
    const depth = GameState.depth
    const scale = 1 + depth * 0.4

    const cost50  = Math.round(8 * scale)
    const costFull = Math.round(18 * scale)
    const costMana = Math.round(5 * (1 + depth * 0.3))

    const hp     = this.player.health
    const mana   = this.player.mana
    const coins  = GameState.coins

    const bg  = this.add.rectangle(0, 0, width, pH, 0x0a0a18, 0.97).setOrigin(0, 0)
    const hdl = this.makeHandle(width)
    const hd  = addLabel(this, width / 2, 22, 'CENTRO DE SALUD', 17, '#2ecc71').setOrigin(0.5, 0)
    addLabel(this, width / 2, 44, `HP ${Math.round(hp.current)}/${hp.max}  ·  Maná ${Math.round(mana.current)}/${mana.max}`, 12, CSS.dim).setOrigin(0.5, 0)
    addLabel(this, 20, 44, `◆ ${coins}`, 12, '#e74c3c').setOrigin(0, 0)

    const makeBtn = (y: number, label: string, cost: number, enabled: boolean, action: () => void) => {
      const col = enabled ? CSS.light : CSS.dim
      const costCol = enabled ? CSS.yellow : CSS.dim
      const row = this.add.rectangle(width / 2, y + 20, width - 32, 40, 0x12203a, enabled ? 0.8 : 0.3)
        .setOrigin(0.5, 0).setStrokeStyle(1, enabled ? 0x2ecc71 : 0x223322)
      const lbl = addLabel(this, 28, y + 22, label, 14, col).setOrigin(0, 0)
      const cst = addLabel(this, width - 28, y + 22, `${cost} ◆`, 14, costCol).setOrigin(1, 0)
      if (enabled) {
        row.setInteractive({ useHandCursor: true })
        row.on(Phaser.Input.Events.POINTER_DOWN, () => { action(); this.refreshPanel() })
      }
      return [row, lbl, cst]
    }

    const can50   = coins >= cost50  && hp.current < hp.max
    const canFull = coins >= costFull && hp.current < hp.max
    const canMana = coins >= costMana && mana.current < mana.max

    const children: Phaser.GameObjects.GameObject[] = [bg, hdl, hd]
    children.push(...makeBtn(70,  `Curar 50% HP`,   cost50,   can50,   () => { GameState.coins -= cost50;   GameState.persist(); this.player.health.add(Math.floor(hp.max * 0.5)) }))
    children.push(...makeBtn(120, `Curar Full HP`,  costFull, canFull, () => { GameState.coins -= costFull; GameState.persist(); this.player.health.add(hp.max) }))
    children.push(...makeBtn(170, `Restaurar Maná`, costMana, canMana, () => { GameState.coins -= costMana; GameState.persist(); this.player.mana.add(mana.max) }))

    this.panel = this.add.container(0, this.panelOpenY, children).setDepth(5000)
  }

  private buildMarketPanel() {
    const { width } = this.scale
    const pH = this.panelH
    const scale = 1 + GameState.depth * 0.3
    const prices: Record<ElementType, number> = {
      fire:    Math.round(10 * scale),
      electro: Math.round(12 * scale),
      plasma:  Math.round(15 * scale),
    }
    const coins = GameState.coins

    const bg  = this.add.rectangle(0, 0, width, pH, 0x0a0a18, 0.97).setOrigin(0, 0)
    const hdl = this.makeHandle(width)
    const hd  = addLabel(this, width / 2, 22, 'MARKET', 17, '#f1c40f').setOrigin(0.5, 0)
    addLabel(this, 20, 44, `◆ ${coins} coins`, 12, '#e74c3c').setOrigin(0, 0)
    addLabel(this, width / 2, 62, '— COMPRAR ammo ×10 —', 11, CSS.dim).setOrigin(0.5, 0)

    const children: Phaser.GameObjects.GameObject[] = [bg, hdl, hd]

    const els: ElementType[] = ['fire', 'electro', 'plasma'];
    els.forEach((el, i) => {
      const cost = prices[el]
      const can  = coins >= cost
      const y    = 78 + i * 44
      const row  = this.add.rectangle(width / 2, y, width - 32, 36, 0x12203a, can ? 0.8 : 0.3)
        .setOrigin(0.5, 0).setStrokeStyle(1, can ? 0xf1c40f : 0x332211)
      const lbl = addLabel(this, 28, y + 4, `${ELEMENT_NAMES[el]} ×10`, 13, can ? ELEMENT_CSS[el] : CSS.dim).setOrigin(0, 0)
      const cst = addLabel(this, width - 28, y + 4, `${cost} ◆`, 13, can ? CSS.yellow : CSS.dim).setOrigin(1, 0)
      if (can) {
        row.setInteractive({ useHandCursor: true })
        row.on(Phaser.Input.Events.POINTER_DOWN, () => {
          GameState.coins -= prices[el]; GameState.addAmmo(el, 10)
          this.refreshPanel()
        })
      }
      children.push(row, lbl, cst)
    })

    // Vender items del bag
    const bag = GameState.bag
    if (bag.length > 0) {
      addLabel(this, width / 2, 224, '— VENDER —', 11, CSS.dim).setOrigin(0.5, 0)
      children.push(addLabel(this, width / 2, 224, '— VENDER —', 11, CSS.dim).setOrigin(0.5, 0))
      bag.forEach((item, i) => {
        const def   = WEAPONS[item.key]
        if (!def) return
        const dur   = def.maxDurability > 0 ? item.durability / def.maxDurability : 1
        const price = Math.max(1, Math.round((def.element ? 8 : 3) * dur))
        const y     = 240 + i * 32
        const lbl   = addLabel(this, 28, y, `• ${def.name}`, 13, CSS.light).setOrigin(0, 0)
        const btn   = addLabel(this, width - 28, y, `${price} ◆`, 13, CSS.yellow)
          .setOrigin(1, 0).setInteractive({ useHandCursor: true })
          .on(Phaser.Input.Events.POINTER_DOWN, () => {
            GameState.bag.splice(i, 1)
            GameState.addCoins(price)
            this.refreshPanel()
          })
        children.push(lbl, btn)
      })
    }

    this.panel = this.add.container(0, this.panelOpenY, children).setDepth(5000)
  }

  private buildRepairPanel() {
    const { width } = this.scale
    const pH = this.panelH
    const item    = this.player.equippedItem
    const def     = WEAPONS[item.key]
    const coins   = GameState.coins

    const bg  = this.add.rectangle(0, 0, width, pH, 0x0a0a18, 0.97).setOrigin(0, 0)
    const hdl = this.makeHandle(width)
    const hd  = addLabel(this, width / 2, 22, 'TALLER', 17, '#e67e22').setOrigin(0.5, 0)
    addLabel(this, 20, 44, `◆ ${coins} coins`, 12, '#e74c3c').setOrigin(0, 0)

    const children: Phaser.GameObjects.GameObject[] = [bg, hdl, hd]

    if (!def || def.maxDurability <= 0) {
      children.push(addLabel(this, width / 2, 100, 'No se puede reparar.', 14, CSS.dim).setOrigin(0.5, 0))
    } else {
      const missing = def.maxDurability - item.durability
      const cost    = Math.max(1, Math.round(missing * 3 * (1 + GameState.depth * 0.25)))
      const can     = missing > 0 && coins >= cost
      const durColor = item.durability / def.maxDurability > 0.5 ? CSS.green : (item.durability > 1 ? CSS.yellow : CSS.red)

      children.push(
        addLabel(this, width / 2, 70, def.name, 15, CSS.light).setOrigin(0.5, 0),
        addLabel(this, width / 2, 94, `Durabilidad: ${item.durability}/${def.maxDurability}`, 13, durColor).setOrigin(0.5, 0),
      )

      if (missing === 0) {
        children.push(addLabel(this, width / 2, 130, 'Ya está en perfecto estado.', 13, CSS.dim).setOrigin(0.5, 0))
      } else {
        const row = this.add.rectangle(width / 2, 130, width - 32, 42, 0x12203a, can ? 0.8 : 0.3)
          .setOrigin(0.5, 0).setStrokeStyle(1, can ? 0xe67e22 : 0x332211)
        const lbl = addLabel(this, 28, 142, 'Reparar al máximo', 14, can ? CSS.light : CSS.dim).setOrigin(0, 0)
        const cst = addLabel(this, width - 28, 142, `${cost} ◆`, 14, can ? CSS.yellow : CSS.dim).setOrigin(1, 0)
        if (can) {
          row.setInteractive({ useHandCursor: true })
          row.on(Phaser.Input.Events.POINTER_DOWN, () => {
            GameState.coins -= cost; GameState.persist()
            item.durability = def.maxDurability
            this.showToast(`${def.name} reparada`)
            this.refreshPanel()
          })
        }
        children.push(row, lbl, cst)
        if (!can && coins < cost) children.push(addLabel(this, width / 2, 182, `Faltan ${cost - coins} ◆`, 12, CSS.dim).setOrigin(0.5, 0))
      }
    }

    this.panel = this.add.container(0, this.panelOpenY, children).setDepth(5000)
  }

  private buildHackPanel() {
    const { width } = this.scale
    const pH = this.panelH

    type HKey = keyof typeof GameState.hackUpgrades
    const defs: Array<{ key: HKey; label: string; desc: string; max: number }> = [
      { key: 'terminalCharges', label: 'Capacidad Terminal', desc: '+1 carga/terminal',  max: 2 },
      { key: 'terminalYield',   label: 'Rendimiento Datos',  desc: '+1 chip/farm',       max: 3 },
      { key: 'farmSpeed',       label: 'Velocidad Hackeo',   desc: '-600ms/farm',         max: 3 },
      { key: 'dungeonDiscount', label: 'Acceso Dungeon',     desc: '-1 ⬡ entrada',       max: 4 },
      { key: 'baseRegen',       label: 'Nanobots Base',      desc: '+0.5x regen base',   max: 3 },
    ]

    const bg  = this.add.rectangle(0, 0, width, pH, 0x0a0a18, 0.97).setOrigin(0, 0)
    const hdl = this.makeHandle(width)
    const hd  = addLabel(this, width / 2, 22, 'CENTRO DE HACKEO', 17, CSS.cyan).setOrigin(0.5, 0)
    addLabel(this, 20, 44, `⬡ ${GameState.chips} chips`, 13, CSS.cyan).setOrigin(0, 0)

    const children: Phaser.GameObjects.GameObject[] = [bg, hdl, hd]

    defs.forEach(({ key, label, desc, max }, i) => {
      const cur  = GameState.hackUpgrades[key]
      const full = cur >= max
      const cost = full ? 0 : GameState.hackUpgradeCost(key)
      const can  = !full && GameState.chips >= cost
      const y    = 62 + i * 56

      children.push(
        addLabel(this, 20, y, label, 13, CSS.light).setOrigin(0, 0),
        addLabel(this, 20, y + 18, desc, 11, CSS.dim).setOrigin(0, 0),
        addLabel(this, width / 2, y + 6, `Lv ${cur}/${max}`, 12, full ? CSS.yellow : CSS.dim).setOrigin(0.5, 0),
      )

      if (!full) {
        const btn = addLabel(this, width - 20, y + 6, `${cost} ⬡  [+]`, 13, can ? CSS.cyan : CSS.dim)
          .setOrigin(1, 0)
        if (can) {
          btn.setInteractive({ useHandCursor: true })
          btn.on(Phaser.Input.Events.POINTER_DOWN, () => {
            if (GameState.buyHackUpgrade(key)) {
              this.showToast(`${label} Lv ${cur + 1}`)
              this.refreshPanel()
            }
          })
        }
        children.push(btn)
      } else {
        children.push(addLabel(this, width - 20, y + 6, 'MAX', 12, CSS.yellow).setOrigin(1, 0))
      }
    })

    this.panel = this.add.container(0, this.panelOpenY, children).setDepth(5000)
  }

  // ─── Helpers ────────────────────────────────────────────────────────────────

  private makeHandle(width: number): Phaser.GameObjects.Rectangle {
    const bar = this.add.rectangle(width / 2, 8, 48, 4, 0x333355).setOrigin(0.5, 0).setInteractive({ useHandCursor: true })
    bar.on(Phaser.Input.Events.POINTER_DOWN, () => this.closePanel())
    return bar
  }

  private itemLabel(item: ItemInstance): string {
    const def = WEAPONS[item.key]
    if (!def) return item.key
    const durStr = def.maxDurability > 0 ? ` ${item.durability}/${def.maxDurability}` : ''
    const elStr  = def.element ? ` [${ELEMENT_NAMES[def.element]}]` : ''
    return `${def.name}${durStr}${elStr}`
  }

  private statCurrentValue(key: StatKey): string {
    const s = this.player.stats
    switch (key) {
      case 'hp':        return `${s.maxHp}`
      case 'hpRegen':   return `${s.hpRegen.toFixed(1)}/s`
      case 'mana':      return `${s.maxMana}`
      case 'manaRegen': return `${s.manaRegen.toFixed(1)}/s`
      case 'attack':    return `${s.rangedDamage}`
      case 'defense':   return `${s.defense}`
      case 'moveSpeed': return `${Math.round(s.moveSpeed)}`
    }
  }

  // ─── Equipar / retirar ──────────────────────────────────────────────────────

  private equipFromBag(i: number) {
    const item = GameState.bag[i]
    if (!item) return
    const def = WEAPONS[item.key]
    if (def?.element && GameState.ammo[def.element] <= 0) {
      this.showToast(`Sin munición [${ELEMENT_NAMES[def.element]}]`)
      return
    }
    const prev = this.player.equippedItem
    GameState.bag.splice(i, 1)
    if (!isUnbreakable(prev.key)) GameState.bag.push(prev)
    this.player.equip(item)
    GameState.equipped = item
    GameState.persist()
    this.showToast(`Equipado: ${def?.name ?? item.key}`)
    this.refreshPanel()
  }

  private withdraw(i: number) {
    if (GameState.withdrawFromStash(i)) this.refreshPanel()
    else this.showToast('Bag llena')
  }

  // ─── Update ─────────────────────────────────────────────────────────────────

  update() {
    const hp = Math.round(this.player.health.current)
    if (hp !== this.lastHp) {
      this.drawHealth(hp, this.player.health.max)
      this.lastHp = hp
    }
    this.manaBar.width = MANA_BAR_W * this.player.mana.ratio
    this.xpBar.width   = this.scale.width * this.player.progression.xpRatio

    if (this.player.level !== this.lastLevel) {
      if (this.lastLevel !== -1) this.showLevelUp(this.player.level)
      this.lastLevel = this.player.level
      this.levelText.setText(`Lv ${this.player.level}`)
    }

    const pts = GameState.statPoints
    this.pointsText.setText(pts > 0 ? `★ ${pts}` : '')
  }

  // ─── Eventos ────────────────────────────────────────────────────────────────

  private listenEvents() {
    const ev = this.player.scene.events
    ev.off('toast');   ev.on('toast',   (msg: string) => this.showToast(msg))
    ev.off('stashed'); ev.on('stashed', (count: number) => {
      this.showToast(`Depositado (${count})`)
      if (this.panelKind) this.refreshPanel()
    })
    ev.off('boss'); ev.on('boss', (depth: number) => this.showToast(`¡Boss derrotado! Prof ${depth}`))
    ev.off('openBuilding'); ev.on('openBuilding', (kind: BuildingKind) => {
      if (this.panelKind === kind) return
      this.closePanel(false)
      this.openPanel(kind)
    })
    ev.off('closeBuilding'); ev.on('closeBuilding', () => {
      const bKinds: BuildingKind[] = ['health', 'market', 'repair', 'hack']
      if (this.panelKind && (bKinds as string[]).includes(this.panelKind)) this.closePanel()
    })
  }

  // ─── Feedback ───────────────────────────────────────────────────────────────

  private showToast(text: string) {
    const { width, height } = this.scale
    const t = addLabel(this, width / 2, height - NAVBAR_H - 20, text, 16, CSS.light)
      .setOrigin(0.5, 1).setDepth(6000)
    this.tweens.add({ targets: t, y: t.y - 28, alpha: 0, duration: 1000, ease: 'Cubic.Out', onComplete: () => t.destroy() })
  }

  private showLevelUp(level: number) {
    const { width, height } = this.scale
    const txt = addLabel(this, width / 2, height / 2 - 80, `¡NIVEL ${level}!`, 28, CSS.yellow)
      .setOrigin(0.5).setScale(0.5).setDepth(5500)
    this.tweens.add({ targets: txt, scale: 1, alpha: 0, y: txt.y - 32, duration: 900, ease: 'Cubic.Out', onComplete: () => txt.destroy() })
  }

  // ─── HP ─────────────────────────────────────────────────────────────────────

  private drawHealth(current: number, max: number) {
    this.hearts.forEach(h => h.destroy())
    this.hearts = []
    if (max <= MAX_HEARTS) {
      for (let i = 0; i < max; i++) {
        const color = i < current ? COLORS.hp : 0x3a3a4a
        this.hearts.push(this.add.rectangle(MARGIN + i * HEART_GAP, MARGIN, HEART_SIZE, HEART_SIZE, color).setOrigin(0, 0))
      }
      return
    }
    const bw = 140
    this.hearts.push(this.add.rectangle(MARGIN, MARGIN, bw, HEART_SIZE, COLORS.hpDim).setOrigin(0, 0))
    this.hearts.push(this.add.rectangle(MARGIN, MARGIN, bw * (current / max), HEART_SIZE, COLORS.hp).setOrigin(0, 0))
    this.hearts.push(addLabel(this, MARGIN + bw + 8, MARGIN - 1, `${current}/${max}`, 16, CSS.light).setOrigin(0, 0))
  }

  // ─── Controles táctiles ──────────────────────────────────────────────────────

  private setupTouchControls() {
    const { width, height } = this.scale
    // Joystick: no activa dentro de la nav bar
    new VirtualJoystick(this, (x, y) => this.registry.set(INPUT_KEYS.move, { x, y }), height - NAVBAR_H)

    // 3 skills en triángulo — arriba de la nav bar: ATK · DEF · ESP
    const skills: Array<{ type: string; label: string; color: number }> = [
      { type: 'attack',  label: 'ATK', color: 0xff4422 },
      { type: 'special', label: 'ESP', color: 0xaa44ff },
      { type: 'defense', label: 'DEF', color: 0x2266ff },
    ]
    const bx = width  - 68
    const by = height - NAVBAR_H - 68
    const offsets: [number, number][] = [[-58, 0], [0, 0], [-29, -58]]
    skills.forEach(({ type, label, color }, i) => {
      const [dx, dy] = offsets[i]
      new ActionButton(this, bx + dx, by + dy, color, label,
        () => this.player.scene.events.emit('useSkill', type),
        () => {}
      )
    })
  }
}
