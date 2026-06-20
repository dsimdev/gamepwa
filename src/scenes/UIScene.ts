import Phaser from 'phaser'
import { VirtualJoystick } from '../ui/VirtualJoystick'
import { ActionButton } from '../ui/ActionButton'
import { INPUT_KEYS } from '../systems/InputManager'
import { Player } from '../entities/Player'

const HEART_SIZE = 8
const HEART_GAP = 10
const MARGIN = 6
const MANA_BAR_W = 56
const MANA_BAR_H = 4
const XP_BAR_H = 2

export class UIScene extends Phaser.Scene {
  private player!: Player
  private hearts: Phaser.GameObjects.Rectangle[] = []
  private manaBar!: Phaser.GameObjects.Rectangle
  private xpBar!: Phaser.GameObjects.Rectangle
  private levelText!: Phaser.GameObjects.Text
  private equipText!: Phaser.GameObjects.Text
  private lastHp = -1
  private lastLevel = -1
  private lastWeapon = ''
  private lastSkill = ''

  constructor() {
    super({ key: 'UIScene' })
  }

  init(data: { player: Player }) {
    this.player = data.player
  }

  create() {
    const { width } = this.scale

    // Barra de XP (borde superior, ancho completo)
    this.add.rectangle(0, 0, width, XP_BAR_H, 0x2c2c44).setOrigin(0, 0)
    this.xpBar = this.add.rectangle(0, 0, 0, XP_BAR_H, 0xf1c40f).setOrigin(0, 0)

    this.drawHearts(this.player.health.max, this.player.health.max)

    // Barra de maná bajo los corazones
    this.add.rectangle(MARGIN, MARGIN + HEART_SIZE + 3, MANA_BAR_W, MANA_BAR_H, 0x1b2a4a).setOrigin(0, 0)
    this.manaBar = this.add.rectangle(MARGIN, MARGIN + HEART_SIZE + 3, MANA_BAR_W, MANA_BAR_H, 0x3498db).setOrigin(0, 0)

    // Nivel (arriba a la derecha)
    this.levelText = this.add
      .text(width - 4, 5, 'Lv 1', { fontSize: '8px', color: '#f1c40f' })
      .setOrigin(1, 0)

    // Equipo: A=arma / B=skill (abajo a la izquierda)
    this.equipText = this.add
      .text(MARGIN, this.scale.height - 8, '', { fontSize: '7px', color: '#ecf0f1' })
      .setOrigin(0, 1)

    this.setupTouchControls()
  }

  update() {
    const hp = Math.round(this.player.health.current)
    if (hp !== this.lastHp) {
      this.drawHearts(hp, this.player.health.max)
      this.lastHp = hp
    }
    this.manaBar.width = MANA_BAR_W * this.player.mana.ratio
    this.xpBar.width = this.scale.width * this.player.progression.xpRatio

    if (this.player.level !== this.lastLevel) {
      if (this.lastLevel !== -1) this.showLevelUp(this.player.level)
      this.lastLevel = this.player.level
      this.levelText.setText(`Lv ${this.player.level}`)
    }

    // Equipo + toast al cambiar de arma/skill
    const wKey = this.player.weapon.key
    const sKey = this.player.skill.key
    if (wKey !== this.lastWeapon || sKey !== this.lastSkill) {
      this.equipText.setText(`A: ${this.player.weapon.name}   B: ${this.player.skill.name}`)
      if (this.lastWeapon !== '' && wKey !== this.lastWeapon) this.showToast(`¡${this.player.weapon.name}!`)
      if (this.lastSkill !== '' && sKey !== this.lastSkill) this.showToast(`¡${this.player.skill.name}!`)
      this.lastWeapon = wKey
      this.lastSkill = sKey
    }
  }

  private showToast(text: string) {
    const { width, height } = this.scale
    const t = this.add
      .text(width / 2, height - 50, text, { fontSize: '8px', color: '#ffffff' })
      .setOrigin(0.5)
    this.tweens.add({
      targets: t,
      y: t.y - 12,
      alpha: 0,
      duration: 1000,
      ease: 'Cubic.Out',
      onComplete: () => t.destroy(),
    })
  }

  private showLevelUp(level: number) {
    const { width, height } = this.scale
    const txt = this.add
      .text(width / 2, height / 2 - 30, `¡NIVEL ${level}!`, { fontSize: '14px', color: '#f1c40f' })
      .setOrigin(0.5)
      .setScale(0.5)
    this.tweens.add({
      targets: txt,
      scale: 1,
      alpha: 0,
      y: txt.y - 16,
      duration: 900,
      ease: 'Cubic.Out',
      onComplete: () => txt.destroy(),
    })
  }

  private setupTouchControls() {
    const { width, height } = this.scale

    new VirtualJoystick(this, (x, y) => {
      this.registry.set(INPUT_KEYS.move, { x, y })
    })

    new ActionButton(
      this,
      width - 20,
      height - 18,
      0xe74c3c,
      'A',
      () => this.registry.set(INPUT_KEYS.attack, true),
      () => this.registry.set(INPUT_KEYS.attack, false)
    )
    new ActionButton(
      this,
      width - 52,
      height - 40,
      0x3498db,
      'B',
      () => this.registry.set(INPUT_KEYS.cast, true),
      () => this.registry.set(INPUT_KEYS.cast, false)
    )
  }

  private drawHearts(current: number, max: number) {
    this.hearts.forEach(h => h.destroy())
    this.hearts = []

    for (let i = 0; i < max; i++) {
      const x = MARGIN + i * HEART_GAP
      const color = i < current ? 0xe74c3c : 0x7f8c8d
      const heart = this.add.rectangle(x, MARGIN, HEART_SIZE, HEART_SIZE, color)
      heart.setOrigin(0, 0)
      this.hearts.push(heart)
    }
  }
}
