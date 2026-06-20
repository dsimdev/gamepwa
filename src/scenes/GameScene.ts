import Phaser from 'phaser'
import { Player } from '../entities/Player'
import { Enemy } from '../entities/Enemy'
import { Pickup } from '../entities/Pickup'
import { InputManager } from '../systems/InputManager'
import { Projectile } from '../combat/Projectile'
import { GameState, STAT_POINTS_PER_LEVEL } from '../systems/GameState'
import { ENEMIES } from '../data/enemies'
import { WEAPONS, LOOTABLE_WEAPONS } from '../data/weapons'
import { ELEMENT_COLORS, ELEMENT_NAMES } from '../data/elements'
import { makeItem, KNIFE_KEY } from '../items/types'
import { BIOMES, BIOME_KEYS } from '../data/biomes'
import { generateDungeon } from '../dungeon/DungeonGenerator'
import type { BiomeDef } from '../data/biomes'
import { DIRS, keyOf } from '../dungeon/types'
import { addLabel, COLORS, CSS } from '../ui/theme'
import type { Dir, Dungeon, RoomData } from '../dungeon/types'
import type { CombatContext, EnemyContext } from '../combat/types'
import type { ElementType } from '../data/elements'

const DROP_CHANCE = 0.3

const W = 640
const H = 360
const WALL = 28
const DOOR_GAP = 80
const TRANSITION_LOCK_MS = 350

const OW_W = 1280
const OW_H = 800

type Mode = 'overworld' | 'run'
type PortalKind = 'dungeon' | 'overworld' | 'stash'

export class GameScene extends Phaser.Scene implements CombatContext, EnemyContext {
  private mode: Mode = 'overworld'
  private player!: Player
  private inputManager!: InputManager
  private projectiles!: Phaser.Physics.Arcade.Group
  private enemyProjectiles!: Phaser.Physics.Arcade.Group
  private enemies!: Phaser.Physics.Arcade.Group
  private pickups!: Phaser.Physics.Arcade.Group
  private walls!: Phaser.Physics.Arcade.StaticGroup
  private doorBlocks!: Phaser.Physics.Arcade.StaticGroup

  private dungeon?: Dungeon
  private current?: RoomData
  private biome?: BiomeDef
  private wallColor: number = COLORS.wallOverworld
  private boss?: Enemy
  private bossBar?: Phaser.GameObjects.Rectangle
  private bossBarBg?: Phaser.GameObjects.Container
  private doorZones: Array<{ dir: Dir; rect: Phaser.Geom.Rectangle }> = []
  private portalZones: Array<{ kind: PortalKind; rect: Phaser.Geom.Rectangle }> = []
  private transitionLockUntil = 0
  private dead = false
  private victoryAchieved = false
  private minibossDefeated = false
  private dungeonPressure = 0

  constructor() {
    super({ key: 'GameScene' })
  }

  init(data: { mode?: Mode }) {
    this.mode = data?.mode ?? 'overworld'
    this.dead = false
    this.victoryAchieved = false
    this.minibossDefeated = false
    this.dungeonPressure = 0
  }

  create() {
    this.createPlaceholderTextures()

    // Dimensiones del mundo según el modo
    const worldW = this.mode === 'overworld' ? OW_W : W
    const worldH = this.mode === 'overworld' ? OW_H : H

    // Bioma de la incursión (colores + pool de enemigos)
    let floorColor: number = COLORS.floorOverworld // overworld
    if (this.mode === 'run') {
      this.biome = BIOMES[Phaser.Utils.Array.GetRandom(BIOME_KEYS)]
      floorColor = this.biome.floorColor
      this.wallColor = this.biome.wallColor
    }
    this.add.rectangle(worldW / 2, worldH / 2, worldW, worldH, floorColor).setDepth(-10)
    this.physics.world.setBounds(0, 0, worldW, worldH)

    this.projectiles = this.physics.add.group({ classType: Projectile, maxSize: 32, runChildUpdate: true })
    this.enemyProjectiles = this.physics.add.group({ classType: Projectile, maxSize: 48, runChildUpdate: true })
    this.enemies = this.physics.add.group()
    this.pickups = this.physics.add.group()
    this.walls = this.physics.add.staticGroup()
    this.doorBlocks = this.physics.add.staticGroup()

    this.inputManager = new InputManager(this)
    this.player = new Player(this, W / 2, H / 2, this.inputManager, this)

    // Cargar equipo y progresión desde el estado global
    // Si el arma guardada es ranged sin munición, equipar navaja
    const savedEquip = GameState.equipped
    const savedDef = WEAPONS[savedEquip.key]
    const needsAmmo = savedDef?.element && GameState.ammo[savedDef.element] <= 0
    if (needsAmmo) {
      const knife = makeItem(KNIFE_KEY)
      GameState.equipped = knife
      GameState.persist()
    }
    this.player.equip(GameState.equipped)
    this.player.applyProgression(GameState.level, GameState.xp)

    this.events.off('levelup')
    this.events.on('levelup', () => {
      GameState.level = this.player.progression.level
      GameState.xp = this.player.progression.xp
      GameState.addStatPoints(STAT_POINTS_PER_LEVEL)  // addStatPoints ya llama persist()
    })

    this.events.off('statschanged')
    this.events.on('statschanged', () => {
      this.player.rebuildStats()
    })

    // Al romperse el arma: el equipo pasó a puños; persistir y avisar
    this.events.off('weaponbroke')
    this.events.on('weaponbroke', (name: string) => {
      GameState.equipped = this.player.equippedItem
      GameState.persist()
      this.events.emit('toast', `${name} se rompió`)
    })

    this.physics.add.collider(this.player, this.walls)
    this.physics.add.collider(this.player, this.doorBlocks)
    this.physics.add.collider(this.enemies, this.walls)
    this.physics.add.collider(this.enemies, this.doorBlocks)
    this.physics.add.collider(this.enemies, this.enemies)
    this.physics.add.overlap(this.projectiles, this.enemies, this.onPlayerProjectileHit, undefined, this)
    this.physics.add.overlap(this.enemyProjectiles, this.player, this.onEnemyProjectileHit, undefined, this)
    // Collider (no overlap): los enemigos se frenan contra el jugador y atacan por contacto
    this.physics.add.collider(this.player, this.enemies, this.onEnemyContact, undefined, this)
    this.physics.add.overlap(this.player, this.pickups, this.onPickup, undefined, this)
    this.physics.add.overlap(this.projectiles, this.walls, p => (p as Projectile).kill())
    this.physics.add.overlap(this.enemyProjectiles, this.walls, p => (p as Projectile).kill())

    this.cameras.main.setBounds(0, 0, worldW, worldH)

    if (this.mode === 'overworld') {
      this.cameras.main.startFollow(this.player, true, 0.12, 0.12)
      this.buildOverworld()
    } else {
      this.dungeon = generateDungeon(9)
      this.buildRoom(this.dungeon.start)
      // Temporizador de presión: cada 30s aumenta dificultad y manda oleada extra
      this.time.addEvent({
        delay: 30_000,
        callback: () => {
          this.dungeonPressure++
          this.events.emit('toast', `⚠ Presión ${this.dungeonPressure} — oleada`)
          if (this.current?.type === 'normal' && !this.current.cleared) this.spawnRoomEnemies()
        },
        loop: true,
      })
    }

    this.transitionLockUntil = this.time.now + TRANSITION_LOCK_MS
    const info =
      this.mode === 'run'
        ? `${this.biome?.name ?? ''} · Prof ${GameState.depth}`
        : `Mundo · Prof ${GameState.depth}`
    this.scene.launch('UIScene', { player: this.player, mode: this.mode, info })
  }

  // --- OVERWORLD (mundo abierto) ---

  private buildOverworld(): void {
    this.buildBorderWalls(OW_W, OW_H)

    // Base: zona segura en el centro del mundo. Spawneás acá.
    const bx = OW_W / 2
    const by = OW_H / 2
    this.player.setPosition(bx, by)
    this.add.rectangle(bx, by, 144, 144, 0x12203a, 0.6).setStrokeStyle(2, COLORS.neonCyan).setDepth(-9)
    addLabel(this, bx, by - 92, 'BASE', 16, CSS.cyan).setOrigin(0.5)

    this.addPortal('stash', bx - 52, by, COLORS.neonCyan, 'STASH')
    this.addPortal('dungeon', OW_W - 140, by - 120, COLORS.neonMagenta, 'DUNGEON')

    const rocks: Array<[number, number, number, number]> = [
      [240, 180, 80, 80],
      [OW_W - 280, OW_H - 180, 100, 60],
      [320, OW_H - 220, 60, 120],
      [OW_W - 220, 260, 72, 72],
    ]
    for (const [x, y, w, h] of rocks) this.addWall(x, y, w, h)

    // Mobs neutrales — dan XP si se provocan, el jugador puede entrenar antes del dungeon
    this.spawnOverworldMobs()

    if (GameState.lastOutcome === 'victory') {
      this.showCenterText('¡DUNGEON COMPLETADO! — botín a salvo', 0x2ecc71)
    } else if (GameState.lastOutcome === 'retreat') {
      this.showCenterText('Volviste a la base', 0x2ecc71)
    } else if (GameState.lastOutcome === 'death') {
      this.showCenterText('Caíste — loot perdido', 0xe74c3c)
    }
    GameState.lastOutcome = null
  }

  private spawnOverworldMobs(): void {
    const def = ENEMIES['scavenger']
    const scale = this.difficultyScale()
    const count = 6 + Math.min(4, GameState.depth)
    // Evitar la zona de base (centro)
    const safeDist = 200
    const bx = OW_W / 2
    const by = OW_H / 2
    let spawned = 0
    let attempts = 0
    while (spawned < count && attempts < count * 5) {
      attempts++
      const x = Phaser.Math.Between(WALL + 30, OW_W - WALL - 30)
      const y = Phaser.Math.Between(WALL + 30, OW_H - WALL - 30)
      if (Math.abs(x - bx) < safeDist && Math.abs(y - by) < safeDist) continue
      const enemy = new Enemy(this, x, y, def, this, scale)
      enemy.onDeath = e => {
        this.player.gainXp(e.xpReward)
        this.maybeDropLoot(e.x, e.y)
      }
      this.enemies.add(enemy)
      spawned++
    }
  }

  private showCenterText(text: string, color: number): void {
    const t = addLabel(this, W / 2, H / 2 - 72, text, 16, `#${color.toString(16).padStart(6, '0')}`)
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(3000)
    this.tweens.add({ targets: t, y: t.y - 28, alpha: 0, duration: 1800, ease: 'Cubic.Out', onComplete: () => t.destroy() })
  }

  private addPortal(kind: PortalKind, x: number, y: number, color: number, label: string): void {
    this.add.rectangle(x, y, 44, 44, color, 0.25).setStrokeStyle(2, color)
    if (label) addLabel(this, x, y + 28, label, 14, `#${color.toString(16).padStart(6, '0')}`).setOrigin(0.5, 0)
    this.portalZones.push({ kind, rect: new Phaser.Geom.Rectangle(x - 22, y - 22, 44, 44) })
  }

  private buildBorderWalls(w: number, h: number): void {
    this.addWall(w / 2, WALL / 2, w, WALL)
    this.addWall(w / 2, h - WALL / 2, w, WALL)
    this.addWall(WALL / 2, h / 2, WALL, h)
    this.addWall(w - WALL / 2, h / 2, WALL, h)
  }

  // --- RUN: construcción de salas ---

  private buildRoom(room: RoomData): void {
    this.clearRoom()
    this.current = room
    this.buildWalls(room)
    // Indicador de tipo de sala en el techo
    this.buildDoors(room)
    if (!room.cleared) {
      if (room.type === 'boss') this.spawnBoss()
      else if (room.type === 'miniboss') this.spawnMiniboss()
      else this.spawnRoomEnemies()
    }
    // No hay salida al overworld durante el dungeon — solo al completarlo
  }

  private clearRoom(): void {
    this.walls.clear(true, true)
    this.doorBlocks.clear(true, true)
    this.enemies.clear(true, true)
    this.pickups.clear(true, true)
    this.doorZones = []
    this.portalZones = []
    this.clearBossBar()
    this.projectiles.getChildren().forEach(p => (p as Projectile).kill())
    this.enemyProjectiles.getChildren().forEach(p => (p as Projectile).kill())
  }

  private addWall(cx: number, cy: number, w: number, h: number): void {
    const wall = this.walls.create(cx, cy, 'px') as Phaser.Physics.Arcade.Sprite
    wall.setDisplaySize(w, h).setTint(this.wallColor).refreshBody()
  }

  private buildWalls(room: RoomData): void {
    const seg = (full: number) => (full - DOOR_GAP) / 2
    for (const [dir, cy] of [['n', WALL / 2], ['s', H - WALL / 2]] as const) {
      if (room.doors[dir]) {
        const s = seg(W)
        this.addWall(s / 2, cy, s, WALL)
        this.addWall(W - s / 2, cy, s, WALL)
      } else {
        this.addWall(W / 2, cy, W, WALL)
      }
    }
    for (const [dir, cx] of [['w', WALL / 2], ['e', W - WALL / 2]] as const) {
      if (room.doors[dir]) {
        const s = seg(H)
        this.addWall(cx, s / 2, WALL, s)
        this.addWall(cx, H - s / 2, WALL, s)
      } else {
        this.addWall(cx, H / 2, WALL, H)
      }
    }
  }

  private doorCenter(dir: Dir): { x: number; y: number } {
    switch (dir) {
      case 'n': return { x: W / 2, y: WALL / 2 }
      case 's': return { x: W / 2, y: H - WALL / 2 }
      case 'w': return { x: WALL / 2, y: H / 2 }
      case 'e': return { x: W - WALL / 2, y: H / 2 }
    }
  }

  private buildDoors(room: RoomData): void {
    for (const dir of Object.keys(room.doors) as Dir[]) {
      if (!room.doors[dir]) continue
      const c = this.doorCenter(dir)
      const horizontal = dir === 'n' || dir === 's'
      const w = horizontal ? DOOR_GAP : WALL
      const h = horizontal ? WALL : DOOR_GAP

      if (room.cleared) {
        this.doorZones.push({ dir, rect: new Phaser.Geom.Rectangle(c.x - w / 2, c.y - h / 2, w, h) })
      } else {
        const block = this.doorBlocks.create(c.x, c.y, 'px') as Phaser.Physics.Arcade.Sprite
        block.setDisplaySize(w, h).setTint(0x8b0000).refreshBody()
      }
    }
  }

  /** Escala de dificultad:
   *  - Overworld: +20% por dungeon superado (depth)
   *  - Dungeon: +20% por depth + 10% por respawnCount + 15% por presión de tiempo
   */
  private difficultyScale(): number {
    if (this.mode === 'overworld') {
      return 1 + 0.2 * GameState.depth
    }
    return 1 + 0.2 * GameState.depth + 0.1 * GameState.respawnCount + 0.15 * this.dungeonPressure
  }

  private spawnRoomEnemies(): void {
    const pool = this.biome?.enemies ?? Object.keys(ENEMIES)
    const count = Phaser.Math.Between(2, 4)
    const scale = this.difficultyScale()
    for (let i = 0; i < count; i++) {
      const key = Phaser.Utils.Array.GetRandom(pool)
      const x = Phaser.Math.Between(WALL + 20, W - WALL - 20)
      const y = Phaser.Math.Between(WALL + 20, H - WALL - 20)
      const enemy = new Enemy(this, x, y, ENEMIES[key], this, scale)
      enemy.onDeath = e => {
        this.player.gainXp(e.xpReward)
        this.maybeDropLoot(e.x, e.y)
      }
      this.enemies.add(enemy)
    }
  }

  private spawnBoss(): void {
    const bossKey = this.biome?.boss ?? 'golem'
    const boss = new Enemy(this, W / 2, H / 2, ENEMIES[bossKey], this, this.difficultyScale())
    boss.onDeath = e => this.onBossDefeated(e)
    this.enemies.add(boss)
    this.boss = boss
    this.createBossBar(ENEMIES[bossKey].name)
  }

  private spawnMiniboss(): void {
    const m = new Enemy(this, W / 2, H / 2, ENEMIES['miniboss'], this, this.difficultyScale())
    m.onDeath = e => this.onMinibossDefeated(e)
    this.enemies.add(m)
    this.createBossBar('Centinela (mini-boss)')
  }

  private onMinibossDefeated(miniboss: Enemy): void {
    this.minibossDefeated = true
    this.player.gainXp(miniboss.xpReward)
    this.clearBossBar()

    // Curar al jugador 50% HP y mana para enfrentar al boss
    this.player.health.add(Math.floor(this.player.health.max * 0.5))
    this.player.mana.add(Math.floor(this.player.mana.max * 0.5))

    // Loot: ammo + coins
    const els: ElementType[] = ['fire', 'electro', 'plasma']
    els.forEach((el, i) => {
      this.pickups.add(new Pickup(this, miniboss.x + (i - 1) * 12, miniboss.y + 14, 'ammo', el, ELEMENT_COLORS[el], 10))
    })
    this.pickups.add(new Pickup(this, miniboss.x, miniboss.y - 12, 'coin', 'coin', 0xffd700, Phaser.Math.Between(5, 12)))

    this.showCenterText('¡Centinela vencido! — curado 50% — sala del boss desbloqueada', 0xff6600)
  }

  private createBossBar(name: string): void {
    const barW = W - 160
    const x = 80
    const y = H - 52
    const bg = this.add.rectangle(x, y, barW, 10, COLORS.hpDim).setOrigin(0, 0).setScrollFactor(0).setDepth(2000)
    this.bossBar = this.add.rectangle(x, y, barW, 10, COLORS.neonMagenta).setOrigin(0, 0).setScrollFactor(0).setDepth(2001)
    const label = addLabel(this, W / 2, y - 16, name, 14, CSS.magenta)
      .setOrigin(0.5, 0)
      .setScrollFactor(0)
      .setDepth(2001)
    this.bossBarBg = this.add.container(0, 0, [bg, label]).setDepth(2000)
  }

  private clearBossBar(): void {
    this.boss = undefined
    this.bossBar?.destroy()
    this.bossBarBg?.destroy()
    this.bossBar = undefined
    this.bossBarBg = undefined
  }

  private onBossDefeated(boss: Enemy): void {
    this.player.gainXp(boss.xpReward)
    const bx = boss.x
    const by = boss.y
    // Drop garantizado de arma
    const key = Phaser.Utils.Array.GetRandom(LOOTABLE_WEAPONS)
    this.pickups.add(new Pickup(this, bx, by, 'weapon', key, WEAPONS[key].color))
    // Ammo: 15 de cada elemento
    const elements: ElementType[] = ['fire', 'electro', 'plasma']
    elements.forEach((el, i) => {
      this.pickups.add(new Pickup(this, bx + (i - 1) * 12, by + 14, 'ammo', el, ELEMENT_COLORS[el], 15))
    })
    // Coins: 15-25
    const coins = Phaser.Math.Between(15, 25)
    this.pickups.add(new Pickup(this, bx, by - 12, 'coin', 'coin', 0xffd700, coins))
    GameState.depth++
    GameState.respawnCount++
    GameState.persist()
    this.events.emit('boss', GameState.depth)

    // Portal de victoria — aparece al completar el dungeon
    this.victoryAchieved = true
    const vx = bx
    const vy = Math.min(by + 60, H - 40)
    this.addPortal('overworld', vx, vy, 0x2ecc71, '← BASE')
    this.showCenterText('¡DUNGEON COMPLETADO!', 0x2ecc71)
  }

  private maybeDropLoot(x: number, y: number): void {
    // Weapon (30%)
    if (Math.random() < DROP_CHANCE) {
      const key = Phaser.Utils.Array.GetRandom(LOOTABLE_WEAPONS)
      this.pickups.add(new Pickup(this, x, y, 'weapon', key, WEAPONS[key].color))
    }
    // Ammo (60%): random element, 4-10 units
    if (Math.random() < 0.6) {
      const elements: ElementType[] = ['fire', 'electro', 'plasma']
      const el = Phaser.Utils.Array.GetRandom(elements)
      const qty = Phaser.Math.Between(4, 10)
      this.pickups.add(new Pickup(this, x + Phaser.Math.Between(-8, 8), y + Phaser.Math.Between(-8, 8), 'ammo', el, ELEMENT_COLORS[el], qty))
    }
    // Coins (70%): 1-3
    if (Math.random() < 0.7) {
      const qty = Phaser.Math.Between(1, 3)
      this.pickups.add(new Pickup(this, x + Phaser.Math.Between(-6, 6), y + 8, 'coin', 'coin', 0xffd700, qty))
    }
  }

  private placePlayerAtDoor(entryDir: Dir): void {
    const inset = 52
    const c = this.doorCenter(entryDir)
    const offset: Record<Dir, [number, number]> = {
      n: [0, inset],
      s: [0, -inset],
      w: [inset, 0],
      e: [-inset, 0],
    }
    const [ox, oy] = offset[entryDir]
    this.player.setPosition(c.x + ox, c.y + oy)
    this.player.setVelocity(0, 0)
  }

  // --- Transiciones de escena (overworld ↔ run) ---

  private enterDungeon(): void {
    // El equipo persiste; la bag arranca como esté (lo no depositado se lleva)
    this.switchScene('run')
  }

  private exitToOverworld(): void {
    this.syncProgression()
    GameState.lastOutcome = this.victoryAchieved ? 'victory' : 'retreat'
    this.switchScene('overworld')
  }

  private syncProgression(): void {
    GameState.level = this.player.progression.level
    GameState.xp = this.player.progression.xp
    GameState.persist()
  }

  private switchScene(mode: Mode): void {
    this.scene.stop('UIScene')
    this.scene.start('GameScene', { mode })
  }

  private stashCooldownUntil = 0

  private depositStash(): void {
    if (this.time.now < this.stashCooldownUntil) return
    this.stashCooldownUntil = this.time.now + 800
    const n = GameState.depositBag()
    if (n > 0) this.events.emit('stashed', n)
  }

  // --- Texturas placeholder ---

  private createPlaceholderTextures(): void {
    const g = this.make.graphics({ x: 0, y: 0 })
    g.fillStyle(0xffffff)
    g.fillRect(0, 0, 1, 1)
    g.generateTexture('px', 1, 1)
    g.clear()
    g.fillStyle(COLORS.player)
    g.fillRect(0, 0, 32, 32)
    g.generateTexture('player', 32, 32)
    g.clear()
    g.fillStyle(COLORS.projectile)
    g.fillCircle(6, 6, 6)
    g.generateTexture('projectile', 12, 12)
    g.clear()
    g.fillStyle(COLORS.enemyProjectile)
    g.fillCircle(6, 6, 6)
    g.generateTexture('enemy_projectile', 12, 12)
    g.clear()
    g.fillStyle(0xffffff)
    g.fillPoints([
      new Phaser.Math.Vector2(8, 0),
      new Phaser.Math.Vector2(16, 8),
      new Phaser.Math.Vector2(8, 16),
      new Phaser.Math.Vector2(0, 8),
    ], true)
    g.generateTexture('pickup', 16, 16)
    g.clear()
    g.fillStyle(0xffffff)
    g.fillCircle(5, 5, 5)
    g.generateTexture('ammo_pickup', 10, 10)
    g.clear()
    g.fillStyle(0xffd700)
    g.fillRect(2, 2, 8, 8)
    g.generateTexture('coin_pickup', 12, 12)
    for (const def of Object.values(ENEMIES)) {
      g.clear()
      g.fillStyle(def.color)
      g.fillRect(0, 0, def.size, def.size)
      g.generateTexture(`enemy_${def.key}`, def.size, def.size)
    }
    g.destroy()
  }

  // --- CombatContext / EnemyContext ---

  consumeAmmo(element: ElementType): boolean {
    // Solo verifica disponibilidad — la deducción ocurre al impactar al enemigo
    if (GameState.ammo[element] > 0) return true
    this.time.delayedCall(0, () => this.autoUnequipRanged(element))
    return false
  }

  private autoUnequipRanged(element: ElementType): void {
    const equipped = this.player.equippedItem
    const def = WEAPONS[equipped.key]
    if (def?.element !== element) return

    GameState.addToBag(equipped)

    // Busca en la bag la mejor arma ranged con munición según los enemigos en pantalla
    const suggested = this.suggestWeapon()
    const next = suggested ?? makeItem(KNIFE_KEY)
    if (suggested) {
      const idx = GameState.bag.findIndex(i => i === suggested)  // ref exacta
      if (idx >= 0) GameState.bag.splice(idx, 1)
    }
    this.player.equip(next)
    GameState.equipped = next
    GameState.persist()
    const elName = ELEMENT_NAMES[element] ?? element
    const nextName = WEAPONS[next.key]?.name ?? 'Filo Nano'
    const msg = suggested
      ? `Sin ${elName} → ${nextName} equipado`
      : `Sin ${elName} → sin alternativas, usando ${nextName}`
    this.events.emit('toast', msg)
  }

  private suggestWeapon(): import('../items/types').ItemInstance | undefined {
    const liveEnemies = this.enemies.getChildren().filter(e => !(e as Enemy).isDead) as Enemy[]

    // Puntúa cada arma ranged en bag con ammo según debilidad de los enemigos presentes
    let bestScore = -Infinity
    let bestItem: import('../items/types').ItemInstance | undefined

    for (const item of GameState.bag) {
      const d = WEAPONS[item.key]
      if (!d?.element || GameState.ammo[d.element] <= 0) continue
      const el = d.element as ElementType
      let score = 0
      if (liveEnemies.length > 0) {
        for (const e of liveEnemies) {
          score += (e.def.weaknesses?.[el] ?? 1) - (e.def.resistances?.[el] ?? 0)
        }
      } else {
        score = 1 // sin enemigos: cualquier arma con ammo vale
      }
      if (score > bestScore) { bestScore = score; bestItem = item }
    }
    return bestItem
  }

  spawnPlayerProjectile(x: number, y: number, dir: Phaser.Math.Vector2, damage: number, element?: ElementType): void {
    if (element === 'fire') {
      // Llamarada: ráfaga cónica corta (3 proyectiles, rango ~90px)
      const spread = [-22, 0, 22]
      spread.forEach(deg => {
        const p = this.projectiles.get() as Projectile | null
        p?.fire(x, y, dir.clone().rotate(Phaser.Math.DegToRad(deg)), damage, 'projectile', 'fire', 280, 320, 0.8)
      })
    } else if (element === 'plasma') {
      // Laser plasma: rápido, delgado, penetrante
      const p = this.projectiles.get() as Projectile | null
      p?.fire(x, y, dir, damage, 'projectile', 'plasma', 520, 700, 0.5)
    } else if (element === 'electro') {
      // Rail electro: rápido, encadena al impacto
      const p = this.projectiles.get() as Projectile | null
      p?.fire(x, y, dir, damage, 'projectile', 'electro', 400, 750, 0.9)
    } else {
      const p = this.projectiles.get() as Projectile | null
      p?.fire(x, y, dir, damage, 'projectile', element)
    }
  }

  private showAoeEffect(x: number, y: number, radius: number, color: number): void {
    const g = this.add.graphics()
    const state = { r: 6, a: 1 }
    this.tweens.add({
      targets: state,
      r: radius,
      a: 0,
      duration: 380,
      ease: 'Cubic.Out',
      onUpdate: () => {
        g.clear()
        g.fillStyle(color, state.a * 0.18)
        g.fillCircle(x, y, state.r)
        g.lineStyle(3, color, state.a)
        g.strokeCircle(x, y, state.r)
      },
      onComplete: () => g.destroy(),
    })
  }

  private showChainEffect(x1: number, y1: number, x2: number, y2: number): void {
    const g = this.add.graphics()
    g.lineStyle(3, ELEMENT_COLORS.electro, 1)
    g.lineBetween(x1, y1, x2, y2)
    this.tweens.add({ targets: g, alpha: 0, duration: 220, onComplete: () => g.destroy() })
  }

  meleePlayerHit(rect: Phaser.Geom.Rectangle, damage: number, from: Phaser.Math.Vector2): void {
    this.enemies.getChildren().forEach(child => {
      const enemy = child as Enemy
      if (enemy.isDead) return
      if (Phaser.Geom.Intersects.RectangleToRectangle(rect, enemy.getBounds())) {
        enemy.takeDamage(damage, from)
      }
    })
  }

  spawnEnemyProjectile(x: number, y: number, dir: Phaser.Math.Vector2, damage: number): void {
    const proj = this.enemyProjectiles.get() as Projectile | null
    if (proj) proj.fire(x, y, dir, damage, 'enemy_projectile')
  }

  // --- Handlers ---

  private onPlayerProjectileHit: Phaser.Types.Physics.Arcade.ArcadePhysicsCallback = (proj, enemy) => {
    const p = proj as Projectile
    const e = enemy as Enemy
    if (!p.active || e.isDead) return

    // Plasma: rayo penetrante con daño decreciente por distancia (no muere al golpear)
    if (p.element === 'plasma') {
      if (p.piercedIds.has(e)) return
      const dmg = Math.max(1, Math.round(p.baseDamage * Math.pow(0.65, p.pierceCount)))
      e.takeDamage(dmg, new Phaser.Math.Vector2(p.x, p.y), 'plasma')
      // AoE radial pequeño en el punto de impacto
      const splashR = 32
      this.showAoeEffect(p.x, p.y, splashR, ELEMENT_COLORS.plasma)
      this.enemies.getChildren().forEach(other => {
        const o = other as Enemy
        if (o !== e && !o.isDead && !p.piercedIds.has(o)) {
          if (Phaser.Math.Distance.Between(p.x, p.y, o.x, o.y) <= splashR) {
            o.takeDamage(Math.max(1, Math.round(dmg * 0.5)), new Phaser.Math.Vector2(p.x, p.y), 'plasma')
            p.piercedIds.add(o)
          }
        }
      })
      p.piercedIds.add(e)
      p.pierceCount++
      // Descuenta 1 ammo por impacto exitoso
      if (GameState.consumeAmmo('plasma') && GameState.ammo['plasma'] === 0) {
        this.time.delayedCall(0, () => this.autoUnequipRanged('plasma'))
      }
      return  // el rayo sigue viajando
    }

    e.takeDamage(p.damage, new Phaser.Math.Vector2(p.x, p.y), p.element)

    if (p.element === 'electro') {
      const chainR = 120
      const chainDmg = Math.max(1, Math.round(p.damage * 0.65))
      this.enemies.getChildren().forEach(other => {
        const o = other as Enemy
        if (o !== e && !o.isDead) {
          const dist = Phaser.Math.Distance.Between(e.x, e.y, o.x, o.y)
          if (dist <= chainR) {
            o.takeDamage(chainDmg, new Phaser.Math.Vector2(e.x, e.y), 'electro')
            this.showChainEffect(e.x, e.y, o.x, o.y)
          }
        }
      })
    }

    // Descuenta 1 ammo al golpear (fuego y electro)
    if (p.element) {
      if (GameState.consumeAmmo(p.element) && GameState.ammo[p.element] === 0) {
        this.time.delayedCall(0, () => this.autoUnequipRanged(p.element!))
      }
    }

    p.kill()
  }

  private onEnemyProjectileHit: Phaser.Types.Physics.Arcade.ArcadePhysicsCallback = (_player, proj) => {
    const p = proj as Projectile
    if (!p.active) return
    this.player.takeDamage(p.damage)
    p.kill()
  }

  private onEnemyContact: Phaser.Types.Physics.Arcade.ArcadePhysicsCallback = (_player, enemy) => {
    const e = enemy as Enemy
    if (e.isDead) return
    this.player.takeDamage(e.contactDamage)
  }

  private onPickup: Phaser.Types.Physics.Arcade.ArcadePhysicsCallback = (_player, obj) => {
    const pick = obj as Pickup
    if (!pick.active) return

    if (pick.kind === 'weapon') {
      if (GameState.addToBag(makeItem(pick.itemKey))) {
        this.events.emit('toast', `${WEAPONS[pick.itemKey].name} → bag`)
        pick.destroy()
      } else {
        this.events.emit('toast', 'Bag llena')
      }
    } else if (pick.kind === 'ammo') {
      const el = pick.itemKey as ElementType
      GameState.addAmmo(el, pick.amount)
      this.events.emit('toast', `+${pick.amount} ${ELEMENT_NAMES[el]}`)
      pick.destroy()
    } else if (pick.kind === 'coin') {
      GameState.addCoins(pick.amount)
      this.events.emit('toast', `+${pick.amount} ◈`)
      pick.destroy()
    }
  }

  // --- Loop ---

  update(time: number, delta: number) {
    // Regen doble en la base del overworld
    if (this.mode === 'overworld') {
      const bx = OW_W / 2, by = OW_H / 2
      this.player.inBase = Phaser.Math.Distance.Between(this.player.x, this.player.y, bx, by) < 90
    } else {
      this.player.inBase = false
    }

    this.player.update(time, delta)
    this.enemies.getChildren().forEach(child => (child as Enemy).update(this.player, time, delta))

    if (this.mode === 'run') {
      this.updateBossBar()
      this.updateRoomCleared()
      this.checkDoorTransitions(time)
    }

    this.checkDeath()
    this.checkPortals()
  }

  private updateBossBar(): void {
    if (!this.boss || !this.bossBar) return
    if (this.boss.isDead) {
      this.clearBossBar()
      return
    }
    this.bossBar.width = (W - 160) * this.boss.health.ratio
  }

  private updateRoomCleared(): void {
    if (!this.current || this.current.cleared) return
    const alive = this.enemies.getChildren().some(e => !(e as Enemy).isDead)
    if (!alive) {
      this.current.cleared = true
      this.doorBlocks.clear(true, true)
      this.buildDoors(this.current)
    }
  }

  private checkDeath(): void {
    if (this.dead || !this.player.isDead) return
    this.dead = true
    this.player.progression.penalizeXp(0.2)  // -20% XP del nivel actual, no puede bajar de nivel
    if (this.mode === 'run') GameState.respawnCount++  // muerte en dungeon cuenta como respawn
    this.syncProgression()
    addLabel(this, W / 2, H / 2 - 80, 'MORISTE', 32, CSS.red).setOrigin(0.5).setScrollFactor(0).setDepth(3000)
    this.time.delayedCall(1400, () => {
      GameState.clearBag()
      GameState.lastOutcome = 'death'
      this.switchScene('overworld')
    })
  }

  private checkDoorTransitions(time: number): void {
    if (time < this.transitionLockUntil || !this.current || !this.dungeon) return
    const pb = this.player.getBounds()
    for (const door of this.doorZones) {
      if (!Phaser.Geom.Intersects.RectangleToRectangle(pb, door.rect)) continue
      const { dx, dy, opposite } = DIRS[door.dir]
      const next = this.dungeon.rooms.get(keyOf(this.current.x + dx, this.current.y + dy))
      if (!next) return
      if (next.type === 'boss' && !this.minibossDefeated) {
        this.events.emit('toast', '⚠ Derrota al Centinela primero')
        return
      }
      this.transitionLockUntil = time + TRANSITION_LOCK_MS
      this.buildRoom(next)
      this.placePlayerAtDoor(opposite)
      return
    }
  }

  private checkPortals(): void {
    if (this.time.now < this.transitionLockUntil) return
    const pb = this.player.getBounds()
    for (const z of this.portalZones) {
      if (!Phaser.Geom.Intersects.RectangleToRectangle(pb, z.rect)) continue
      if (z.kind === 'dungeon') return this.enterDungeon()
      if (z.kind === 'overworld') return this.exitToOverworld()
      if (z.kind === 'stash') this.depositStash()
    }
  }
}
